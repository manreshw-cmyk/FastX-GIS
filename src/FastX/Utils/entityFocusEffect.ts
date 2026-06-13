/**
 * 实体定位聚焦工具。
 * 提供“飞到实体/坐标 + 临时聚焦扩散圈”的基础能力，用于在三维场景中快速强调目标实体位置。
 */
import * as Cesium from "cesium";

/** 经纬度高度数组，单位分别为度、度、米。 */
export type EntityFocusPositionTuple = readonly [
  longitude: number,
  latitude: number,
  height?: number,
];

/** 经纬度高度对象，单位分别为度、度、米。 */
export interface EntityFocusPosition {
  /** 经度，单位：度。 */
  longitude: number;
  /** 纬度，单位：度。 */
  latitude: number;
  /** 高度，单位：米。 */
  height?: number;
}

/** 聚焦工具支持的坐标输入。 */
export type EntityFocusPositionInput =
  | Cesium.Cartesian3
  | EntityFocusPositionTuple
  | EntityFocusPosition;

/** 聚焦效果新增参数。 */
export interface EntityFocusEffectOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 需要聚焦的实体。 */
  entity?: Cesium.Entity;
  /** 需要聚焦的实体 id，未传 entity 时从 viewer.entities 中查找。 */
  entityId?: string;
  /** 需要聚焦的坐标，未传 entity/entityId 时使用。 */
  position?: EntityFocusPositionInput;
  /** 聚焦圈最大半径，单位：米，默认 800。 */
  radius?: number;
  /** 聚焦圈初始半径，单位：米，默认 50。 */
  minRadius?: number;
  /** 聚焦动画时长，单位：秒，默认 2。 */
  duration?: number;
  /** 聚焦圈数量，默认 3。 */
  ringCount?: number;
  /** 聚焦圈颜色，默认 #18d6ff。 */
  color?: string | Cesium.Color;
  /** 聚焦圈线宽，单位：像素，默认 2。 */
  lineWidth?: number;
  /** 是否显示，默认 true。 */
  show?: boolean;
  /** 是否同步执行相机飞行，默认 true。 */
  flyTo?: boolean;
  /** 相机飞行距离目标中心的范围，单位：米，默认 radius * 6。 */
  range?: number;
  /** 相机航向角，单位：度，默认保持 Cesium 默认。 */
  heading?: number;
  /** 相机俯仰角，单位：度，默认 -45。 */
  pitch?: number;
  /** 相机飞行时长，单位：秒，默认 duration * 0.6。 */
  flyDuration?: number;
  /** 动画结束后是否自动移除聚焦圈，默认 true。 */
  removeOnComplete?: boolean;
}

/** 聚焦效果更新参数。 */
export type EntityFocusEffectUpdateOptions = Partial<Omit<EntityFocusEffectOptions, "id" | "entityId">>;

/** 已解析的聚焦效果参数。 */
interface ResolvedEntityFocusEffectOptions extends EntityFocusEffectOptions {
  /** 唯一 id。 */
  id: string;
  /** 聚焦中心点。 */
  position: Cesium.Cartesian3;
  /** 聚焦圈最大半径。 */
  radius: number;
  /** 聚焦圈初始半径。 */
  minRadius: number;
  /** 聚焦动画时长，单位：秒。 */
  duration: number;
  /** 聚焦圈数量。 */
  ringCount: number;
  /** 聚焦圈颜色。 */
  color: Cesium.Color;
  /** 聚焦圈线宽。 */
  lineWidth: number;
  /** 是否显示。 */
  show: boolean;
  /** 是否同步执行相机飞行。 */
  flyTo: boolean;
  /** 相机飞行距离。 */
  range: number;
  /** 相机俯仰角，单位：度。 */
  pitch: number;
  /** 相机飞行时长，单位：秒。 */
  flyDuration: number;
  /** 动画结束后是否自动移除聚焦圈。 */
  removeOnComplete: boolean;
}

/** 聚焦效果内部记录。 */
interface EntityFocusEffectRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 聚焦效果 id。 */
  id: string;
  /** 聚焦圈 Entity 集合。 */
  entities: Cesium.Entity[];
  /** 已解析参数。 */
  options: ResolvedEntityFocusEffectOptions;
  /** 动画开始时间戳。 */
  startTime: number;
  /** 场景逐帧监听移除函数。 */
  removeRenderListener: () => void;
}

let entityFocusIdSeed = 1;

/** 判断坐标是否为经纬度高度数组。 */
function isEntityFocusPositionTuple(position: EntityFocusPositionInput): position is EntityFocusPositionTuple {
  return Array.isArray(position);
}

/** 实体定位聚焦效果管理器。 */
export default class EntityFocusEffect {
  /** 当前管理的聚焦效果记录。 */
  private readonly records = new Map<string, EntityFocusEffectRecord>();

  /** 新增聚焦效果，返回效果 id。 */
  focus(viewer: Cesium.Viewer, options: EntityFocusEffectOptions): string | undefined {
    if (!this.isValidViewer(viewer)) return undefined;
    const resolved = this.resolveOptions(viewer, options);
    if (!resolved) return undefined;
    if (this.records.has(resolved.id)) this.remove(resolved.id);

    if (resolved.flyTo) this.flyToPosition(viewer, resolved);
    const record = this.createRecord(viewer, resolved);
    this.records.set(resolved.id, record);
    this.requestSceneRender(viewer);
    return resolved.id;
  }

  /** 更新指定聚焦效果，内部会重建聚焦圈。 */
  update(id: string, options: EntityFocusEffectUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    const nextOptions = this.resolveOptions(record.viewer, {
      ...record.options,
      ...options,
      id,
      flyTo: options.flyTo ?? false,
    });
    if (!nextOptions) return false;
    this.removeRecord(record);
    const nextRecord = this.createRecord(record.viewer, nextOptions);
    this.records.set(id, nextRecord);
    this.requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定聚焦效果显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.entities.forEach((entity) => {
      entity.show = visible;
    });
    this.requestSceneRender(record.viewer);
    return true;
  }

  /** 获取聚焦圈 Entity 集合。 */
  get(id: string): Cesium.Entity[] | undefined {
    return this.records.get(id)?.entities;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定聚焦效果。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecord(record);
    this.records.delete(id);
    return true;
  }

  /** 清空全部聚焦效果；传入 viewer 时只清空该 Viewer 下的效果。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部聚焦效果。 */
  destroy(): void {
    this.clear();
  }

  /** 合并默认参数并解析聚焦位置。 */
  private resolveOptions(
    viewer: Cesium.Viewer,
    options: EntityFocusEffectOptions,
  ): ResolvedEntityFocusEffectOptions | undefined {
    const position = this.resolvePosition(viewer, options);
    if (!position) return undefined;
    const radius = Math.max(1, options.radius ?? 800);
    const duration = Math.max(0.1, options.duration ?? 2);
    return {
      ...options,
      id: options.id ?? this.createId(),
      position,
      radius,
      minRadius: Math.max(0, options.minRadius ?? 50),
      duration,
      ringCount: Math.max(1, Math.floor(options.ringCount ?? 3)),
      color: this.toCesiumColor(options.color, Cesium.Color.fromCssColorString("#18d6ff")),
      lineWidth: options.lineWidth ?? 2,
      show: options.show ?? true,
      flyTo: options.flyTo ?? true,
      range: options.range ?? radius * 6,
      pitch: options.pitch ?? -45,
      flyDuration: options.flyDuration ?? duration * 0.6,
      removeOnComplete: options.removeOnComplete ?? true,
    };
  }

  /** 创建聚焦圈记录。 */
  private createRecord(viewer: Cesium.Viewer, options: ResolvedEntityFocusEffectOptions): EntityFocusEffectRecord {
    const entities: Cesium.Entity[] = [];
    let currentRecord: EntityFocusEffectRecord | undefined;
    const startTime = Date.now();
    const height = Cesium.Cartographic.fromCartesian(options.position).height;

    for (let index = 0; index < options.ringCount; index += 1) {
      const phase = index / options.ringCount;
      const entity = viewer.entities.add({
        id: `${options.id}-ring-${index}`,
        name: "Entity Focus Ring",
        show: options.show,
        position: options.position,
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => this.getCurrentRadius(currentRecord, phase), false),
          semiMinorAxis: new Cesium.CallbackProperty(() => this.getCurrentRadius(currentRecord, phase), false),
          height,
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => this.getCurrentColor(currentRecord, phase), false),
          ),
          outline: true,
          outlineColor: new Cesium.CallbackProperty(() => this.getCurrentColor(currentRecord, phase), false),
          outlineWidth: options.lineWidth,
        },
      });
      entities.push(entity);
    }

    const listener = () => {
      const record = currentRecord;
      if (!record) return;
      if (record.options.removeOnComplete && Date.now() - record.startTime > record.options.duration * 1000) {
        this.remove(record.id);
        return;
      }
      this.requestSceneRender(viewer);
    };
    viewer.scene.preRender.addEventListener(listener);
    currentRecord = {
      viewer,
      id: options.id,
      entities,
      options,
      startTime,
      removeRenderListener: () => viewer.scene.preRender.removeEventListener(listener),
    };
    return currentRecord;
  }

  /** 计算当前聚焦圈半径。 */
  private getCurrentRadius(record: EntityFocusEffectRecord | undefined, phase: number): number {
    if (!record) return 1;
    const progress = this.getLoopProgress(record, phase);
    return Cesium.Math.lerp(record.options.minRadius, record.options.radius, progress);
  }

  /** 计算当前聚焦圈颜色透明度。 */
  private getCurrentColor(record: EntityFocusEffectRecord | undefined, phase: number): Cesium.Color {
    if (!record) return Cesium.Color.TRANSPARENT;
    const progress = this.getLoopProgress(record, phase);
    return Cesium.Color.fromAlpha(record.options.color, Math.max(0, 1 - progress));
  }

  /** 计算聚焦圈循环进度。 */
  private getLoopProgress(record: EntityFocusEffectRecord, phase: number): number {
    const elapsed = (Date.now() - record.startTime) / 1000;
    return (elapsed / record.options.duration + phase) % 1;
  }

  /** 执行相机飞行。 */
  private flyToPosition(viewer: Cesium.Viewer, options: ResolvedEntityFocusEffectOptions): void {
    const offset = new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(options.heading ?? 0),
      Cesium.Math.toRadians(options.pitch),
      options.range,
    );
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(options.position, options.radius), {
      duration: options.flyDuration,
      offset,
    });
  }

  /** 解析聚焦位置。 */
  private resolvePosition(viewer: Cesium.Viewer, options: EntityFocusEffectOptions): Cesium.Cartesian3 | undefined {
    const targetEntity = options.entity ?? (options.entityId ? viewer.entities.getById(options.entityId) : undefined);
    const entityPosition = targetEntity?.position?.getValue(viewer.clock.currentTime);
    if (entityPosition) return Cesium.Cartesian3.clone(entityPosition);
    return options.position ? this.toCartesian3(options.position) : undefined;
  }

  /** 转换坐标输入。 */
  private toCartesian3(position: EntityFocusPositionInput): Cesium.Cartesian3 {
    if (position instanceof Cesium.Cartesian3) return Cesium.Cartesian3.clone(position);
    if (isEntityFocusPositionTuple(position)) {
      return Cesium.Cartesian3.fromDegrees(position[0], position[1], position[2] ?? 0);
    }
    return Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, position.height ?? 0);
  }

  /** 转换颜色输入。 */
  private toCesiumColor(color: string | Cesium.Color | undefined, fallback: Cesium.Color): Cesium.Color {
    if (!color) return Cesium.Color.clone(fallback);
    if (color instanceof Cesium.Color) return Cesium.Color.clone(color);
    return Cesium.Color.fromCssColorString(color) ?? Cesium.Color.clone(fallback);
  }

  /** 从场景中移除聚焦圈记录。 */
  private removeRecord(record: EntityFocusEffectRecord): void {
    record.removeRenderListener();
    record.entities.forEach((entity) => record.viewer.entities.remove(entity));
    this.requestSceneRender(record.viewer);
  }

  /** 判断 Viewer 是否可用。 */
  private isValidViewer(viewer: Cesium.Viewer | undefined | null): viewer is Cesium.Viewer {
    return !!viewer && !viewer.isDestroyed();
  }

  /** 通知 Cesium 在 requestRenderMode 下刷新一帧。 */
  private requestSceneRender(viewer: Cesium.Viewer): void {
    viewer.scene.requestRender();
  }

  /** 创建默认聚焦效果 id。 */
  private createId(): string {
    entityFocusIdSeed += 1;
    return `entity-focus-${Date.now()}-${entityFocusIdSeed}`;
  }
}
