/**
 * 点 / 线 / 面缓冲分析（turf.buffer + 贴地 GroundPrimitive），由 MeasureType 区分几何类型。
 */
import * as Cesium from "cesium";
import { buffer, lineString, point, polygon } from "@turf/turf";
import type {
  LngLatHeightTuple,
  BufferAnalyzeOptions,
  MeasureCreateOptions,
  MeasureStyle,
} from "../types";
import { MeasureType, type MeasureTypeKey } from "../types";
import { MeasureBase } from "./MeasureBase";

/** 缓冲几何种类：点 / 线 / 面 */
type BufferGeomKind = "point" | "line" | "polygon";

/**
 * 缓冲分析默认样式（可通过 {@link MeasureCreateOptions.buffer} 或 {@link BufferAnalyze.setBufferOptions} 覆盖）。
 */
const DEFAULT_BUFFER_STYLE: Required<BufferAnalyzeOptions> = {
  /** 缓冲填充色（CSS 颜色字符串），默认 #e53935 */
  bufferFillColor: "#e53935",
  /** 缓冲填充透明度，范围 0~1，默认 0.45 */
  bufferFillAlpha: 0.45,
  /** 缓冲外轮廓线颜色（CSS），默认 #c62828 */
  bufferOutlineColor: "#c62828",
  /** 缓冲外轮廓线宽（像素），默认 2 */
  bufferOutlineWidth: 2,
  /** 源折线颜色（线缓冲、面缓冲绘制中），默认 #ffeb3b */
  sourceLineColor: "#ffeb3b",
  /** 源折线宽度（像素），默认 3 */
  sourceLineWidth: 3,
  /** 源面填充色（面缓冲内多边形），默认 #ff9800 */
  sourceFillColor: "#ff9800",
  /** 源面填充透明度，范围 0~1，默认 0.45 */
  sourceFillAlpha: 0.45,
  /** 是否绘制缓冲外轮廓线，默认 true */
  showBufferOutline: true,
};

/**
 * 由量算类型解析缓冲几何种类。
 * @param type 量算类型（点 / 线 / 面缓冲之一）
 */
function geomKindFromType(type: MeasureTypeKey): BufferGeomKind {
  switch (type) {
    case MeasureType.LINE_BUFFER_ANALYZE:
      return "line";
    case MeasureType.PLANE_BUFFER_ANALYZE:
      return "polygon";
    default:
      return "point";
  }
}

/**
 * 经纬高环转 Cesium `fromDegreesArrayHeights` 扁平数组。
 * @param ring 闭合或开口环顶点
 */
function ringToFlat(ring: LngLatHeightTuple[]): number[] {
  const flat: number[] = [];
  for (const p of ring) flat.push(p[0], p[1], p[2] ?? 0);
  return flat;
}

/**
 * 使用 turf.buffer 计算缓冲外环（输入半径为米，内部换算为千米）。
 * @param kind 几何种类
 * @param positions 源要素顶点
 * @param radiusMeters 缓冲半径（米）
 */
function turfBufferRing(
  kind: BufferGeomKind,
  positions: LngLatHeightTuple[],
  radiusMeters: number,
): LngLatHeightTuple[] | null {
  const km = radiusMeters / 1000;
  if (km <= 0 || positions.length < 1) return null;

  const coords = positions.map((p) => [p[0], p[1]] as [number, number]);
  const h = positions[0]?.[2] ?? 0;

  let feature;
  try {
    switch (kind) {
      case "point":
        feature = buffer(point(coords[0]!), km, {
          units: "kilometers",
          steps: 64,
        });
        break;
      case "line":
        if (coords.length < 2) return null;
        feature = buffer(lineString(coords), km, {
          units: "kilometers",
          steps: 16,
        });
        break;
      case "polygon": {
        if (coords.length < 3) return null;
        const ring = [...coords];
        const f = ring[0]!;
        const l = ring[ring.length - 1]!;
        if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
        feature = buffer(polygon([ring]), km, {
          units: "kilometers",
          steps: 16,
        });
        break;
      }
    }
  } catch {
    return null;
  }

  const outer =
    feature?.geometry?.type === "Polygon"
      ? feature.geometry.coordinates[0]
      : null;
  if (!outer || outer.length < 4) return null;
  return outer.map((c) => [c[0]!, c[1]!, h] as LngLatHeightTuple);
}

/**
 * 点 / 线 / 面统一缓冲分析。
 * 缓冲面由 {@link turfBufferRing} 计算，经 {@link GroundPrimitive} 贴地显示。
 */
export class BufferAnalyze extends MeasureBase {
  /** 几何种类：点 / 线 / 面（由构造时的 MeasureType 决定） */
  private readonly geomKind: BufferGeomKind;
  /** 缓冲半径（米） */
  private radiusMeters: number;
  /** 缓冲填充、轮廓及源要素样式 */
  private bufferStyle: Required<BufferAnalyzeOptions>;
  /** 缓冲填充贴地 GroundPrimitive */
  private fillPrimitive: Cesium.GroundPrimitive | null = null;
  /** 缓冲外轮廓贴地 GroundPolylinePrimitive */
  private outlinePrimitive: Cesium.GroundPolylinePrimitive | null = null;

  /**
   * @param options 创建选项；`type` 区分点 / 线 / 面，`bufferWidth` 为半径（米），`buffer` 覆盖默认样式
   */
  constructor(options: MeasureCreateOptions) {
    const geomKind = geomKindFromType(options.type);
    const radiusMeters = Math.max(10, options.bufferWidth ?? 1000);
    const bufferStyle = { ...DEFAULT_BUFFER_STYLE, ...options.buffer };
    const initPositions = options.positions;
    const initPosition = options.position;
    super({
      ...options,
      positions: undefined,
      position: undefined,
      clampToGround: true,
    });
    this.geomKind = geomKind;
    this.radiusMeters = radiusMeters;
    this.bufferStyle = bufferStyle;
    if (initPositions?.length) this.setPositions(initPositions);
    if (initPosition) this.setPosition(initPosition);
  }

  /**
   * 设置源要素顶点并刷新缓冲几何。
   * @param positions 点 1 个、线 ≥2 个、面 ≥3 个
   */
  setPositions(positions: LngLatHeightTuple[]): void {
    this.positions = [...positions];
    this.syncKeyPoints(this.positions);
    this.redraw(this.positions);
  }

  /**
   * 设置单点位置（点缓冲专用，等价于 `setPositions([position])`）。
   * @param position 中心点 [经度, 纬度, 高程]
   */
  setPosition(position: LngLatHeightTuple): void {
    if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) return;
    this.setPositions([position]);
  }

  /**
   * 鼠标移动预览（点缓冲无预览；线 / 面在末点跟随光标）。
   * @param cursor 当前光标经纬高
   */
  update(cursor: LngLatHeightTuple): void {
    if (this.geomKind === "point" || this.positions.length < 1) return;
    this.redraw([...this.positions, cursor]);
  }

  /** 绘制结束，固定最终缓冲结果（右键 / 双击后由 MeasureTool 调用）。 */
  complete(): void {
    this.redraw(this.positions);
  }

  /**
   * 合并量算通用样式并刷新显示。
   * @param partial 待覆盖的 {@link MeasureStyle} 字段
   */
  setStyle(partial: Partial<MeasureStyle>): void {
    super.setStyle(partial);
    if (this.positions.length > 0) this.redraw(this.positions);
  }

  /**
   * 运行时修改缓冲半径或缓冲 / 源要素颜色等。
   * @param partial 缓冲样式；`bufferWidth` 为半径（米）
   */
  setBufferOptions(
    partial: Partial<BufferAnalyzeOptions> & { bufferWidth?: number },
  ): void {
    if (partial.bufferWidth !== undefined)
      this.radiusMeters = Math.max(10, partial.bufferWidth);
    const { bufferWidth: _w, ...style } = partial;
    Object.assign(this.bufferStyle, style);
    if (this.positions.length > 0) this.redraw(this.positions);
  }

  /** 清除缓冲 Primitive 与基类 Entity。 */
  clear(): void {
    this.clearBufferPrimitives();
    super.clear();
  }

  /**
   * 按几何类型重绘源要素与缓冲 Primitive。
   * @param positions 当前顶点（预览时含光标点）
   */
  private redraw(positions: LngLatHeightTuple[]): void {
    this.clearDynamicLine();
    this.clearDynamicPolygon();
    this.clearBufferPrimitives();

    const r = this.radiusMeters;
    const tail = positions[positions.length - 1];

    switch (this.geomKind) {
      case "point":
        if (positions.length < 1) return;
        this.drawBufferPrimitive(positions, r);
        this.updateMeasureLabel(positions[0]!, `点缓冲 ${r} m`);
        break;
      case "line":
        if (positions.length < 2) return;
        this.setDynamicLinePositions(positions, {
          clamp: true,
          color: this.bufferStyle.sourceLineColor,
          width: this.bufferStyle.sourceLineWidth,
        });
        this.drawBufferPrimitive(positions, r);
        if (tail) this.updateMeasureLabel(tail, `线缓冲 ${r} m`);
        break;
      case "polygon":
        if (positions.length >= 3) {
          this.setDynamicPolygon(
            positions,
            true,
            this.bufferStyle.sourceFillColor,
            this.bufferStyle.sourceFillAlpha,
          );
          this.drawBufferPrimitive(positions, r);
          if (tail) this.updateMeasureLabel(tail, `面缓冲 ${r} m`);
        } else if (positions.length === 2) {
          this.setDynamicLinePositions(positions, {
            clamp: true,
            color: this.bufferStyle.sourceLineColor,
            width: this.bufferStyle.sourceLineWidth,
          });
        }
        break;
    }
  }

  /**
   * 绘制缓冲环：GroundPrimitive 填充，可选 GroundPolylinePrimitive 外轮廓。
   * @param source 用于 turf 计算的源顶点
   * @param radiusMeters 缓冲半径（米）
   */
  private drawBufferPrimitive(
    source: LngLatHeightTuple[],
    radiusMeters: number,
  ): void {
    const ring = turfBufferRing(this.geomKind, source, radiusMeters);
    if (!ring) return;

    const flat = ringToFlat(ring);
    if (flat.length < 9) return;

    const fillColor = Cesium.Color.fromCssColorString(
      this.bufferStyle.bufferFillColor,
    ).withAlpha(this.bufferStyle.bufferFillAlpha);
    const lineColor = Cesium.Color.fromCssColorString(
      this.bufferStyle.bufferOutlineColor,
    );
    const ground = this.viewer.scene.groundPrimitives;

    this.fillPrimitive = new Cesium.GroundPrimitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: Cesium.PolygonGeometry.fromPositions({
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(flat),
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new Cesium.MaterialAppearance({
        material: Cesium.Material.fromType("Color", { color: fillColor }),
      }),
      asynchronous: false,
    });
    ground.add(this.fillPrimitive);

    if (this.bufferStyle.showBufferOutline) {
      const outlineFlat = ringToFlat([...ring, ring[0]!]);
      this.outlinePrimitive = new Cesium.GroundPolylinePrimitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.GroundPolylineGeometry({
            positions: Cesium.Cartesian3.fromDegreesArrayHeights(outlineFlat),
            width: this.bufferStyle.bufferOutlineWidth,
          }),
        }),
        appearance: new Cesium.PolylineMaterialAppearance({
          material: Cesium.Material.fromType("Color", { color: lineColor }),
        }),
        asynchronous: false,
      });
      ground.add(this.outlinePrimitive);
    }
    this.requestRender();
  }

  /** 从 `groundPrimitives` 移除缓冲填充与轮廓 Primitive。 */
  private clearBufferPrimitives(): void {
    if (this.viewer.isDestroyed()) {
      this.fillPrimitive = null;
      this.outlinePrimitive = null;
      return;
    }
    const ground = this.viewer.scene.groundPrimitives;
    if (this.fillPrimitive) ground.remove(this.fillPrimitive);
    if (this.outlinePrimitive) ground.remove(this.outlinePrimitive);
    this.fillPrimitive = null;
    this.outlinePrimitive = null;
  }
}
