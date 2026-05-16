import * as Cesium from "cesium";
import type { Color, Entity, Property, Viewer } from "cesium";
import { createRandomXgxId, type LngLatHeight } from "../../Coordinates";

/** 点位置：世界坐标或经纬度（度）+ 高（米） */
export type PositionInput = Cesium.Cartesian3 | LngLatHeight;

/** 椭球体样式（与 `EllipsoidGraphics` 常用字段对齐） */
export interface EllipsoidStyleOptions {
  /** 立方体各方向半径（米），默认 [10000, 10000, 10000] */
  radii?: Cesium.Cartesian3;
  /** 填充材质颜色 */
  material?: Color | Cesium.Material;
  /** 轮廓颜色 */
  outlineColor?: Color;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否与地形贴合 */
  heightReference?: Cesium.HeightReference;
  /** 距离显示条件 */
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  /** 是否显示 */
  show?: boolean;
  /** 透明度（0-1） */
  alpha?: number;
}

/**
 * 添加椭球体参数
 */
export interface AddEllipsoidOptions {
  id?: string;
  /** 中心点位置 */
  position: PositionInput;
  /** 椭球体样式 */
  style?: EllipsoidStyleOptions;
  /** CSS 颜色字符串（优先级低于 style.material） */
  color?: string;
  /** 透明度（0-1） */
  alpha?: number;
  /** 半径（快捷设置，如果同时指定 radii，则优先 style.radii） */
  radii?: Cesium.Cartesian3 | number;
  /** 是否显示轮廓 */
  outline?: boolean;
  /** 轮廓颜色（CSS 颜色字符串） */
  outlineColor?: string;
  /** 轮廓透明度 */
  outlineAlpha?: number;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否显示 */
  show?: boolean;
  /** 描述信息 */
  description?: string;
  /** 业务自定义数据 */
  targetData?: Record<string, unknown>;
}

/**
 * 更新椭球体参数
 */
export interface UpdateEllipsoidProperties {
  /** 中心点位置 */
  position?: PositionInput;
  /** 半径 */
  radii?: Cesium.Cartesian3 | number;
  /** 材质主色 */
  color?: string | Color;
  /** 材质透明度 */
  alpha?: number;
  /** 轮廓开关 */
  outline?: boolean;
  /** 轮廓颜色 */
  outlineColor?: string | Color;
  /** 轮廓透明度 */
  outlineAlpha?: number;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否显示 */
  show?: boolean;
  /** 描述 */
  description?: string;
  /** 业务数据 */
  targetData?: Record<string, unknown>;
  /** 完整样式 */
  style?: EllipsoidStyleOptions;
}

/** 椭球体数据快照 */
export interface EllipsoidSnapshot {
  id: string;
  /** 中心点经度（度） */
  longitude: number;
  /** 中心点纬度（度） */
  latitude: number;
  /** 中心点高度（米） */
  height: number;
  /** 半径（米） */
  radii: { x: number; y: number; z: number };
  /** 材质颜色（CSS 格式） */
  materialCss?: string;
  /** 轮廓颜色（CSS 格式） */
  outlineColorCss?: string;
  /** 轮廓宽度 */
  outlineWidth?: number;
  /** 是否启用轮廓（采样自 `EllipsoidGraphics.outline`） */
  outline?: boolean;
  /** 是否显示 */
  show: boolean;
  /** 业务数据 */
  targetData: Record<string, unknown>;
  /** 描述 */
  description?: string;
}

interface EllipsoidRecord {
  viewer: Viewer;
  entity: Entity;
  targetData: Record<string, unknown>;
}

/**
 * CSS 颜色字符串转 Cesium.Color
 */
function colorFromString(css: string, alpha = 1): Color {
  return Cesium.Color.fromCssColorString(css).withAlpha(alpha);
}

/**
 * 统一转换为 Cesium.Color
 */
function toColor(
  c: string | Color | undefined,
  alpha?: number,
): Color | undefined {
  if (c === undefined) return undefined;
  if (c instanceof Cesium.Color) {
    return alpha !== undefined ? c.withAlpha(alpha) : c;
  }
  return colorFromString(c, alpha ?? 1);
}

/**
 * 位置转 Cartesian3
 */
function toCartesian3(
  position: PositionInput,
  result = new Cesium.Cartesian3(),
): Cesium.Cartesian3 {
  if (position instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(position, result);
  }
  const h = position.height ?? 0;
  return Cesium.Cartesian3.fromDegrees(
    position.longitude,
    position.latitude,
    h,
    undefined,
    result,
  );
}

/**
 * 解析半径（统一转换为 Cartesian3）
 */
function resolveRadii(radii?: Cesium.Cartesian3 | number): Cesium.Cartesian3 {
  if (!radii) return new Cesium.Cartesian3(10000, 10000, 10000);
  if (radii instanceof Cesium.Cartesian3) {
    return Cesium.Cartesian3.clone(radii);
  }
  return new Cesium.Cartesian3(radii, radii, radii);
}

/**
 * 合并样式到 EllipsoidGraphics
 */
function mergeEllipsoidGraphics(
  ellipsoidGraphics: Cesium.EllipsoidGraphics,
  style: EllipsoidStyleOptions | undefined,
  options: {
    outline?: boolean;
    outlineWidth?: number;
    color?: string;
    alpha?: number;
    outlineColor?: string;
    outlineAlpha?: number;
  },
  isCreate: boolean,
): void {
  // 半径
  if (style?.radii !== undefined) {
    ellipsoidGraphics.radii = new Cesium.ConstantProperty(
      Cesium.Cartesian3.clone(style.radii),
    );
  }

  // 材质颜色
  let material: Color | Cesium.Material | undefined = style?.material;
  if (!material && options.color) {
    const col = toColor(options.color, options.alpha);
    if (col) material = col;
  }
  if (material !== undefined) {
    ellipsoidGraphics.material =
      material instanceof Cesium.Color
        ? new Cesium.ColorMaterialProperty(material)
        : (material as unknown as Cesium.MaterialProperty);
  } else if (isCreate) {
    ellipsoidGraphics.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.CORNFLOWERBLUE.withAlpha(0.6),
    );
  }

  // 轮廓颜色
  let outlineCol: Color | undefined = style?.outlineColor;
  if (!outlineCol && options.outlineColor) {
    outlineCol = toColor(options.outlineColor, options.outlineAlpha);
  }
  if (outlineCol !== undefined) {
    ellipsoidGraphics.outlineColor = new Cesium.ConstantProperty(outlineCol);
  } else if (isCreate && options.outline !== false) {
    ellipsoidGraphics.outlineColor = new Cesium.ConstantProperty(
      Cesium.Color.WHITE,
    );
  }

  // 轮廓宽度
  let outlineW = style?.outlineWidth;
  if (outlineW === undefined && options.outlineWidth !== undefined) {
    outlineW = options.outlineWidth;
  }
  if (options.outline === false) {
    ellipsoidGraphics.outlineWidth = new Cesium.ConstantProperty(0);
  } else if (outlineW !== undefined) {
    ellipsoidGraphics.outlineWidth = new Cesium.ConstantProperty(outlineW);
  } else if (isCreate) {
    ellipsoidGraphics.outlineWidth = new Cesium.ConstantProperty(1);
  }

  // Cesium EllipsoidGraphics 默认 outline=false，不显式开启则轮廓颜色/线宽均不会渲染
  if (isCreate) {
    const wVal =
      sampleProperty<number>(ellipsoidGraphics.outlineWidth) ?? 0;
    ellipsoidGraphics.outline = new Cesium.ConstantProperty(
      options.outline !== false && wVal > 0,
    );
  } else {
    if (options.outline === false) {
      ellipsoidGraphics.outline = new Cesium.ConstantProperty(false);
    } else if (options.outlineWidth !== undefined) {
      ellipsoidGraphics.outline = new Cesium.ConstantProperty(
        options.outlineWidth > 0,
      );
    } else if (options.outline === true) {
      ellipsoidGraphics.outline = new Cesium.ConstantProperty(true);
      const wNow =
        sampleProperty<number>(ellipsoidGraphics.outlineWidth) ?? 0;
      if (wNow <= 0) {
        ellipsoidGraphics.outlineWidth = new Cesium.ConstantProperty(1);
      }
    }
  }

  // 高程参考
  if (style?.heightReference !== undefined) {
    ellipsoidGraphics.heightReference = new Cesium.ConstantProperty(
      style.heightReference,
    );
  }

  // 距离显示条件
  if (style?.distanceDisplayCondition !== undefined) {
    ellipsoidGraphics.distanceDisplayCondition = new Cesium.ConstantProperty(
      style.distanceDisplayCondition,
    );
  }
}

/**
 * 从 Entity 中提取属性值
 */
function sampleProperty<T>(
  p: Property | undefined,
  time = Cesium.JulianDate.now(),
): T | undefined {
  if (!p || typeof (p as Cesium.Property).getValue !== "function")
    return undefined;
  return (p as Cesium.Property).getValue(time) as T | undefined;
}

/**
 * ColorMaterialProperty.getValue 返回形如 `{ color: Color }`，不能直接当作 Color
 */
function sampleFillColorFromMaterial(
  mp: Cesium.MaterialProperty | undefined,
  time = Cesium.JulianDate.now(),
): Color | undefined {
  if (!mp || typeof (mp as Cesium.Property).getValue !== "function")
    return undefined;
  if (mp instanceof Cesium.ColorMaterialProperty) {
    const raw = mp.getValue(time) as { color?: Color } | Color | undefined;
    if (!raw) return undefined;
    if (raw instanceof Cesium.Color) return raw;
    if (
      typeof raw === "object" &&
      "color" in raw &&
      (raw as { color: Color }).color instanceof Cesium.Color
    ) {
      return (raw as { color: Color }).color;
    }
    return undefined;
  }
  const v = (mp as Cesium.Property).getValue(time) as
    | Color
    | { color?: Color }
    | undefined;
  if (v instanceof Cesium.Color) return v;
  if (
    v &&
    typeof v === "object" &&
    "color" in v &&
    (v as { color: Color }).color instanceof Cesium.Color
  ) {
    return (v as { color: Color }).color;
  }
  return undefined;
}

/** 将表单常用样式写入 targetData，便于列表选中后回显（不依赖材质采样） */
function echoStyleFieldsFromAddOptions(
  options: AddEllipsoidOptions,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof options.color === "string" && options.color.trim()) {
    out.color = options.color.trim();
  }
  if (
    typeof options.outlineColor === "string" &&
    options.outlineColor.trim()
  ) {
    out.outlineColor = options.outlineColor.trim();
  }
  if (
    options.outlineAlpha !== undefined &&
    Number.isFinite(options.outlineAlpha)
  ) {
    out.outlineAlpha = options.outlineAlpha;
  }
  if (options.outline !== undefined) out.outline = options.outline;
  if (
    options.outlineWidth !== undefined &&
    Number.isFinite(options.outlineWidth)
  ) {
    out.outlineWidth = options.outlineWidth;
  }
  return out;
}

function echoStyleFieldsFromUpdate(
  p: UpdateEllipsoidProperties,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof p.color === "string" && p.color.trim()) {
    out.color = p.color.trim();
  }
  if (typeof p.outlineColor === "string" && p.outlineColor.trim()) {
    out.outlineColor = p.outlineColor.trim();
  }
  if (p.outlineAlpha !== undefined && Number.isFinite(p.outlineAlpha)) {
    out.outlineAlpha = p.outlineAlpha;
  }
  if (p.outline !== undefined) out.outline = p.outline;
  if (p.outlineWidth !== undefined && Number.isFinite(p.outlineWidth)) {
    out.outlineWidth = p.outlineWidth;
  }
  return out;
}

/**
 * 颜色转 CSS 字符串
 */
function colorToCss(c: Color | undefined): string | undefined {
  if (!c) return undefined;
  return typeof (c as { toCssColorString?: () => string }).toCssColorString ===
    "function"
    ? (c as Color & { toCssColorString: () => string }).toCssColorString()
    : undefined;
}

/**
 * 椭球体绘制类（使用 Entity + EllipsoidGraphics）
 * API 风格对齐 Point 类
 */
export default class Ellipsoid {
  private readonly data = new Map<string, EllipsoidRecord>();

  /**
   * 检查记录是否有效
   */
  private isRecordAlive(rec: EllipsoidRecord): boolean {
    if (rec.viewer.isDestroyed()) return false;
    return rec.viewer.entities.contains(rec.entity);
  }

  /**
   * 获取有效记录
   */
  private takeIfAlive(id: string): EllipsoidRecord | undefined {
    const rec = this.data.get(id);
    if (!rec) return undefined;
    if (!this.isRecordAlive(rec)) {
      this.data.delete(id);
      return undefined;
    }
    return rec;
  }

  /**
   * 克隆业务数据
   */
  private cloneTargetData(
    data?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!data || typeof data !== "object") return {};
    return { ...data };
  }

  /**
   * 添加椭球体
   */
  add(viewer: Viewer, options: AddEllipsoidOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined;

    const id = options.id?.trim() ? options.id : createRandomXgxId("el");
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined;

    // 解析位置
    const position = toCartesian3(options.position);

    // 解析半径
    const radii = options.style?.radii ?? resolveRadii(options.radii);

    // 构建样式
    const style: EllipsoidStyleOptions = {
      ...(options.style ?? {}),
      radii,
    };

    // 构建 EllipsoidGraphics
    const ellipsoidGraphics = new Cesium.EllipsoidGraphics();
    mergeEllipsoidGraphics(
      ellipsoidGraphics,
      style,
      {
        outline: options.outline,
        outlineWidth: options.outlineWidth,
        color: options.color,
        alpha: options.alpha,
        outlineColor: options.outlineColor,
        outlineAlpha: options.outlineAlpha,
      },
      true,
    );

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(position),
      ellipsoid: ellipsoidGraphics,
      show: options.show !== false,
    });

    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description);
    }

    viewer.entities.add(entity);
    this.data.set(id, {
      viewer,
      entity,
      targetData: {
        ...this.cloneTargetData(options.targetData),
        ...echoStyleFieldsFromAddOptions(options),
      },
    });

    return entity;
  }

  /**
   * 批量添加椭球体
   */
  addBatch(
    viewer: Viewer,
    items: AddEllipsoidOptions[],
  ): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed())
      return { succeeded: [], failedIds: [] };

    const succeeded: Entity[] = [];
    const failedIds: string[] = [];

    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId("el");
      const e = this.add(viewer, { ...item, id: resolvedId });
      if (e) succeeded.push(e);
      else failedIds.push(resolvedId);
    }

    return { succeeded, failedIds };
  }

  /**
   * 批量添加（简化版，返回成功创建的 id 列表）
   */
  addEllipsoids(viewer: Viewer, options: AddEllipsoidOptions[]): string[] {
    if (
      !viewer ||
      viewer.isDestroyed() ||
      !Array.isArray(options) ||
      options.length === 0
    ) {
      return [];
    }

    const createdIds: string[] = [];
    for (let i = 0; i < options.length; i++) {
      try {
        const item = options[i]!;
        const id = item.id?.trim() ? item.id : createRandomXgxId("el");
        const entity = this.add(viewer, { ...item, id });
        if (entity) createdIds.push(id);
      } catch (e) {
        console.error(`[XGX.Draw.Ellipsoid] addEllipsoids 第 ${i} 项失败:`, e);
      }
    }
    return createdIds;
  }

  /**
   * 更新椭球体属性
   */
  updateEllipsoid(id: string, properties: UpdateEllipsoidProperties): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const p = properties;

    // 更新位置
    if (p.position !== undefined) {
      rec.entity.position = new Cesium.ConstantPositionProperty(
        toCartesian3(p.position),
      );
    }

    // 更新半径
    if (p.radii !== undefined) {
      const radii = resolveRadii(p.radii);
      if (!rec.entity.ellipsoid)
        rec.entity.ellipsoid = new Cesium.EllipsoidGraphics();
      rec.entity.ellipsoid.radii = new Cesium.ConstantProperty(radii);
    }

    // 更新样式
    if (
      p.color !== undefined ||
      p.alpha !== undefined ||
      p.outline !== undefined ||
      p.outlineColor !== undefined ||
      p.outlineAlpha !== undefined ||
      p.outlineWidth !== undefined ||
      p.style !== undefined
    ) {
      const eg =
        rec.entity.ellipsoid ??
        (rec.entity.ellipsoid = new Cesium.EllipsoidGraphics());
      const stylePatch: EllipsoidStyleOptions = { ...(p.style ?? {}) };

      const col = toColor(p.color as string | Color | undefined, p.alpha);
      if (col) {
        stylePatch.material = col;
      }

      const oc = toColor(
        p.outlineColor as string | Color | undefined,
        p.outlineAlpha,
      );
      if (oc) stylePatch.outlineColor = oc;

      if (p.outlineWidth !== undefined)
        stylePatch.outlineWidth = p.outlineWidth;

      mergeEllipsoidGraphics(
        eg,
        stylePatch,
        {
          outline: p.outline,
          outlineWidth: p.outlineWidth,
        },
        false,
      );
    }

    // 更新显隐
    if (p.show !== undefined) {
      rec.entity.show = p.show;
    }

    // 更新描述
    if (p.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(p.description);
    }

    // 更新业务数据（样式字段同步进 targetData，供示例页回显）
    const styleEcho = echoStyleFieldsFromUpdate(p);
    if (Object.keys(styleEcho).length || p.targetData !== undefined) {
      rec.targetData = {
        ...rec.targetData,
        ...styleEcho,
        ...(p.targetData ?? {}),
      };
    }

    return true;
  }

  /**
   * 批量更新
   */
  updateEllipsoids(
    updates: Array<{ id: string } & UpdateEllipsoidProperties>,
  ): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u;
      return { id, success: this.updateEllipsoid(id, rest) };
    });
  }

  /**
   * 获取业务数据
   */
  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id);
    if (!rec) return undefined;
    return { ...rec.targetData };
  }

  /**
   * 设置业务数据（整体替换）
   */
  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...targetData };
    return true;
  }

  /**
   * 合并业务数据
   */
  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...rec.targetData, ...patch };
    return true;
  }

  /**
   * 获取椭球体快照
   */
  getEllipsoid(id: string): EllipsoidSnapshot | null {
    const rec = this.takeIfAlive(id);
    if (!rec) return null;

    const position = sampleProperty<Cesium.Cartesian3>(rec.entity.position);
    if (!position) return null;

    const carto = Cesium.Cartographic.fromCartesian(position);
    const eg = rec.entity.ellipsoid;

    const radii = eg ? sampleProperty<Cesium.Cartesian3>(eg.radii) : undefined;
    const material = eg ? sampleFillColorFromMaterial(eg.material) : undefined;
    const outlineColor = eg
      ? sampleProperty<Color>(eg.outlineColor)
      : undefined;
    const outlineWidth = eg
      ? sampleProperty<number>(eg.outlineWidth)
      : undefined;
    const outlineEnabled = eg
      ? sampleProperty<boolean>(eg.outline)
      : undefined;
    const desc = sampleProperty<string>(rec.entity.description);

    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      radii: {
        x: radii?.x ?? 10000,
        y: radii?.y ?? 10000,
        z: radii?.z ?? 10000,
      },
      materialCss: material ? colorToCss(material) : undefined,
      outlineColorCss: outlineColor ? colorToCss(outlineColor) : undefined,
      outlineWidth,
      outline:
        typeof outlineEnabled === "boolean" ? outlineEnabled : undefined,
      show: rec.entity.show ?? true,
      targetData: { ...rec.targetData },
      description: desc,
    };
  }

  /**
   * 获取所有椭球体
   */
  getAllEllipsoids(viewer?: Viewer): EllipsoidSnapshot[] {
    const out: EllipsoidSnapshot[] = [];
    for (const id of this.getIds(viewer)) {
      const snap = this.getEllipsoid(id);
      if (snap) out.push(snap);
    }
    return out;
  }

  /**
   * 获取数量
   */
  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length;
  }

  /**
   * 获取所有 ID
   */
  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer);
  }

  /**
   * 设置所有椭球体显隐
   */
  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue;
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      rec.entity.show = show;
    }
  }

  /**
   * 指定 ID 显隐（别名）
   */
  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show);
  }

  /**
   * 移除所有椭球体
   */
  removeAll(viewer?: Viewer): void {
    this.clear(viewer);
  }

  /**
   * 获取 Entity 对象
   */
  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity;
  }

  /**
   * 检查是否存在
   */
  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined;
  }

  /**
   * 获取所有有效 ID
   */
  getIds(viewer?: Viewer): string[] {
    const out: string[] = [];
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue;
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      out.push(id);
    }
    return out;
  }

  /**
   * 更新样式
   */
  updateStyle(id: string, style: EllipsoidStyleOptions): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    const eg =
      rec.entity.ellipsoid ??
      (rec.entity.ellipsoid = new Cesium.EllipsoidGraphics());
    mergeEllipsoidGraphics(eg, style, {}, false);
    return true;
  }

  /**
   * 设置位置
   */
  setPosition(id: string, position: PositionInput): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.position = new Cesium.ConstantPositionProperty(
      toCartesian3(position),
    );
    return true;
  }

  /**
   * 设置半径
   */
  setRadii(id: string, radii: Cesium.Cartesian3 | number): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    const radiiValue = resolveRadii(radii);
    if (!rec.entity.ellipsoid)
      rec.entity.ellipsoid = new Cesium.EllipsoidGraphics();
    rec.entity.ellipsoid.radii = new Cesium.ConstantProperty(radiiValue);
    return true;
  }

  /**
   * 设置显隐
   */
  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.show = visible;
    return true;
  }

  /**
   * 显示
   */
  show(id: string): boolean {
    return this.setVisible(id, true);
  }

  /**
   * 隐藏
   */
  hide(id: string): boolean {
    return this.setVisible(id, false);
  }

  /**
   * 设置描述
   */
  setDescription(id: string, description: string): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.description = new Cesium.ConstantProperty(description);
    return true;
  }

  /**
   * 移除单个
   */
  remove(id: string): boolean {
    const rec = this.data.get(id);
    if (!rec) return false;
    this.data.delete(id);
    if (!rec.viewer.isDestroyed() && rec.viewer.entities.contains(rec.entity)) {
      rec.viewer.entities.remove(rec.entity);
    }
    return true;
  }

  /**
   * 批量移除
   */
  removeBatch(ids: string[]): number {
    let n = 0;
    for (const id of ids) {
      if (this.remove(id)) n += 1;
    }
    return n;
  }

  /**
   * 清空
   */
  clear(viewer?: Viewer): void {
    const toRemove: string[] = [];
    for (const [id, rec] of this.data) {
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      toRemove.push(id);
    }
    for (const id of toRemove) this.remove(id);
  }

  /**
   * 清理无效数据
   */
  pruneInvalid(): number {
    let n = 0;
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) {
        this.data.delete(id);
        n += 1;
      }
    }
    return n;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.clear();
  }
}
