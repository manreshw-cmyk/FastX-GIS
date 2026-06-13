/**
 * 半球雷达扫描特效。
 * 参考项目的立体雷达扫描实现：半球雷达罩体叠加一片持续旋转的扫描墙。
 */
import * as Cesium from "cesium";
import {
  SpecialEffectsColorInput,
  SpecialEffectsPositionInput,
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  requestSceneRender,
  toCartographic,
  toCesiumColor,
} from "../shared";

/** 半球雷达扫描默认颜色，参考需求统一为绿色。 */
export const DEFAULT_HEMISPHERE_RADAR_SCAN_COLOR = Cesium.Color.fromCssColorString("#00ff0038")!;

/** 半球雷达扫描新增参数。 */
export interface HemisphereRadarScanAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 雷达中心点。 */
  position: SpecialEffectsPositionInput;
  /** 半球雷达半径，单位：米，默认 1000。 */
  radius?: number;
  /** 雷达主体颜色，默认绿色。 */
  color?: SpecialEffectsColorInput;
  /** 扫描墙颜色，不传时使用 color。 */
  scanColor?: SpecialEffectsColorInput;
  /** 旋转速度，单位：度/帧，默认 1。 */
  speed?: number;
  /** 扫描墙俯仰角范围，单位：度，默认 90。 */
  scanAngle?: number;
  /** 半球经向分段数，默认 40。 */
  stackPartitions?: number;
  /** 半球纬向分段数，默认 40。 */
  slicePartitions?: number;
  /** 是否显示轮廓线，默认 true。 */
  outline?: boolean;
  /** 轮廓线颜色，不传时使用 color。 */
  outlineColor?: SpecialEffectsColorInput;
  /** 轮廓线宽度，单位：像素，默认 1。 */
  outlineWidth?: number;
  /** 可见距离范围，单位：米。 */
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  /** 是否显示，默认 true。 */
  show?: boolean;
}

/** 半球雷达扫描更新参数。 */
export type HemisphereRadarScanUpdateOptions = Partial<Omit<HemisphereRadarScanAddOptions, "id">>;

/** 半球雷达扫描内部标准参数。 */
export interface HemisphereRadarScanResolvedOptions {
  /** 唯一 id。 */
  id: string;
  /** 雷达中心点经纬高。 */
  center: Cesium.Cartographic;
  /** 半球雷达半径，单位：米。 */
  radius: number;
  /** 雷达主体颜色。 */
  color: Cesium.Color;
  /** 扫描墙颜色。 */
  scanColor: Cesium.Color;
  /** 旋转速度，单位：度/帧。 */
  speed: number;
  /** 扫描墙俯仰角范围，单位：度。 */
  scanAngle: number;
  /** 半球经向分段数。 */
  stackPartitions: number;
  /** 半球纬向分段数。 */
  slicePartitions: number;
  /** 是否显示轮廓线。 */
  outline: boolean;
  /** 轮廓线颜色。 */
  outlineColor: Cesium.Color;
  /** 轮廓线宽度，单位：像素。 */
  outlineWidth: number;
  /** 可见距离范围。 */
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  /** 是否显示。 */
  show: boolean;
  /** 当前扫描方位角，单位：度。 */
  heading: number;
  /** 动画开始时间戳。 */
  startTime: number;
  /** 当前扫描墙坐标数组。 */
  scanPositions: number[];
}

/** 半球雷达扫描 Entity 记录。 */
interface HemisphereRadarScanRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 单个雷达扫描对应的 Entity。 */
  entity: Cesium.Entity;
  /** 当前标准参数。 */
  options: HemisphereRadarScanResolvedOptions;
}

/** 半球雷达扫描 Entity 单体绘制类。 */
export default class HemisphereRadarScan {
  /** 兼容 new Class(viewer).add(options) 的默认 Viewer。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的雷达扫描记录。 */
  private readonly records = new Map<string, HemisphereRadarScanRecord>();
  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
  }

  /** 新增一个半球雷达扫描，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: HemisphereRadarScanAddOptions): string | undefined;
  add(options: HemisphereRadarScanAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | HemisphereRadarScanAddOptions,
    maybeOptions?: HemisphereRadarScanAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId("hemisphere-radar-scan");
    if (this.records.has(id) || viewer.entities.getById(id)) return undefined;

    const effectOptions = resolveHemisphereRadarScanOptions({ ...options, id });
    const entity = this.createEntity(viewer, effectOptions);
    this.records.set(id, { viewer, entity, options: effectOptions });
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增半球雷达扫描 Entity，返回成功创建的 id。 */
  addScans(viewer: Cesium.Viewer, options: HemisphereRadarScanAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 更新指定半球雷达扫描。 */
  update(id: string, options: HemisphereRadarScanUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    const nextOptions = resolveHemisphereRadarScanOptions({
      ...record.options,
      position: options.position ?? cartographicToDegrees(record.options.center),
      ...options,
      id,
    });
    removeEntity(record.viewer, record.entity);
    const entity = this.createEntity(record.viewer, nextOptions);
    this.records.set(id, { ...record, entity, options: nextOptions });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定半球雷达扫描显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.entity.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定半球雷达扫描 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.records.get(id)?.entity;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.options.id);
  }

  /** 删除指定半球雷达扫描。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    removeEntity(record.viewer, record.entity);
    this.records.delete(id);
    return true;
  }

  /** 清空半球雷达扫描；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前类管理的全部半球雷达扫描。 */
  destroy(): void {
    this.clear();
  }

  /** 创建参考项目同款半球雷达和扫描墙 Entity。 */
  private createEntity(viewer: Cesium.Viewer, options: HemisphereRadarScanResolvedOptions): Cesium.Entity {
    const centerDegrees = cartographicToDegrees(options.center);
    return viewer.entities.add({
      id: options.id,
      name: "FastX Hemisphere Radar Scan",
      position: Cesium.Cartesian3.fromDegrees(centerDegrees.longitude, centerDegrees.latitude, centerDegrees.height),
      show: options.show,
      wall: {
        positions: new Cesium.CallbackProperty(
          () => Cesium.Cartesian3.fromDegreesArrayHeights(calcHemisphereRadarScanPositions(options)),
          false,
        ),
        material: options.scanColor,
        distanceDisplayCondition: options.distanceDisplayCondition,
      },
      ellipsoid: {
        radii: new Cesium.Cartesian3(options.radius, options.radius, options.radius),
        maximumCone: Cesium.Math.toRadians(90),
        material: options.color,
        outline: options.outline,
        outlineColor: options.outlineColor,
        outlineWidth: options.outlineWidth,
        stackPartitions: options.stackPartitions,
        slicePartitions: options.slicePartitions,
        distanceDisplayCondition: options.distanceDisplayCondition,
      },
    });
  }

  /** 兼容 add(viewer, options) 和 new Class(viewer).add(options) 两种调用方式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | HemisphereRadarScanAddOptions,
    maybeOptions?: HemisphereRadarScanAddOptions,
  ): { viewer: Cesium.Viewer; options: HemisphereRadarScanAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as HemisphereRadarScanAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

}

/** 合并半球雷达扫描默认参数。 */
export function resolveHemisphereRadarScanOptions(
  options: HemisphereRadarScanAddOptions & { id: string },
): HemisphereRadarScanResolvedOptions {
  const center = toCartographic(options.position);
  const color = toCesiumColor(options.color, DEFAULT_HEMISPHERE_RADAR_SCAN_COLOR);
  const scanColor = toCesiumColor(options.scanColor, color);
  const outlineColor = toCesiumColor(options.outlineColor, color);
  const resolved: HemisphereRadarScanResolvedOptions = {
    id: options.id,
    center,
    radius: options.radius ?? 1000,
    color,
    scanColor,
    speed: options.speed ?? 1,
    scanAngle: options.scanAngle ?? 90,
    stackPartitions: Math.max(8, Math.floor(options.stackPartitions ?? 40)),
    slicePartitions: Math.max(8, Math.floor(options.slicePartitions ?? 40)),
    outline: options.outline ?? true,
    outlineColor,
    outlineWidth: options.outlineWidth ?? 1,
    distanceDisplayCondition: options.distanceDisplayCondition,
    show: options.show ?? true,
    heading: 0,
    startTime: Date.now(),
    scanPositions: [],
  };
  resolved.scanPositions = calcHemisphereRadarScanPositions(resolved);
  return resolved;
}

/** 计算当前扫描墙的经纬高数组。 */
export function calcHemisphereRadarScanPositions(options: HemisphereRadarScanResolvedOptions): number[] {
  const center = cartographicToDegrees(options.center);
  const elapsedFrames = (Date.now() - options.startTime) / (1000 / 60);
  const heading = (options.heading + elapsedFrames * options.speed) % 360;
  const endPoint = calcHeadingPoint(center.longitude, center.latitude, options.radius, heading);
  return computeCircularFlight(center.longitude, center.latitude, endPoint.longitude, endPoint.latitude, 0, options.scanAngle);
}

/** 根据中心点、半径和方位角计算扫描墙地面端点。 */
function calcHeadingPoint(longitude: number, latitude: number, radius: number, heading: number): { longitude: number; latitude: number } {
  const matrix = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(longitude, latitude));
  const localPoint = Cesium.Cartesian3.fromElements(
    radius * Math.cos(Cesium.Math.toRadians(heading)),
    radius * Math.sin(Cesium.Math.toRadians(heading)),
    0,
  );
  const worldPoint = Cesium.Matrix4.multiplyByPoint(matrix, localPoint, new Cesium.Cartesian3());
  const cartographic = Cesium.Cartographic.fromCartesian(worldPoint);
  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
  };
}

/** 参考项目的扫描墙弧面点计算逻辑。 */
function computeCircularFlight(
  startLongitude: number,
  startLatitude: number,
  endLongitude: number,
  endLatitude: number,
  startAngle: number,
  sweepAngle: number,
): number[] {
  const result = [startLongitude, startLatitude, 0];
  const radius = Cesium.Cartesian3.distance(
    Cesium.Cartesian3.fromDegrees(startLongitude, startLatitude),
    Cesium.Cartesian3.fromDegrees(endLongitude, endLatitude),
  );
  for (let angle = startAngle; angle <= startAngle + sweepAngle; angle += 1) {
    const radians = Cesium.Math.toRadians(angle);
    const height = radius * Math.sin(radians);
    const ratio = Math.cos(radians);
    result.push((endLongitude - startLongitude) * ratio + startLongitude);
    result.push((endLatitude - startLatitude) * ratio + startLatitude);
    result.push(height);
  }
  return result;
}

/** 将 Cartographic 转为度制经纬高。 */
function cartographicToDegrees(cartographic: Cesium.Cartographic): { longitude: number; latitude: number; height: number } {
  return {
    longitude: Cesium.Math.toDegrees(cartographic.longitude),
    latitude: Cesium.Math.toDegrees(cartographic.latitude),
    height: cartographic.height ?? 0,
  };
}
