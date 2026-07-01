/**
 * 环形雷达扫描批量绘制类。
 *
 * 批量入口复用单体 Entity 绘制实现，保证单个绘制和批量绘制的视觉效果与参数解析完全一致。
 */
import * as Cesium from "cesium";
import RingRadar, { type RingRadarAddOptions, type RingRadarUpdateOptions } from ".";

/** 环形雷达扫描批量绘制类。 */
export default class RingRadarCollection {
  private readonly delegate = new RingRadar();

  /** 新增一个环形雷达扫描，返回特效 id。 */
  add(viewer: Cesium.Viewer, options: RingRadarAddOptions): string | undefined {
    return this.delegate.add(viewer, options);
  }

  /** 批量新增环形雷达扫描，返回成功创建的 id。 */
  addMany(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    return this.delegate.addMany(viewer, options);
  }

  /** 批量新增环形雷达扫描，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    return this.delegate.addRadars(viewer, options);
  }

  /** 更新指定环形雷达扫描。 */
  update(id: string, options: RingRadarUpdateOptions): boolean {
    return this.delegate.update(id, options);
  }

  /** 设置指定环形雷达扫描显隐。 */
  show(id: string, visible: boolean): boolean {
    return this.delegate.show(id, visible);
  }

  /** 获取指定特效对应的 Entity 集合。 */
  get(id: string): Cesium.Entity[] | undefined {
    return this.delegate.get(id);
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return this.delegate.getAllIds(viewer);
  }

  /** 删除指定环形雷达扫描。 */
  remove(id: string): boolean {
    return this.delegate.remove(id);
  }

  /** 清空全部环形雷达扫描；传入 viewer 时只清空该 Viewer 下的特效。 */
  clear(viewer?: Cesium.Viewer): void {
    this.delegate.clear(viewer);
  }

  /** 销毁当前管理器中的全部环形雷达扫描。 */
  destroy(): void {
    this.delegate.destroy();
  }
}
