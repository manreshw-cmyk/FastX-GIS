/**
 * 半球雷达扫描批量绘制类。
 * 该特效由动态扫描墙和半球罩体组成，内部按 Entity 批量管理以保持扫描动画稳定。
 */
import * as Cesium from "cesium";
import HemisphereRadarScan, {
  HemisphereRadarScanAddOptions,
  HemisphereRadarScanUpdateOptions,
} from ".";

/** 半球雷达扫描批量绘制类。 */
export default class HemisphereRadarScanCollection {
  /** 复用单体类的动画和生命周期管理。 */
  private readonly delegate = new HemisphereRadarScan();

  /** 批量新增半球雷达扫描，返回成功创建的 id。 */
  addScans(viewer: Cesium.Viewer, options: HemisphereRadarScanAddOptions[]): string[] {
    return this.delegate.addScans(viewer, options);
  }

  /** 新增一个半球雷达扫描，返回效果 id。 */
  add(viewer: Cesium.Viewer, options: HemisphereRadarScanAddOptions): string | undefined {
    return this.delegate.add(viewer, options);
  }

  /** 更新指定半球雷达扫描。 */
  update(id: string, options: HemisphereRadarScanUpdateOptions): boolean {
    return this.delegate.update(id, options);
  }

  /** 设置指定半球雷达扫描显隐。 */
  show(id: string, visible: boolean): boolean {
    return this.delegate.show(id, visible);
  }

  /** 获取指定半球雷达扫描 Entity。 */
  get(id: string): Cesium.Entity | undefined {
    return this.delegate.get(id);
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return this.delegate.getAllIds(viewer);
  }

  /** 删除指定半球雷达扫描。 */
  remove(id: string): boolean {
    return this.delegate.remove(id);
  }

  /** 清空半球雷达扫描；传入 viewer 时只清空该地图。 */
  clear(viewer?: Cesium.Viewer): void {
    this.delegate.clear(viewer);
  }

  /** 销毁当前类管理的全部半球雷达扫描。 */
  destroy(): void {
    this.delegate.destroy();
  }
}
