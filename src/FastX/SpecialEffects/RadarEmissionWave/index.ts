/**
 * 雷达发射波特效。
 * Entity 类用于单体绘制，RadarEmissionWaveCollection 用于 Primitive 批量绘制。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  requestSceneRender,
  toCartesian3,
  toCesiumColor,
} from "../shared";
import {
  DEFAULT_RADAR_EMISSION_WAVE_COLOR,
  RadarEmissionWaveMaterialProperty,
  registerRadarEmissionWaveMaterial,
} from "./material";

/** 雷达发射波新增参数。 */
export interface RadarEmissionWaveAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 雷达锥体中心点。 */
  position: SpecialEffectsPositionInput;
  /** 航向角，单位：度。默认 135。 */
  heading?: number;
  /** 俯仰角，单位：度。默认 0。 */
  pitch?: number;
  /** 翻滚角，单位：度。默认 0。 */
  roll?: number;
  /** 雷达波颜色。默认 coral。 */
  color?: SpecialEffectsColorInput;
  /** 雷达锥体长度，单位：米。默认 500000。 */
  length?: number;
  /** 雷达锥体底部半径，单位：米。默认 50000。 */
  bottomRadius?: number;
  /** 一轮动画耗时，单位：毫秒。默认 2000。 */
  duration?: number;
  /** 波纹重复数量。默认 30。 */
  repeat?: number;
  /** 波纹偏移量。默认 0。 */
  offset?: number;
  /** 波纹厚度，0 到 1。默认 0.1。 */
  thickness?: number;
  /** 是否显示。默认 true。 */
  show?: boolean;
}

/** 雷达发射波更新参数。 */
export type RadarEmissionWaveUpdateOptions = Partial<Omit<RadarEmissionWaveAddOptions, "id">>;

/** 雷达发射波 Entity 记录。 */
interface RadarEmissionWaveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 雷达发射波实体。 */
  entity: Cesium.Entity;
  /** 雷达发射波动态材质。 */
  material: RadarEmissionWaveMaterialProperty;
  /** 锥体中心点。 */
  position: Cesium.Cartesian3;
  /** 当前姿态。 */
  attitude: RadarEmissionWaveAttitude;
}

/** 雷达发射波姿态参数。 */
export interface RadarEmissionWaveAttitude {
  /** 航向角，单位：度。 */
  heading: number;
  /** 俯仰角，单位：度。 */
  pitch: number;
  /** 翻滚角，单位：度。 */
  roll: number;
}

/** 雷达发射波单体 Entity 绘制类。 */
export default class RadarEmissionWave {
  /** 兼容旧调用方式时保存的默认 Viewer。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的雷达发射波 Entity。 */
  private readonly records = new Map<string, RadarEmissionWaveRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
    registerRadarEmissionWaveMaterial();
  }

  /** 新增一个雷达发射波，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: RadarEmissionWaveAddOptions): string | undefined;
  add(options: RadarEmissionWaveAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | RadarEmissionWaveAddOptions,
    maybeOptions?: RadarEmissionWaveAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("radar-emission-wave");
    if (this.records.has(id) || viewer.entities.getById(id)) return undefined;

    const position = toCartesian3(options.position);
    const attitude = resolveAttitude(options);
    const material = new RadarEmissionWaveMaterialProperty({
      color: toCesiumColor(options.color, DEFAULT_RADAR_EMISSION_WAVE_COLOR),
      duration: options.duration ?? 2000,
      repeat: options.repeat ?? 30,
      offset: options.offset ?? 0,
      thickness: options.thickness ?? 0.1,
    });
    const entity = viewer.entities.add({
      id,
      name: "FastX Radar Emission Wave",
      position,
      orientation: createRadarEmissionWaveOrientation(position, attitude),
      show: options.show ?? true,
      cylinder: {
        length: options.length ?? 500000,
        topRadius: 0,
        bottomRadius: options.bottomRadius ?? 50000,
        material,
      },
    });

    this.records.set(id, { viewer, entity, material, position, attitude });
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定雷达发射波。 */
  update(id: string, options: RadarEmissionWaveUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    if (options.position) {
      record.position = toCartesian3(options.position);
      record.entity.position = new Cesium.ConstantPositionProperty(record.position);
    }
    patchAttitude(record.attitude, options);
    if (options.position || options.heading !== undefined || options.pitch !== undefined || options.roll !== undefined) {
      record.entity.orientation = new Cesium.ConstantProperty(
        createRadarEmissionWaveOrientation(record.position, record.attitude),
      );
    }
    if (options.color) record.material.color = toCesiumColor(options.color, record.material.color);
    if (typeof options.duration === "number") record.material.duration = options.duration;
    if (typeof options.repeat === "number") record.material.repeat = options.repeat;
    if (typeof options.offset === "number") record.material.offset = options.offset;
    if (typeof options.thickness === "number") record.material.thickness = options.thickness;
    if (record.entity.cylinder) {
      if (typeof options.length === "number") record.entity.cylinder.length = new Cesium.ConstantProperty(options.length);
      if (typeof options.bottomRadius === "number") {
        record.entity.cylinder.bottomRadius = new Cesium.ConstantProperty(options.bottomRadius);
      }
    }
    if (typeof options.show === "boolean") record.entity.show = options.show;

    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定雷达发射波显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.entity.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定雷达发射波 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.records.get(id)?.entity;
  }

  /** 删除指定雷达发射波。 */
  /** 获取当前管理的全部雷达发射波 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.entries()]
      .filter(([, record]) => !viewer || record.viewer === viewer)
      .map(([id]) => id);
  }

  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removeEntity(record.viewer, record.entity);
    this.records.delete(id);
    return true;
  }

  /** 清空所有雷达发射波；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.records.forEach((record, id) => {
      if (!viewer || viewer === record.viewer) {
        removeEntity(record.viewer, record.entity);
        this.records.delete(id);
      }
    });
  }

  /** 销毁当前类管理的所有雷达发射波。 */
  destroy(): void {
    this.clear();
  }

  /** 解析 Point 风格和旧版构造器风格参数。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | RadarEmissionWaveAddOptions,
    maybeOptions?: RadarEmissionWaveAddOptions,
  ): { viewer: Cesium.Viewer; options: RadarEmissionWaveAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as RadarEmissionWaveAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }
}

/** 合并默认姿态参数。 */
export function resolveAttitude(options: Pick<RadarEmissionWaveAddOptions, "heading" | "pitch" | "roll">): RadarEmissionWaveAttitude {
  return {
    heading: options.heading ?? 135,
    pitch: options.pitch ?? 0,
    roll: options.roll ?? 0,
  };
}

/** 更新姿态参数。 */
export function patchAttitude(
  attitude: RadarEmissionWaveAttitude,
  options: Pick<RadarEmissionWaveAddOptions, "heading" | "pitch" | "roll">,
): void {
  if (typeof options.heading === "number") attitude.heading = options.heading;
  if (typeof options.pitch === "number") attitude.pitch = options.pitch;
  if (typeof options.roll === "number") attitude.roll = options.roll;
}

/** 根据位置和姿态角创建四元数。 */
export function createRadarEmissionWaveOrientation(
  position: Cesium.Cartesian3,
  attitude: RadarEmissionWaveAttitude,
): Cesium.Quaternion {
  const hpr = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(attitude.heading),
    Cesium.Math.toRadians(attitude.pitch),
    Cesium.Math.toRadians(attitude.roll),
  );
  return Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
}
