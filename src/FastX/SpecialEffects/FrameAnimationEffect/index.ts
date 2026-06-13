/**
 * 帧动画特效。
 * 通过 Billboard 按时间切换图片帧，适合爆炸、闪光等序列帧动画；入参提供帧目录和帧数量，内部按序生成并预加载图片。
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

/** 默认爆炸帧动画目录。 */
export const DEFAULT_FRAME_ANIMATION_PATH = "/assets/images/special-effects/frame-animation/blast/";

/** 帧动画新增参数。 */
export interface FrameAnimationEffectAddOptions {
  /** 唯一 id，不传时 SDK 自动生成。 */
  id?: string;
  /** 帧动画显示位置。 */
  position: SpecialEffectsPositionInput;
  /** 帧动画图片目录，目录下默认按 1.png、2.png 顺序命名。 */
  framePath: string;
  /** 图片总帧数。 */
  frameCount: number;
  /** 图片扩展名，默认 png。 */
  extension?: string;
  /** 起始图片编号，默认 1。 */
  startIndex?: number;
  /** 图片文件名前缀。 */
  filePrefix?: string;
  /** 图片文件名后缀。 */
  fileSuffix?: string;
  /** 帧编号补零位数，例如 4 会生成 0001.png。 */
  framePadding?: number;
  /** 一轮动画时长，单位：秒，默认 2。 */
  duration?: number;
  /** 是否循环播放，默认 true。 */
  loop?: boolean;
  /** 新增后是否自动播放，默认 true。 */
  autoPlay?: boolean;
  /** 是否显示，默认 true。 */
  show?: boolean;
  /** Billboard 宽度，单位：像素。 */
  width?: number;
  /** Billboard 高度，单位：像素。 */
  height?: number;
  /** Billboard 缩放倍数。 */
  scale?: number;
  /** Billboard 颜色。 */
  color?: SpecialEffectsColorInput;
  /** 水平对齐方式，默认 CENTER。 */
  horizontalOrigin?: Cesium.HorizontalOrigin | keyof typeof Cesium.HorizontalOrigin;
  /** 垂直对齐方式，默认 CENTER。 */
  verticalOrigin?: Cesium.VerticalOrigin | keyof typeof Cesium.VerticalOrigin;
  /** 深度检测距离。 */
  disableDepthTestDistance?: number;
  /** 可见距离。 */
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
}

/** 帧动画更新参数。 */
export type FrameAnimationEffectUpdateOptions = Partial<Omit<FrameAnimationEffectAddOptions, "id">>;

/** 已解析的帧动画参数。 */
interface ResolvedFrameAnimationEffectOptions extends FrameAnimationEffectAddOptions {
  /** 唯一 id。 */
  id: string;
  /** 世界坐标位置。 */
  cartesian: Cesium.Cartesian3;
  /** 图片帧地址集合。 */
  frames: string[];
  /** 一轮动画时长，单位：秒。 */
  duration: number;
  /** 是否循环播放。 */
  loop: boolean;
  /** 新增后是否自动播放。 */
  autoPlay: boolean;
  /** 是否显示。 */
  show: boolean;
}

/** 帧动画内部记录。 */
interface FrameAnimationEffectRecord {
  /** 所属 Viewer。 */
  viewer: Cesium.Viewer;
  /** 帧动画 id。 */
  id: string;
  /** Cesium Entity。 */
  entity: Cesium.Entity;
  /** 已解析参数。 */
  options: ResolvedFrameAnimationEffectOptions;
  /** 动画开始时间戳。 */
  startTime: number;
  /** 已播放时间，暂停后继续播放使用。 */
  pausedElapsed: number;
  /** 当前是否播放中。 */
  playing: boolean;
  /** 场景逐帧监听移除函数。 */
  removeRenderListener: () => void;
}

/** 图片预加载缓存。 */
const frameImageCache = new Map<string, HTMLImageElement[]>();

/** 帧动画特效管理器。 */
export default class FrameAnimationEffect {
  /** 兼容 new Class(viewer).add(options) 的默认 Viewer。 */
  private readonly defaultViewer?: Cesium.Viewer;
  /** 当前管理的帧动画记录。 */
  private readonly records = new Map<string, FrameAnimationEffectRecord>();

  constructor(viewer?: Cesium.Viewer) {
    this.defaultViewer = viewer;
  }

  /** 新增帧动画，返回特效 id。 */
  add(viewer: Cesium.Viewer, options: FrameAnimationEffectAddOptions): string | undefined;
  add(options: FrameAnimationEffectAddOptions): string | undefined;
  add(
    viewerOrOptions: Cesium.Viewer | FrameAnimationEffectAddOptions,
    maybeOptions?: FrameAnimationEffectAddOptions,
  ): string | undefined {
    const resolved = this.resolveViewerOptions(viewerOrOptions, maybeOptions);
    if (!resolved) return undefined;
    const id = resolved.options.id ?? createSpecialEffectId("frame-animation-effect");
    if (this.records.has(id)) return undefined;

    const options = this.resolveOptions({ ...resolved.options, id });
    const record = this.createRecord(resolved.viewer, id, options);
    this.records.set(id, record);
    requestSceneRender(resolved.viewer);
    return id;
  }

  /** 批量新增帧动画。 */
  addMany(viewer: Cesium.Viewer, options: FrameAnimationEffectAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 更新帧动画，涉及图片帧、位置或样式变化时会重建 Entity。 */
  update(id: string, options: FrameAnimationEffectUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecord(record);
    const nextOptions = this.resolveOptions({ ...record.options, ...options, id });
    const nextRecord = this.createRecord(record.viewer, id, nextOptions);
    this.records.set(id, nextRecord);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 播放或继续播放指定帧动画。 */
  play(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.playing = true;
    record.startTime = Date.now() - record.pausedElapsed;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 暂停指定帧动画。 */
  pause(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.pausedElapsed = Date.now() - record.startTime;
    record.playing = false;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 停止指定帧动画并回到第一帧。 */
  stop(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.playing = false;
    record.pausedElapsed = 0;
    record.startTime = Date.now();
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定帧动画显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.options.show = visible;
    record.entity.show = visible;
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定帧动画 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.records.get(id)?.entity;
  }

  /** 获取全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定帧动画。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    this.removeRecord(record);
    this.records.delete(id);
    return true;
  }

  /** 清空全部帧动画；传入 viewer 时只清空该 Viewer 下的帧动画。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部帧动画。 */
  destroy(): void {
    this.clear();
  }

  /** 合并默认值并生成帧图片地址。 */
  private resolveOptions(options: FrameAnimationEffectAddOptions & { id: string }): ResolvedFrameAnimationEffectOptions {
    const framePath = this.normalizeFramePath(options.framePath);
    const frameCount = Math.max(1, Math.floor(options.frameCount));
    const frames = this.buildFrameUrls({
      framePath,
      frameCount,
      extension: options.extension ?? "png",
      startIndex: options.startIndex ?? 1,
      filePrefix: options.filePrefix ?? "",
      fileSuffix: options.fileSuffix ?? "",
      framePadding: options.framePadding ?? 0,
    });
    this.preloadFrames(framePath, frames);
    return {
      ...options,
      framePath,
      frameCount,
      frames,
      cartesian: toCartesian3(options.position),
      duration: options.duration ?? 2,
      loop: options.loop ?? true,
      autoPlay: options.autoPlay ?? true,
      show: options.show ?? true,
    };
  }

  /** 创建帧动画内部记录。 */
  private createRecord(
    viewer: Cesium.Viewer,
    id: string,
    options: ResolvedFrameAnimationEffectOptions,
  ): FrameAnimationEffectRecord {
    let currentRecord: FrameAnimationEffectRecord | undefined;
    const imageProperty = new Cesium.CallbackProperty(() => {
      const record = this.records.get(id) ?? currentRecord;
      return record ? this.getFrameUrl(record) : options.frames[0];
    }, false);
    const entity = viewer.entities.add({
      id,
      name: "Frame Animation Effect",
      show: options.show,
      position: options.cartesian,
      billboard: {
        image: imageProperty,
        width: options.width,
        height: options.height,
        scale: options.scale,
        color: options.color ? toCesiumColor(options.color, Cesium.Color.WHITE) : undefined,
        horizontalOrigin: this.resolveHorizontalOrigin(options.horizontalOrigin),
        verticalOrigin: this.resolveVerticalOrigin(options.verticalOrigin),
        disableDepthTestDistance: options.disableDepthTestDistance,
        distanceDisplayCondition: options.distanceDisplayCondition,
      },
    });
    const listener = () => {
      if (this.records.get(id)?.playing) requestSceneRender(viewer);
    };
    viewer.scene.preRender.addEventListener(listener);
    currentRecord = {
      viewer,
      id,
      entity,
      options,
      startTime: Date.now(),
      pausedElapsed: 0,
      playing: options.autoPlay,
      removeRenderListener: () => viewer.scene.preRender.removeEventListener(listener),
    };
    return currentRecord;
  }

  /** 计算当前应该显示的帧图片。 */
  private getFrameUrl(record: FrameAnimationEffectRecord): string {
    const frames = record.options.frames;
    if (!record.playing) return frames[this.getPausedFrameIndex(record)] ?? frames[0]!;
    const elapsed = Date.now() - record.startTime;
    const durationMs = Math.max(0.1, record.options.duration) * 1000;
    const frameDuration = durationMs / frames.length;
    const rawIndex = Math.floor(elapsed / frameDuration);
    if (!record.options.loop && rawIndex >= frames.length) {
      record.playing = false;
      record.pausedElapsed = durationMs;
      return frames[frames.length - 1]!;
    }
    return frames[rawIndex % frames.length] ?? frames[0]!;
  }

  /** 获取暂停时对应的帧索引。 */
  private getPausedFrameIndex(record: FrameAnimationEffectRecord): number {
    const durationMs = Math.max(0.1, record.options.duration) * 1000;
    const frameDuration = durationMs / record.options.frames.length;
    return Math.min(record.options.frames.length - 1, Math.floor(record.pausedElapsed / frameDuration));
  }

  /** 生成帧图片地址集合。 */
  private buildFrameUrls(options: {
    framePath: string;
    frameCount: number;
    extension: string;
    startIndex: number;
    filePrefix: string;
    fileSuffix: string;
    framePadding: number;
  }): string[] {
    return Array.from({ length: options.frameCount }, (_, index) => {
      const frameIndex = options.startIndex + index;
      const filename = String(frameIndex).padStart(options.framePadding, "0");
      return `${options.framePath}${options.filePrefix}${filename}${options.fileSuffix}.${options.extension}`;
    });
  }

  /** 预加载帧图片，减少首次播放时的闪烁。 */
  private preloadFrames(cacheKey: string, frames: string[]): void {
    if (typeof Image === "undefined" || frameImageCache.has(cacheKey)) return;
    frameImageCache.set(
      cacheKey,
      frames.map((src) => {
        const image = new Image();
        image.src = src;
        return image;
      }),
    );
  }

  /** 标准化帧动画目录路径。 */
  private normalizeFramePath(path: string): string {
    return path.endsWith("/") ? path : `${path}/`;
  }

  /** 解析水平对齐方式。 */
  private resolveHorizontalOrigin(
    origin?: Cesium.HorizontalOrigin | keyof typeof Cesium.HorizontalOrigin,
  ): Cesium.HorizontalOrigin {
    if (typeof origin === "number") return origin;
    return origin ? Cesium.HorizontalOrigin[origin] : Cesium.HorizontalOrigin.CENTER;
  }

  /** 解析垂直对齐方式。 */
  private resolveVerticalOrigin(
    origin?: Cesium.VerticalOrigin | keyof typeof Cesium.VerticalOrigin,
  ): Cesium.VerticalOrigin {
    if (typeof origin === "number") return origin;
    return origin ? Cesium.VerticalOrigin[origin] : Cesium.VerticalOrigin.CENTER;
  }

  /** 兼容 add(viewer, options) 和 new Class(viewer).add(options) 两种调用方式。 */
  private resolveViewerOptions(
    viewerOrOptions: Cesium.Viewer | FrameAnimationEffectAddOptions,
    maybeOptions?: FrameAnimationEffectAddOptions,
  ): { viewer: Cesium.Viewer; options: FrameAnimationEffectAddOptions } | undefined {
    const viewer = maybeOptions ? (viewerOrOptions as Cesium.Viewer) : this.defaultViewer;
    const options = maybeOptions ?? (viewerOrOptions as FrameAnimationEffectAddOptions);
    return isValidViewer(viewer) ? { viewer, options } : undefined;
  }

  /** 从场景移除帧动画记录。 */
  private removeRecord(record: FrameAnimationEffectRecord): void {
    record.removeRenderListener();
    removeEntity(record.viewer, record.entity);
  }
}
