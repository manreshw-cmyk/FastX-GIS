/**
 * 3D Tiles 绘制管理类。
 *
 * 基于 Cesium.Cesium3DTileset 封装加载、更新、显隐和清理能力；适合加载倾斜摄影、BIM 或城市建筑 tileset。
 */
import * as Cesium from "cesium";
import { createRandomXgxId } from "../../Coordinates";

/** 新增 3D Tiles 参数。 */
export interface AddTilesetOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** tileset.json 地址，支持 public 本地地址或在线地址。 */
  url: string;
  /** 是否显示，默认 true。 */
  show?: boolean;
  /** 最大屏幕空间误差，值越小越清晰但加载压力越大，默认 2。 */
  maximumScreenSpaceError?: number;
  /** 是否启用动态屏幕空间误差，默认 true。 */
  dynamicScreenSpaceError?: boolean;
  /** 可选模型矩阵，用于整体平移、旋转或缩放 tileset。 */
  modelMatrix?: Cesium.Matrix4;
}

/** 更新 3D Tiles 参数。 */
export type UpdateTilesetProperties = Partial<Omit<AddTilesetOptions, "id">>;

/** 3D Tiles 快照。 */
export interface TilesetSnapshot {
  /** 唯一 id。 */
  id: string;
  /** tileset.json 地址。 */
  url: string;
  /** 是否显示。 */
  show: boolean;
  /** 最大屏幕空间误差。 */
  maximumScreenSpaceError: number;
  /** 是否启用动态屏幕空间误差。 */
  dynamicScreenSpaceError: boolean;
}

interface TilesetRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 唯一 id。 */
  id: string;
  /** Cesium 3D Tiles 图元。 */
  tileset: Cesium.Cesium3DTileset;
  /** 原始解析参数。 */
  options: Required<Omit<AddTilesetOptions, "id" | "modelMatrix">> & {
    id: string;
    modelMatrix?: Cesium.Matrix4;
  };
}

/** 单体 3D Tiles 管理器。 */
export default class Tileset {
  /** 当前管理的 tileset 记录。 */
  private readonly records = new Map<string, TilesetRecord>();

  /** 新增 3D Tiles，并返回 id。 */
  async add(viewer: Cesium.Viewer, options: AddTilesetOptions): Promise<string | undefined> {
    if (!this.isValidViewer(viewer) || !options?.url?.trim()) return undefined;
    const id = options.id?.trim() || createRandomXgxId("tileset");
    if (this.records.has(id)) return undefined;

    const resolved = this.resolveOptions(id, options);
    const tileset = await Cesium.Cesium3DTileset.fromUrl(resolved.url, {
      maximumScreenSpaceError: resolved.maximumScreenSpaceError,
      dynamicScreenSpaceError: resolved.dynamicScreenSpaceError,
    });
    tileset.show = resolved.show;
    if (resolved.modelMatrix) tileset.modelMatrix = resolved.modelMatrix;

    viewer.scene.primitives.add(tileset);
    this.records.set(id, { viewer, id, tileset, options: resolved });
    viewer.scene.requestRender();
    return id;
  }

  /** 批量新增 3D Tiles，并返回成功创建的 id。 */
  async addTilesets(viewer: Cesium.Viewer, options: AddTilesetOptions[]): Promise<string[]> {
    if (!this.isValidViewer(viewer) || !Array.isArray(options)) return [];
    const ids: string[] = [];
    for (const item of options) {
      const id = await this.add(viewer, item);
      if (id) ids.push(id);
    }
    return ids;
  }

  /** 更新 3D Tiles；传入新 url 时会重建 tileset。 */
  async update(id: string, properties: UpdateTilesetProperties): Promise<boolean> {
    const record = this.records.get(id);
    if (!record || !properties) return false;

    if (properties.url && properties.url !== record.options.url) {
      const nextOptions = this.resolveOptions(id, { ...record.options, ...properties, id });
      const nextTileset = await Cesium.Cesium3DTileset.fromUrl(nextOptions.url, {
        maximumScreenSpaceError: nextOptions.maximumScreenSpaceError,
        dynamicScreenSpaceError: nextOptions.dynamicScreenSpaceError,
      });
      nextTileset.show = nextOptions.show;
      if (nextOptions.modelMatrix) nextTileset.modelMatrix = nextOptions.modelMatrix;
      record.viewer.scene.primitives.remove(record.tileset);
      record.viewer.scene.primitives.add(nextTileset);
      record.tileset = nextTileset;
      record.options = nextOptions;
      record.viewer.scene.requestRender();
      return true;
    }

    this.applyProperties(record, properties);
    return true;
  }

  /** 设置指定 3D Tiles 显隐。 */
  setVisible(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.tileset.show = visible;
    record.viewer.scene.requestRender();
    return true;
  }

  /** `setVisible` 的语义别名。 */
  show(id: string, visible: boolean): boolean {
    return this.setVisible(id, visible);
  }

  /** 获取指定 Cesium.Cesium3DTileset 实例。 */
  get(id: string): Cesium.Cesium3DTileset | undefined {
    return this.records.get(id)?.tileset;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 获取指定 3D Tiles 的参数快照。 */
  getSnapshot(id: string): TilesetSnapshot | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    return {
      id,
      url: record.options.url,
      show: record.tileset.show,
      maximumScreenSpaceError: record.tileset.maximumScreenSpaceError,
      dynamicScreenSpaceError: record.tileset.dynamicScreenSpaceError,
    };
  }

  /** 删除指定 3D Tiles。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.viewer.scene.primitives.remove(record.tileset);
    this.records.delete(id);
    record.viewer.scene.requestRender();
    return true;
  }

  /** 清空全部 3D Tiles；传入 viewer 时只清空该 Viewer 下的对象。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部 3D Tiles。 */
  destroy(): void {
    this.clear();
  }

  /** 合并默认参数。 */
  private resolveOptions(id: string, options: AddTilesetOptions): TilesetRecord["options"] {
    return {
      id,
      url: options.url.trim(),
      show: options.show ?? true,
      maximumScreenSpaceError: this.positiveNumber(options.maximumScreenSpaceError, 2),
      dynamicScreenSpaceError: options.dynamicScreenSpaceError ?? true,
      modelMatrix: options.modelMatrix,
    };
  }

  /** 应用无需重建 tileset 的更新参数。 */
  private applyProperties(record: TilesetRecord, properties: UpdateTilesetProperties): void {
    if (properties.show !== undefined) {
      record.options.show = properties.show;
      record.tileset.show = properties.show;
    }
    if (properties.maximumScreenSpaceError !== undefined) {
      record.options.maximumScreenSpaceError = this.positiveNumber(properties.maximumScreenSpaceError, record.options.maximumScreenSpaceError);
      record.tileset.maximumScreenSpaceError = record.options.maximumScreenSpaceError;
    }
    if (properties.dynamicScreenSpaceError !== undefined) {
      record.options.dynamicScreenSpaceError = properties.dynamicScreenSpaceError;
      record.tileset.dynamicScreenSpaceError = properties.dynamicScreenSpaceError;
    }
    if (properties.modelMatrix) {
      record.options.modelMatrix = properties.modelMatrix;
      record.tileset.modelMatrix = properties.modelMatrix;
    }
    record.viewer.scene.requestRender();
  }

  /** 正数兜底。 */
  private positiveNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** 校验 Viewer 是否可用。 */
  private isValidViewer(viewer: Cesium.Viewer | undefined): viewer is Cesium.Viewer {
    return !!viewer && !viewer.isDestroyed();
  }
}
