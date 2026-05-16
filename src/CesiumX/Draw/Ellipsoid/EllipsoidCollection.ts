import * as Cesium from "cesium";
import type { Viewer } from "cesium";
import { createRandomXgxId } from "../../Coordinates";

/** 批量椭球体添加入参 */
export interface EllipsoidCollectionAddItem {
  id?: string;
  /** 中心点位置 [经度, 纬度, 高度] */
  positions: number[];
  /** 半径 [x, y, z] 米，默认 [10000, 10000, 10000] */
  radii?: [number, number, number];
  show?: boolean;
  /** 填充颜色 CSS 字符串 */
  color?: string;
  /** 填充透明度 0-1 */
  alpha?: number;
  /** 轮廓开关 */
  outline?: boolean;
  /** 轮廓颜色 CSS 字符串 */
  outlineColor?: string;
  /** 轮廓透明度 0-1 */
  outlineAlpha?: number;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 业务数据 */
  targetData?: Record<string, unknown>;
}

/** 更新椭球体属性 */
export interface EllipsoidCollectionUpdateProps {
  longitude?: number;
  latitude?: number;
  height?: number;
  radii?: [number, number, number];
  color?: string;
  alpha?: number;
  outline?: boolean;
  outlineColor?: string;
  outlineAlpha?: number;
  outlineWidth?: number;
  show?: boolean;
  targetData?: Record<string, unknown>;
}

export interface EllipsoidCollectionUpdateEntry extends EllipsoidCollectionUpdateProps {
  id: string;
}

/** 椭球体快照 */
export interface EllipsoidCollectionSnapshot {
  id: string;
  longitude: number;
  latitude: number;
  height: number;
  radii: Cesium.Cartesian3;
  color: Cesium.Color;
  outline: boolean;
  outlineColor: Cesium.Color;
  outlineWidth: number;
  show: boolean;
  targetData: Record<string, unknown>;
}

/** 扩展的椭球体 Primitive（自定义） */
interface EllipsoidPrimitiveMeta {
  id: string;
  position: Cesium.Cartesian3;
  radii: Cesium.Cartesian3;
  material: Cesium.Material;
  outlineColor: Cesium.Color;
  outlineWidth: number;
  show: boolean;
  _targetData?: Record<string, unknown>;
  _primitive: Cesium.Primitive;
  update: () => void;
}

type Bucket = {
  /** 存储自定义椭球体 Primitive */
  primitives: Map<string, EllipsoidPrimitiveMeta>;
};

/**
 * 创建椭球体几何实例
 */
function createEllipsoidGeometry(
  radii: Cesium.Cartesian3,
): Cesium.GeometryInstance {
  return new Cesium.GeometryInstance({
    geometry: new Cesium.EllipsoidGeometry({
      radii: radii,
      vertexFormat: Cesium.VertexFormat.DEFAULT,
    }),
    modelMatrix: Cesium.Matrix4.IDENTITY,
  });
}

/**
 * 创建椭球体材质
 */
function createEllipsoidMaterial(color: Cesium.Color): Cesium.Material {
  return Cesium.Material.fromType("Color", {
    color: color,
  });
}

/**
 * 创建完整的椭球体 Primitive
 */
function createEllipsoidPrimitive(
  _viewer: Viewer,
  position: Cesium.Cartesian3,
  radii: Cesium.Cartesian3,
  color: Cesium.Color,
  _outlineColor: Cesium.Color,
  _outlineWidth: number,
): Cesium.Primitive {
  const geometryInstance = createEllipsoidGeometry(radii);
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);
  geometryInstance.modelMatrix = modelMatrix;

  const appearance = new Cesium.MaterialAppearance({
    material: createEllipsoidMaterial(color),
    translucent: color.alpha < 1.0,
    faceForward: true,
  });

  return new Cesium.Primitive({
    geometryInstances: geometryInstance,
    appearance: appearance,
    asynchronous: false,
    show: true,
  });
}

/**
 * 批量椭球体（使用 Primitive 实现）
 * 每个椭球体独立渲染，支持单独控制样式
 */
export default class EllipsoidCollection {
  private readonly buckets = new Map<Viewer, Bucket>();
  private readonly idOwner = new Map<string, Viewer>();

  /**
   * 确保 Viewer 对应的桶存在
   */
  private ensureBucket(viewer: Viewer): Bucket | undefined {
    if (viewer.isDestroyed()) return undefined;
    let b = this.buckets.get(viewer);
    if (!b) {
      b = { primitives: new Map() };
      this.buckets.set(viewer, b);
    }
    return b;
  }

  /**
   * 解析 ID 对应的椭球体
   */
  private resolve(
    id: string,
  ):
    | { viewer: Viewer; bucket: Bucket; prim: EllipsoidPrimitiveMeta }
    | undefined {
    const viewer = this.idOwner.get(id);
    if (!viewer || viewer.isDestroyed()) {
      this.idOwner.delete(id);
      return undefined;
    }
    const bucket = this.buckets.get(viewer);
    const prim = bucket?.primitives.get(id);
    if (!bucket || !prim) {
      this.idOwner.delete(id);
      return undefined;
    }
    return { viewer, bucket, prim };
  }

  /**
   * 添加批量椭球体
   * @returns 成功创建的 ID 列表
   */
  addEllipsoids(
    viewer: Viewer,
    options: EllipsoidCollectionAddItem[],
  ): string[] {
    if (!Array.isArray(options) || options.length === 0) return [];
    if (viewer.isDestroyed()) return [];

    const b = this.ensureBucket(viewer);
    if (!b) return [];

    const createdIds: string[] = [];

    for (let index = 0; index < options.length; index++) {
      const item = options[index]!;
      const {
        id = createRandomXgxId("ec"),
        positions,
        radii: radiiArr = [10000, 10000, 10000],
        show = true,
        color = "#3399ff",
        alpha = 0.6,
        outline: _outline = true,
        outlineColor = "#ffffff",
        outlineAlpha = 0.8,
        outlineWidth = 2,
        targetData = {},
      } = item;

      if (!Array.isArray(positions) || positions.length < 2) {
        console.warn(`EllipsoidCollection: 第${index}个椭球体位置无效，跳过`);
        continue;
      }

      // 检查 ID 是否已存在
      if (this.idOwner.has(id)) {
        console.warn(`EllipsoidCollection: ID "${id}" 已存在，跳过`);
        continue;
      }

      try {
        // 解析位置
        const height = positions[2] !== undefined ? positions[2] : 0;
        const position = Cesium.Cartesian3.fromDegrees(
          positions[0],
          positions[1],
          height,
        );

        // 解析半径
        const radii = new Cesium.Cartesian3(
          radiiArr[0],
          radiiArr[1],
          radiiArr[2],
        );

        // 解析颜色
        const fillColor =
          Cesium.Color.fromCssColorString(color).withAlpha(alpha);
        const outlineCol =
          Cesium.Color.fromCssColorString(outlineColor).withAlpha(outlineAlpha);

        // 创建 Primitive
        const primitive = createEllipsoidPrimitive(
          viewer,
          position,
          radii,
          fillColor,
          outlineCol,
          outlineWidth,
        );

        // 添加到场景
        viewer.scene.primitives.add(primitive);

        // 存储元数据
        const meta: EllipsoidPrimitiveMeta = {
          id,
          position,
          radii,
          material: primitive.appearance.material,
          outlineColor: outlineCol,
          outlineWidth,
          show,
          _targetData: { ...targetData },
          _primitive: primitive,
          update: () => {
            // 更新方法，用于后续属性变更时重新生成 Primitive
            const newPrimitive = createEllipsoidPrimitive(
              viewer,
              meta.position,
              meta.radii,
              fillColor,
              outlineCol,
              outlineWidth,
            );
            newPrimitive.show = meta.show;
            viewer.scene.primitives.remove(primitive);
            viewer.scene.primitives.add(newPrimitive);
            meta._primitive = newPrimitive;
            meta.material = newPrimitive.appearance.material;
          },
        };

        primitive.show = show;
        b.primitives.set(id, meta);
        this.idOwner.set(id, viewer);
        createdIds.push(id);
      } catch (error) {
        console.error(
          `EllipsoidCollection: 添加第${index}个椭球体失败:`,
          error,
        );
      }
    }

    return createdIds;
  }

  /**
   * 更新单个椭球体
   */
  updateEllipsoid(
    id: string,
    properties: EllipsoidCollectionUpdateProps,
  ): boolean {
    const hit = this.resolve(id);
    if (!hit) return false;
    const { prim, viewer } = hit;

    let needsUpdate = false;
    let newPosition = prim.position;
    let newRadii = prim.radii;
    let newColor = (prim._primitive.appearance.material as Cesium.Material)
      .uniforms.color as Cesium.Color;
    let newOutlineColor = prim.outlineColor;
    let newOutlineWidth = prim.outlineWidth;

    // 更新位置
    if (
      properties.longitude !== undefined &&
      properties.latitude !== undefined
    ) {
      const height = properties.height !== undefined ? properties.height : 0;
      newPosition = Cesium.Cartesian3.fromDegrees(
        properties.longitude,
        properties.latitude,
        height,
      );
      needsUpdate = true;
    }

    // 更新半径
    if (
      properties.radii !== undefined &&
      Array.isArray(properties.radii) &&
      properties.radii.length === 3
    ) {
      newRadii = new Cesium.Cartesian3(
        properties.radii[0],
        properties.radii[1],
        properties.radii[2],
      );
      needsUpdate = true;
    }

    // 更新填充颜色
    let newAlpha = newColor.alpha;
    if (properties.color !== undefined) {
      const alpha =
        properties.alpha !== undefined ? properties.alpha : newAlpha;
      newColor = Cesium.Color.fromCssColorString(properties.color).withAlpha(
        alpha,
      );
      needsUpdate = true;
    } else if (properties.alpha !== undefined) {
      newColor = newColor.withAlpha(properties.alpha);
      needsUpdate = true;
    }

    // 更新轮廓颜色
    let newOutlineAlpha = prim.outlineColor.alpha;
    if (properties.outlineColor !== undefined) {
      const oa =
        properties.outlineAlpha !== undefined
          ? properties.outlineAlpha
          : newOutlineAlpha;
      newOutlineColor = Cesium.Color.fromCssColorString(
        properties.outlineColor,
      ).withAlpha(oa);
      needsUpdate = true;
    } else if (properties.outlineAlpha !== undefined) {
      newOutlineColor = newOutlineColor.withAlpha(properties.outlineAlpha);
      needsUpdate = true;
    }

    // 更新轮廓宽度
    if (properties.outlineWidth !== undefined) {
      newOutlineWidth = properties.outlineWidth;
      needsUpdate = true;
    }

    // 重新生成 Primitive
    if (needsUpdate) {
      const newPrimitive = createEllipsoidPrimitive(
        viewer,
        newPosition,
        newRadii,
        newColor,
        newOutlineColor,
        newOutlineWidth,
      );
      newPrimitive.show =
        properties.show !== undefined ? properties.show : prim.show;

      // 替换旧 Primitive
      viewer.scene.primitives.remove(prim._primitive);
      viewer.scene.primitives.add(newPrimitive);

      // 更新元数据
      prim.position = newPosition;
      prim.radii = newRadii;
      prim._primitive = newPrimitive;
      prim.material = newPrimitive.appearance.material;
      prim.outlineColor = newOutlineColor;
      prim.outlineWidth = newOutlineWidth;
    }

    // 更新显隐
    if (properties.show !== undefined) {
      prim.show = properties.show;
      prim._primitive.show = properties.show;
    }

    // 更新业务数据
    if (properties.targetData !== undefined) {
      prim._targetData = {
        ...(prim._targetData ?? {}),
        ...properties.targetData,
      };
    }

    return true;
  }

  /**
   * 批量更新椭球体
   */
  updateEllipsoids(
    updates: EllipsoidCollectionUpdateEntry[],
  ): Array<{ id: string; success: boolean }> {
    if (!Array.isArray(updates)) return [];
    return updates.map(({ id, ...rest }) => ({
      id,
      success: this.updateEllipsoid(id, rest),
    }));
  }

  /**
   * 获取椭球体快照
   */
  getEllipsoid(id: string): EllipsoidCollectionSnapshot | null {
    const hit = this.resolve(id);
    if (!hit) return null;
    const { prim } = hit;

    const cartographic = Cesium.Cartographic.fromCartesian(prim.position);
    const materialColor = (
      prim._primitive.appearance.material as Cesium.Material
    ).uniforms.color as Cesium.Color;

    return {
      id: prim.id,
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
      height: cartographic.height,
      radii: prim.radii,
      color: materialColor,
      outline: prim.outlineWidth > 0,
      outlineColor: prim.outlineColor,
      outlineWidth: prim.outlineWidth,
      show: prim.show,
      targetData: { ...(prim._targetData ?? {}) },
    };
  }

  /**
   * 获取数量
   */
  getCount(viewer?: Viewer): number {
    if (viewer) {
      const b = this.buckets.get(viewer);
      return b ? b.primitives.size : 0;
    }
    return this.idOwner.size;
  }

  /**
   * 获取所有 ID
   */
  getAllIds(viewer?: Viewer): string[] {
    if (!viewer) return [...this.idOwner.keys()];
    const b = this.buckets.get(viewer);
    if (!b) return [];
    return [...b.primitives.keys()];
  }

  /**
   * 获取所有椭球体快照
   */
  getAllEllipsoids(viewer?: Viewer): EllipsoidCollectionSnapshot[] {
    const out: EllipsoidCollectionSnapshot[] = [];
    const ids = this.getAllIds(viewer);
    for (const id of ids) {
      const e = this.getEllipsoid(id);
      if (e) out.push(e);
    }
    return out;
  }

  /**
   * 设置所有椭球体显隐
   */
  setAllVisibility(show: boolean, viewer?: Viewer): void {
    const walk = (b: Bucket) => {
      b.primitives.forEach((prim) => {
        prim.show = show;
        prim._primitive.show = show;
      });
    };
    if (viewer) {
      const b = this.buckets.get(viewer);
      if (b) walk(b);
      return;
    }
    this.buckets.forEach(walk);
  }

  /**
   * 设置指定椭球体显隐
   */
  setSpecifyVisibility(id: string, show: boolean): void {
    const hit = this.resolve(id);
    if (!hit || hit.prim.show === show) return;
    hit.prim.show = show;
    hit.prim._primitive.show = show;
  }

  /**
   * 移除单个椭球体
   */
  remove(id: string): void {
    const hit = this.resolve(id);
    if (!hit) return;
    const { viewer, bucket, prim } = hit;
    if (!viewer.isDestroyed()) {
      viewer.scene.primitives.remove(prim._primitive);
    }
    bucket.primitives.delete(id);
    this.idOwner.delete(id);
  }

  /**
   * 移除所有椭球体
   */
  removeAll(viewer?: Viewer): void {
    if (viewer !== undefined) {
      const b = this.buckets.get(viewer);
      if (!b) return;
      for (const prim of b.primitives.values()) {
        if (!viewer.isDestroyed()) {
          viewer.scene.primitives.remove(prim._primitive);
        }
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id);
      b.primitives.clear();
      return;
    }
    for (const [v, b] of this.buckets) {
      if (!v.isDestroyed()) {
        for (const prim of b.primitives.values()) {
          v.scene.primitives.remove(prim._primitive);
        }
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id);
    }
    this.buckets.clear();
  }

  /** 与 `Draw/*Collection.clear` 命名一致，按 Viewer 清空或清空全部 */
  clear(viewer?: Viewer): void {
    this.removeAll(viewer);
  }

  /**
   * 移除已销毁 Viewer 对应的桶
   */
  pruneInvalid(): number {
    let n = 0;
    for (const [viewer, b] of [...this.buckets]) {
      if (viewer.isDestroyed()) {
        for (const id of b.primitives.keys()) this.idOwner.delete(id);
        this.buckets.delete(viewer);
        n++;
      }
    }
    return n;
  }

  /**
   * 销毁所有资源
   */
  destroy(): void {
    for (const [viewer, b] of this.buckets) {
      if (!viewer.isDestroyed()) {
        for (const prim of b.primitives.values()) {
          viewer.scene.primitives.remove(prim._primitive);
        }
      }
      for (const id of b.primitives.keys()) this.idOwner.delete(id);
    }
    this.buckets.clear();
  }
}
