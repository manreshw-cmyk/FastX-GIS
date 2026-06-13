/**
 * SpecialEffects 空间特效通用生命周期管理器。
 * Entity 单体类和 Primitive 批量类复用这里的新增、更新、显隐和销毁逻辑。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removeEntity,
  removePrimitive,
  requestSceneRender,
} from "../shared";

/** 带 id 和显隐状态的特效基础参数。 */
export interface ManagedEffectOptions {
  /** 唯一 id，不传时由 SDK 自动生成。 */
  id?: string;
  /** 是否显示，默认 true。 */
  show?: boolean;
}

/** Entity 单体特效内部记录。 */
export interface ManagedEntityRecord<R extends ManagedEffectOptions & { id: string }> {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 特效唯一 id。 */
  id: string;
  /** 一个特效对应的一组 Entity。 */
  entities: Cesium.Entity[];
  /** 已解析后的特效参数。 */
  options: R;
}

/** Primitive 批量特效内部记录。 */
export interface ManagedPrimitiveRecord<R extends ManagedEffectOptions & { id: string }> {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 特效唯一 id。 */
  id: string;
  /** 一个特效对应的一组 Primitive。 */
  primitives: Cesium.Primitive[];
  /** 已解析后的特效参数。 */
  options: R;
}

/** Entity 单体特效基类。 */
export abstract class EntityEffectBase<
  T extends ManagedEffectOptions,
  R extends ManagedEffectOptions & { id: string } = T & { id: string },
> {
  /** 自动生成 id 时使用的业务前缀。 */
  private readonly idPrefix: string;
  /** 兼容旧式构造器传入 Viewer 的调用方式。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前类管理的 Entity 记录。 */
  private readonly records = new Map<string, ManagedEntityRecord<R>>();

  protected constructor(idPrefix: string, defaultViewer?: Cesium.Viewer) {
    this.idPrefix = idPrefix;
    this.defaultViewer = defaultViewer;
  }

  /** 新增一个 Entity 特效，返回特效 id。 */
  add(viewer: Cesium.Viewer, options: T): string | undefined;
  add(options: T): string | undefined;
  add(viewerOrOptions: Cesium.Viewer | T, maybeOptions?: T): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const { viewer, options } = resolved;
    const id = options.id ?? createSpecialEffectId(this.idPrefix);
    if (this.records.has(id)) return undefined;

    const resolvedOptions = this.resolveOptions({ ...options, id });
    const entities = this.createEntities(viewer, id, resolvedOptions);
    this.records.set(id, { viewer, id, entities, options: resolvedOptions });
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增 Entity 特效，返回成功创建的 id 集合。 */
  addMany(viewer: Cesium.Viewer, options: T[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 更新指定 Entity 特效，内部会按新参数重建几何。 */
  update(id: string, options: Partial<Omit<T, "id">>): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordEntities(record);
    const nextOptions = this.resolveOptions({ ...(record.options as unknown as T), ...options, id });
    const entities = this.createEntities(record.viewer, id, nextOptions);
    this.records.set(id, { ...record, entities, options: nextOptions });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定 Entity 特效显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.entities.forEach((entity) => {
      entity.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定特效对应的 Entity 集合。 */
  get(id: string): Cesium.Entity[] | undefined {
    return this.records.get(id)?.entities;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定 Entity 特效。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecordEntities(record);
    this.records.delete(id);
    return true;
  }

  /** 清空全部 Entity 特效；传入 viewer 时只清空该 Viewer 下的特效。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部 Entity 特效。 */
  destroy(): void {
    this.clear();
  }

  /** 子类可在这里合并默认值并转换参数。 */
  protected resolveOptions(options: T & { id: string }): R {
    return options as unknown as R;
  }

  /** 子类负责根据参数创建 Entity。 */
  protected abstract createEntities(
    viewer: Cesium.Viewer,
    id: string,
    options: R,
  ): Cesium.Entity[];

  /** 删除一条记录下的全部 Entity。 */
  private removeRecordEntities(record: ManagedEntityRecord<R>): void {
    record.entities.forEach((entity) => removeEntity(record.viewer, entity));
  }

  /** 兼容 add(viewer, options) 和 new Class(viewer).add(options) 两种调用方式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | T,
    maybeOptions?: T,
  ): { viewer: Cesium.Viewer; options: T } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as T);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }
}

/** Primitive 批量特效基类。 */
export abstract class PrimitiveEffectBase<
  T extends ManagedEffectOptions,
  R extends ManagedEffectOptions & { id: string } = T & { id: string },
> {
  /** 自动生成 id 时使用的业务前缀。 */
  private readonly idPrefix: string;
  /** 当前类管理的 Primitive 记录。 */
  private readonly records = new Map<string, ManagedPrimitiveRecord<R>>();

  protected constructor(idPrefix: string) {
    this.idPrefix = idPrefix;
  }

  /** 批量新增 Primitive 特效，返回成功创建的 id 集合。 */
  addMany(viewer: Cesium.Viewer, options: T[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 新增一个 Primitive 特效，返回特效 id。 */
  add(viewer: Cesium.Viewer, options: T): string | undefined {
    if (!isValidViewer(viewer)) return undefined;
    const id = options.id ?? createSpecialEffectId(`${this.idPrefix}-primitive`);
    if (this.records.has(id)) return undefined;

    const resolvedOptions = this.resolveOptions({ ...options, id });
    const primitives = this.createPrimitives(viewer, id, resolvedOptions);
    this.records.set(id, { viewer, id, primitives, options: resolvedOptions });
    requestSceneRender(viewer);
    return id;
  }

  /** 更新指定 Primitive 特效，内部会按新参数重建几何。 */
  update(id: string, options: Partial<Omit<T, "id">>): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    const nextOptions = this.resolveOptions({ ...(record.options as unknown as T), ...options, id });
    const primitives = this.createPrimitives(record.viewer, id, nextOptions);
    this.records.set(id, { ...record, primitives, options: nextOptions });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定 Primitive 特效显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.primitives.forEach((primitive) => {
      primitive.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定特效对应的 Primitive 集合。 */
  get(id: string): Cesium.Primitive[] | undefined {
    return this.records.get(id)?.primitives;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定 Primitive 特效。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecordPrimitives(record);
    this.records.delete(id);
    return true;
  }

  /** 清空全部 Primitive 特效；传入 viewer 时只清空该 Viewer 下的特效。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部 Primitive 特效。 */
  destroy(): void {
    this.clear();
  }

  /** 子类可在这里合并默认值并转换参数。 */
  protected resolveOptions(options: T & { id: string }): R {
    return options as unknown as R;
  }

  /** 子类负责根据参数创建 Primitive。 */
  protected abstract createPrimitives(
    viewer: Cesium.Viewer,
    id: string,
    options: R,
  ): Cesium.Primitive[];

  /** 删除一条记录下的全部 Primitive。 */
  private removeRecordPrimitives(record: ManagedPrimitiveRecord<R>): void {
    record.primitives.forEach((primitive) => removePrimitive(record.viewer, primitive));
  }
}
