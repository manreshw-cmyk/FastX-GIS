/**
 * 雷达发射波 Primitive 批量绘制类。
 * 使用 CylinderGeometry 绘制多个雷达锥体，适合雷达范围批量渲染。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
  toCartesian3,
  toCesiumColor,
} from "../shared";
import type { RadarEmissionWaveAddOptions, RadarEmissionWaveAttitude, RadarEmissionWaveUpdateOptions } from ".";
import {
  createRadarEmissionWaveOrientation,
  patchAttitude,
  resolveAttitude,
} from ".";
import {
  DEFAULT_RADAR_EMISSION_WAVE_COLOR,
  createRadarEmissionWaveMaterial,
  getRadarEmissionWaveTime,
} from "./material";

/** 雷达发射波 Primitive 记录。 */
interface RadarEmissionWavePrimitiveRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** Primitive 对象。 */
  primitive: Cesium.Primitive;
  /** Primitive 材质。 */
  material: Cesium.Material;
  /** 唯一 id。 */
  id: string;
  /** 中心点。 */
  position: Cesium.Cartesian3;
  /** 姿态。 */
  attitude: RadarEmissionWaveAttitude;
  /** 锥体长度。 */
  length: number;
  /** 锥体底部半径。 */
  bottomRadius: number;
  /** 动画时长。 */
  duration: number;
  /** 是否显示。 */
  show: boolean;
  /** 动画起始时间。 */
  startTime: number;
}

/** Viewer 分桶。 */
interface RadarEmissionWavePrimitiveBucket {
  /** 当前 Viewer 管理的 id。 */
  ids: Set<string>;
  /** preRender 动画监听。 */
  removeListener?: () => void;
}

/** 雷达发射波 Primitive 批量绘制类。 */
export default class RadarEmissionWaveCollection {
  /** 所有 Primitive 记录。 */
  private readonly records = new Map<string, RadarEmissionWavePrimitiveRecord>();
  /** 按 Viewer 分桶，方便清理监听。 */
  private readonly buckets = new Map<Cesium.Viewer, RadarEmissionWavePrimitiveBucket>();

  /** 批量新增雷达发射波，返回成功创建的 id。 */
  addWaves(viewer: Cesium.Viewer, options: RadarEmissionWaveAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个雷达发射波 Primitive，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: RadarEmissionWaveAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;
    const id = options.id ?? createSpecialEffectId("radar-emission-wave-primitive");
    if (this.records.has(id)) return undefined;

    const material = createRadarEmissionWaveMaterial({
      color: toCesiumColor(options.color, DEFAULT_RADAR_EMISSION_WAVE_COLOR),
      duration: options.duration ?? 2000,
      repeat: options.repeat ?? 30,
      offset: options.offset ?? 0,
      thickness: options.thickness ?? 0.1,
    });
    const record: RadarEmissionWavePrimitiveRecord = {
      viewer,
      primitive: undefined as unknown as Cesium.Primitive,
      material,
      id,
      position: toCartesian3(options.position),
      attitude: resolveAttitude(options),
      length: options.length ?? 500000,
      bottomRadius: options.bottomRadius ?? 50000,
      duration: options.duration ?? 2000,
      show: options.show ?? true,
      startTime: Date.now(),
    };
    record.primitive = this.createPrimitive(record);
    viewer.scene.primitives.add(record.primitive);
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定雷达发射波 Primitive。 */
  update(id: string, options: RadarEmissionWaveUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    let needsRebuild = false;
    if (options.position) {
      record.position = toCartesian3(options.position);
      needsRebuild = true;
    }
    if (options.heading !== undefined || options.pitch !== undefined || options.roll !== undefined) {
      patchAttitude(record.attitude, options);
      needsRebuild = true;
    }
    if (typeof options.length === "number") {
      record.length = options.length;
      needsRebuild = true;
    }
    if (typeof options.bottomRadius === "number") {
      record.bottomRadius = options.bottomRadius;
      needsRebuild = true;
    }
    if (options.color) record.material.uniforms.color = toCesiumColor(options.color, record.material.uniforms.color as Cesium.Color);
    if (typeof options.duration === "number") record.duration = options.duration;
    if (typeof options.repeat === "number") record.material.uniforms.repeat = options.repeat;
    if (typeof options.offset === "number") record.material.uniforms.offset = options.offset;
    if (typeof options.thickness === "number") record.material.uniforms.thickness = options.thickness;
    if (typeof options.show === "boolean") {
      record.show = options.show;
      record.primitive.show = options.show;
    }
    if (needsRebuild) this.rebuild(id, record);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定雷达发射波 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.show = visible;
    record.primitive.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定雷达发射波 Primitive。 */
  get(id: string): Cesium.Primitive | undefined {
    return this.records.get(id)?.primitive;
  }

  /** 获取当前管理的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    if (!viewer) return [...this.records.keys()];
    return [...(this.buckets.get(viewer)?.ids ?? [])];
  }

  /** 删除指定雷达发射波 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removePrimitive(record.viewer, record.primitive);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空所有雷达发射波 Primitive；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的所有雷达发射波 Primitive。 */
  destroy(): void {
    this.clear();
  }

  /** 创建锥体 Primitive。 */
  private createPrimitive(record: RadarEmissionWavePrimitiveRecord): Cesium.Primitive {
    return new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        id: record.id,
        geometry: new Cesium.CylinderGeometry({
          length: record.length,
          topRadius: 0,
          bottomRadius: record.bottomRadius,
          vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
        }),
        modelMatrix: Cesium.Matrix4.fromTranslationQuaternionRotationScale(
          record.position,
          createRadarEmissionWaveOrientation(record.position, record.attitude),
          new Cesium.Cartesian3(1, 1, 1),
        ),
      }),
      appearance: new Cesium.MaterialAppearance({
        material: record.material,
        faceForward: true,
      }),
      asynchronous: false,
      show: record.show,
    });
  }

  /** 重建几何变化后的 Primitive。 */
  private rebuild(id: string, record: RadarEmissionWavePrimitiveRecord): void {
    removePrimitive(record.viewer, record.primitive);
    record.primitive = this.createPrimitive(record);
    record.viewer.scene.primitives.add(record.primitive);
    this.records.set(id, record);
  }

  /** 获取或创建 Viewer 分桶。 */
  private ensureBucket(viewer: Cesium.Viewer): RadarEmissionWavePrimitiveBucket {
    let bucket = this.buckets.get(viewer);
    if (!bucket) {
      const listener = () => this.updateAnimation(viewer);
      viewer.scene.preRender.addEventListener(listener);
      bucket = { ids: new Set(), removeListener: () => viewer.scene.preRender.removeEventListener(listener) };
      this.buckets.set(viewer, bucket);
    }
    return bucket;
  }

  /** 更新当前 Viewer 下所有雷达发射波动画 Uniform。 */
  private updateAnimation(viewer: Cesium.Viewer): void {
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record) return;
      record.material.uniforms.time = getRadarEmissionWaveTime(record.startTime, record.duration);
    });
  }

  /** 清理没有记录的 Viewer 分桶。 */
  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener?.();
    this.buckets.delete(viewer);
  }
}
