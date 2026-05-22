import * as Cesium from "cesium";
import type { Entity, Viewer } from "cesium";
import { createRandomXgxId, type LngLatHeight } from "../../Coordinates";

import type { AddWallOptions, ColorStop, GradientMaterialOptions, ImageMaterialOptions, Position3D, UpdateWallProperties, WallPosition, WallSnapshot, WallStyleOptions } from '../../Types'
export type { AddWallOptions, ColorStop, GradientMaterialOptions, ImageMaterialOptions, Position3D, UpdateWallProperties, WallPosition, WallSnapshot, WallStyleOptions }

/** 材质类型 */
export type MaterialType =
  | "color" // 纯色
  | "gradientVertical" // 纯色垂直渐变（从上到下）
  | "gradientHorizontal" // 纯色水平渐变（从左到右）
  | "gradientMultiColor" // 纯色多色渐变
  | "imageRepeat" // 图片重复平铺
  | "imageStretch"; // 图片拉伸铺满整面墙

/** 内部记录 */
interface WallRecord {
  viewer: Viewer;
  entity: Entity;
  targetData: Record<string, unknown>;
  originalPositions: WallPosition[];
  materialType: MaterialType;
  /** 纯色材质时的颜色（与渐变起始字段分离，便于快照回显） */
  solidColor?: string | Cesium.Color;
  imageUrl?: string;
  repeat?: { x: number; y: number };
  gradientStartColor?: string | Cesium.Color;
  gradientEndColor?: string | Cesium.Color;
  gradientDirection?: "vertical" | "horizontal";
  colorStops?: ColorStop[];
  fabricMatProp?: WallFabricMaterialProperty;
}

/**
 * Entity `WallGraphics.material` 必须使用 `MaterialProperty`（含 `getType`），
 * 不能用 `ConstantProperty` 直接包 `Material` / `Color`。
 */
function copyWallUniformsInto(
  src: Cesium.Material | null,
  result: Record<string, unknown>,
): Record<string, unknown> {
  const u = src?.uniforms as Record<string, unknown> | undefined;
  if (!u) return result;
  for (const key of Object.keys(u)) {
    const v = u[key];
    if (v === undefined) continue;
    if (v instanceof Cesium.Color) {
      result[key] = Cesium.Color.clone(v, result[key] as Cesium.Color | undefined);
    } else {
      result[key] = v;
    }
  }
  return result;
}

function destroyCesiumMaterial(m: Cesium.Material | null | undefined): void {
  if (!m) return;
  const d = (m as Cesium.Material & { destroy?: () => void }).destroy;
  if (typeof d === "function") d.call(m);
}

class WallFabricMaterialProperty implements Cesium.MaterialProperty {
  readonly isConstant = false;
  readonly definitionChanged = new Cesium.Event();

  constructor(
    private backing: Cesium.Material,
    private readonly fallbackType: string,
  ) {}

  getType(_time?: Cesium.JulianDate): string {
    return this.backing.type ?? this.fallbackType;
  }

  getValue(_time?: Cesium.JulianDate, result?: Record<string, unknown>): Record<string, unknown> {
    return copyWallUniformsInto(this.backing, result ?? {});
  }

  setBacking(next: Cesium.Material): void {
    if (this.backing !== next) {
      destroyCesiumMaterial(this.backing);
    }
    this.backing = next;
    this.definitionChanged.raiseEvent();
  }

  dispose(): void {
    destroyCesiumMaterial(this.backing);
  }

  equals(other?: Cesium.Property): boolean {
    return other === this;
  }
}

function applyWallImageMaterialProperty(
  graphics: Cesium.WallGraphics,
  imageUrl: string,
  repeat: { x: number; y: number } | undefined,
  alpha?: number,
  imageColor?: Cesium.Color,
): void {
  const rep = repeat ?? { x: 1, y: 1 };
  const a = alpha ?? 1;
  const tint = (imageColor ?? Cesium.Color.WHITE).withAlpha(a);
  const existing = graphics.material;
  if (existing instanceof Cesium.ImageMaterialProperty) {
    existing.image = new Cesium.ConstantProperty(imageUrl);
    existing.repeat = new Cesium.ConstantProperty(new Cesium.Cartesian2(rep.x, rep.y));
    existing.color = new Cesium.ConstantProperty(tint);
    existing.transparent = new Cesium.ConstantProperty(a < 0.999);
    return;
  }
  graphics.material = new Cesium.ImageMaterialProperty({
    image: imageUrl,
    repeat: new Cesium.ConstantProperty(new Cesium.Cartesian2(rep.x, rep.y)),
    color: new Cesium.ConstantProperty(tint),
    transparent: a < 0.999,
  });
}

function applyWallMaterialToGraphics(
  graphics: Cesium.WallGraphics,
  rec: WallRecord | undefined,
  value: Cesium.Material | Cesium.Color,
  imageMeta?: { url: string; repeat?: { x: number; y: number }; alpha?: number; color?: Cesium.Color },
): void {
  if (value instanceof Cesium.Color) {
    if (rec) rec.fabricMatProp = undefined;
    graphics.material = new Cesium.ColorMaterialProperty(value);
    return;
  }

  const matType = value.type ?? "Color";
  if (matType === "Image" && imageMeta?.url) {
    if (rec) rec.fabricMatProp = undefined;
    applyWallImageMaterialProperty(
      graphics,
      imageMeta.url,
      imageMeta.repeat,
      imageMeta.alpha,
      imageMeta.color,
    );
    return;
  }

  if (rec?.fabricMatProp) {
    const prevType = rec.fabricMatProp.getType();
    const nextType = value.type ?? matType;
    if (prevType !== nextType) {
      rec.fabricMatProp.dispose();
      rec.fabricMatProp = undefined;
    } else {
      rec.fabricMatProp.setBacking(value);
      graphics.material = rec.fabricMatProp as unknown as Cesium.MaterialProperty;
      return;
    }
  }

  const prop = new WallFabricMaterialProperty(value, matType);
  if (rec) rec.fabricMatProp = prop;
  graphics.material = prop as unknown as Cesium.MaterialProperty;
}

/**
 * 墙体绘制类
 * 支持六种材质类型：
 * - color: 纯色
 * - gradientVertical: 纯色垂直渐变（从上到下）
 * - gradientHorizontal: 纯色水平渐变（从左到右）
 * - gradientMultiColor: 纯色多色渐变
 * - imageRepeat: 图片重复平铺
 * - imageStretch: 图片拉伸铺满整面墙
 */
export default class Wall {
  private readonly data = new Map<string, WallRecord>();

  // ==================== 私有辅助方法 ====================

  private isRecordAlive(rec: WallRecord): boolean {
    if (rec.viewer.isDestroyed()) return false;
    return rec.viewer.entities.contains(rec.entity);
  }

  private takeIfAlive(id: string): WallRecord | undefined {
    const rec = this.data.get(id);
    if (!rec) return undefined;
    if (!this.isRecordAlive(rec)) {
      this.data.delete(id);
      return undefined;
    }
    return rec;
  }

  private cloneTargetData(
    data?: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!data || typeof data !== "object") return {};
    return { ...data };
  }

  /** 轮廓点序列化为 [lng,lat,height][]，写入 targetData 供示例页回显 */
  private wallPositionToTuple(p: WallPosition): [number, number, number] {
    if (p instanceof Cesium.Cartesian3) {
      const c = Cesium.Cartographic.fromCartesian(p);
      return [
        Cesium.Math.toDegrees(c.longitude),
        Cesium.Math.toDegrees(c.latitude),
        c.height,
      ];
    }
    if (Array.isArray(p)) {
      return [Number(p[0]), Number(p[1]), Number(p[2] ?? 0)];
    }
    const lh = p as LngLatHeight;
    return [lh.longitude, lh.latitude, lh.height ?? 0];
  }

  private colorOrCss(c?: string | Cesium.Color): string | undefined {
    if (c === undefined) return undefined;
    if (typeof c === "string") return c;
    return typeof (c as { toCssColorString?: () => string }).toCssColorString ===
      "function"
      ? (c as Cesium.Color & { toCssColorString: () => string }).toCssColorString()
      : undefined;
  }

  /** 将当前记录合并进 targetData，保证列表选中后参数可稳定回显 */
  private mergeEchoIntoRecTargetData(rec: WallRecord): void {
    const positionsEcho = rec.originalPositions.map((p) =>
      this.wallPositionToTuple(p),
    );
    const wall = rec.entity.wall;
    let height: number | undefined;
    let extrudedHeight: number | undefined;
    if (wall) {
      const maxH = wall.maximumHeights?.getValue() as number[] | undefined;
      const minH = wall.minimumHeights?.getValue() as number[] | undefined;
      if (maxH && maxH.length > 0) height = maxH[0];
      if (minH && minH.length > 0) extrudedHeight = minH[0];
    }
    let clamp = false;
    if (wall) {
      const wallExt = wall as unknown as {
        classificationType?: { getValue: (t?: Cesium.JulianDate) => unknown };
      };
      const ct = wallExt.classificationType?.getValue(Cesium.JulianDate.now());
      clamp = ct === Cesium.ClassificationType.TERRAIN;
    }
    const stops =
      rec.colorStops?.map((s) => ({
        position: s.position,
        color:
          typeof s.color === "string"
            ? s.color
            : this.colorOrCss(s.color) ?? "#ffffff",
        alpha: s.alpha,
      })) ?? undefined;

    rec.targetData = {
      ...rec.targetData,
      positionsEcho,
      materialType: rec.materialType,
      height,
      extrudedHeight,
      clampToGround: clamp,
      color: this.colorOrCss(rec.solidColor),
      imageUrl: rec.imageUrl,
      repeat: rec.repeat,
      gradientStartColor: this.colorOrCss(rec.gradientStartColor),
      gradientEndColor: this.colorOrCss(rec.gradientEndColor),
      gradientDirection: rec.gradientDirection,
      colorStops: stops,
    };
  }

  /** 将输入位置转换为 Cartesian3 数组 */
  private positionsToCartesianArray(
    positions: WallPosition[],
  ): Cesium.Cartesian3[] {
    if (!positions || positions.length < 2) {
      throw new Error("[Wall] 至少需要2个点才能构建墙体");
    }

    return positions.map((pos) => {
      if (pos instanceof Cesium.Cartesian3) {
        return Cesium.Cartesian3.clone(pos);
      }
      const lng = (pos as LngLatHeight).longitude ?? (pos as Position3D)[0];
      const lat = (pos as LngLatHeight).latitude ?? (pos as Position3D)[1];
      const h = (pos as LngLatHeight).height ?? (pos as Position3D)[2] ?? 0;
      return Cesium.Cartesian3.fromDegrees(lng, lat, h);
    });
  }

  /** 解析颜色（支持字符串和Color对象） */
  private resolveColor(
    color?: string | Cesium.Color,
  ): Cesium.Color | undefined {
    if (!color) return undefined;
    if (typeof color === "string") {
      return Cesium.Color.fromCssColorString(color);
    }
    return color;
  }

  /** 创建垂直渐变材质（从上到下；`st.t` 沿墙高，顶为起始色） */
  private createVerticalGradientMaterial(
    startColor: Cesium.Color,
    endColor: Cesium.Color,
  ): Cesium.Material {
    return new Cesium.Material({
      fabric: {
        type: "XgxWallVerticalGradient",
        uniforms: {
          wallGradColorA: startColor,
          wallGradColorB: endColor,
        },
        source: `
          uniform vec4 wallGradColorA;
          uniform vec4 wallGradColorB;
          czm_material czm_getMaterial(czm_materialInput materialInput) {
            czm_material material = czm_getDefaultMaterial(materialInput);
            float t = clamp(materialInput.st.t, 0.0, 1.0);
            vec4 g = mix(wallGradColorB, wallGradColorA, t);
            material.diffuse = g.rgb;
            material.alpha = g.a;
            return material;
          }
        `,
      },
      translucent: startColor.alpha < 1 || endColor.alpha < 1,
    });
  }

  /** 创建水平渐变材质（从左到右；`st.s` 沿墙宽，左为起始色） */
  private createHorizontalGradientMaterial(
    startColor: Cesium.Color,
    endColor: Cesium.Color,
  ): Cesium.Material {
    return new Cesium.Material({
      fabric: {
        type: "XgxWallHorizontalGradient",
        uniforms: {
          wallGradColorA: startColor,
          wallGradColorB: endColor,
        },
        source: `
          uniform vec4 wallGradColorA;
          uniform vec4 wallGradColorB;
          czm_material czm_getMaterial(czm_materialInput materialInput) {
            czm_material material = czm_getDefaultMaterial(materialInput);
            float t = clamp(materialInput.st.s, 0.0, 1.0);
            vec4 g = mix(wallGradColorA, wallGradColorB, t);
            material.diffuse = g.rgb;
            material.alpha = g.a;
            return material;
          }
        `,
      },
      translucent: startColor.alpha < 1 || endColor.alpha < 1,
    });
  }

  /** 创建多色渐变材质 */
  private createMultiColorGradientMaterial(
    colorStops: ColorStop[],
    direction: "vertical" | "horizontal",
  ): Cesium.Material {
    if (!colorStops || colorStops.length < 2) {
      throw new Error("[Wall] 多色渐变至少需要2个颜色节点");
    }

    // 排序颜色节点
    const sorted = [...colorStops].sort((a, b) => a.position - b.position);

    // 转换颜色
    const stops = sorted.map((stop) => ({
      position: stop.position,
      color: this.resolveColor(stop.color) ?? Cesium.Color.WHITE,
      alpha: stop.alpha ?? 1,
    }));

    // Fabric 会为 uniforms 自动生成声明；不要用 GLSL 数组 + u_colors[i] 与之一并存（易重定义或链接失败）。
    // 改为每个节点独立 uniform（xgx_mc_c0… / xgx_mc_p0…）并展开 if 链。
    const coordVar =
      direction === "vertical" ? "materialInput.st.t" : "materialInput.st.s";

    const n = stops.length;
    const uniforms: Record<string, Cesium.Color | number> = {};
    const uniformDecls: string[] = [];
    for (let i = 0; i < n; i++) {
      const s = stops[i]!;
      uniforms[`xgx_mc_c${i}`] = s.color.withAlpha(s.alpha);
      uniforms[`xgx_mc_p${i}`] = s.position;
      uniformDecls.push(`uniform vec4 xgx_mc_c${i};`, `uniform float xgx_mc_p${i};`);
    }

    const parts: string[] = [];
    for (let i = 1; i < n; i++) {
      const kw = i === 1 ? "if" : "else if";
      parts.push(`${kw} (t >= xgx_mc_p${i - 1} && t <= xgx_mc_p${i}) {
            float denom = xgx_mc_p${i} - xgx_mc_p${i - 1};
            float xgx_mp = denom > 1.0e-6 ? (t - xgx_mc_p${i - 1}) / denom : 0.0;
            wallOut = mix(xgx_mc_c${i - 1}, xgx_mc_c${i}, xgx_mp);
          }`);
    }

    const glsl = `
      ${uniformDecls.join("\n      ")}
      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        float t = clamp(${coordVar}, 0.0, 1.0);
        vec4 wallOut = xgx_mc_c0;
        ${parts.join("\n        ")}
        else if (t > xgx_mc_p${n - 1}) {
          wallOut = xgx_mc_c${n - 1};
        }
        material.diffuse = wallOut.rgb;
        material.alpha = wallOut.a;
        return material;
      }
    `;

    return new Cesium.Material({
      fabric: {
        type:
          direction === "vertical"
            ? `XgxWallMultiColorVertical_${n}`
            : `XgxWallMultiColorHorizontal_${n}`,
        uniforms,
        source: glsl,
      },
      translucent: true,
    });
  }

  /** 创建图片重复平铺材质 */
  private createImageRepeatMaterial(
    imageUrl: string,
    repeat: { x: number; y: number },
    color?: Cesium.Color,
    alpha?: number,
  ): Cesium.Material {
    return Cesium.Material.fromType("Image", {
      image: imageUrl,
      repeat: new Cesium.Cartesian2(repeat.x, repeat.y),
      color: color ?? Cesium.Color.WHITE,
      transparent: (alpha ?? 1) < 1,
    });
  }

  /** 创建图片拉伸铺满材质 */
  private createImageStretchMaterial(
    imageUrl: string,
    color?: Cesium.Color,
    alpha?: number,
  ): Cesium.Material {
    // 设置 repeat 为 (1,1) 让图片拉伸铺满整个墙体
    return Cesium.Material.fromType("Image", {
      image: imageUrl,
      repeat: new Cesium.Cartesian2(1, 1),
      color: color ?? Cesium.Color.WHITE,
      transparent: (alpha ?? 1) < 1,
    });
  }

  /** 创建墙体材质 */
  private createWallMaterial(
    materialType: MaterialType,
    color?: string | Cesium.Color,
    imageUrl?: string,
    repeat?: { x: number; y: number },
    imageAlpha?: number,
    imageColor?: Cesium.Color,
    gradientStartColor?: string | Cesium.Color,
    gradientEndColor?: string | Cesium.Color,
    gradientDirection?: "vertical" | "horizontal",
    colorStops?: ColorStop[],
  ): Cesium.Material | Cesium.Color | undefined {
    switch (materialType) {
      case "color": {
        const resolvedColor = this.resolveColor(color);
        if (resolvedColor) {
          return resolvedColor;
        }
        return Cesium.Color.GRAY.withAlpha(0.7);
      }

      case "gradientVertical": {
        const start =
          this.resolveColor(gradientStartColor) ?? Cesium.Color.WHITE;
        const end = this.resolveColor(gradientEndColor) ?? Cesium.Color.BLACK;
        return this.createVerticalGradientMaterial(start, end);
      }

      case "gradientHorizontal": {
        const start =
          this.resolveColor(gradientStartColor) ?? Cesium.Color.WHITE;
        const end = this.resolveColor(gradientEndColor) ?? Cesium.Color.BLACK;
        return this.createHorizontalGradientMaterial(start, end);
      }

      case "gradientMultiColor": {
        if (!colorStops || colorStops.length < 2) {
          console.warn(
            "[Wall] gradientMultiColor 模式需要提供 colorStops（至少2个），降级为纯色",
          );
          return Cesium.Color.GRAY.withAlpha(0.7);
        }
        return this.createMultiColorGradientMaterial(
          colorStops,
          gradientDirection ?? "vertical",
        );
      }

      case "imageRepeat": {
        if (!imageUrl) {
          console.warn("[Wall] imageRepeat 模式需要提供 imageUrl，降级为纯色");
          return Cesium.Color.GRAY.withAlpha(0.7);
        }
        return this.createImageRepeatMaterial(
          imageUrl,
          repeat ?? { x: 1, y: 1 },
          imageColor,
          imageAlpha,
        );
      }

      case "imageStretch": {
        if (!imageUrl) {
          console.warn("[Wall] imageStretch 模式需要提供 imageUrl，降级为纯色");
          return Cesium.Color.GRAY.withAlpha(0.7);
        }
        return this.createImageStretchMaterial(
          imageUrl,
          imageColor,
          imageAlpha,
        );
      }

      default:
        return Cesium.Color.GRAY.withAlpha(0.7);
    }
  }

  /** 解析材质类型和配置 */
  private resolveMaterialType(options: AddWallOptions): {
    type: MaterialType;
    color?: string | Cesium.Color;
    imageUrl?: string;
    repeat?: { x: number; y: number };
    gradientStartColor?: string | Cesium.Color;
    gradientEndColor?: string | Cesium.Color;
    gradientDirection?: "vertical" | "horizontal";
    colorStops?: ColorStop[];
    imageAlpha?: number;
    imageColor?: Cesium.Color;
  } {
    const style = options.style;

    // 仅当显式提供 style.type 时，才按「完整 style 材质」解析（避免仅有 fill/outline 的 style 把类型误判为纯色）
    if (style?.type !== undefined) {
      const type = style.type;
      return {
        type,
        color: style.color,
        imageUrl: style.image?.url,
        repeat: style.repeat ?? { x: 1, y: 1 },
        gradientStartColor: style.gradient?.startColor,
        gradientEndColor: style.gradient?.endColor,
        gradientDirection:
          type === "gradientHorizontal" || type === "gradientVertical"
            ? type === "gradientHorizontal"
              ? "horizontal"
              : "vertical"
            : undefined,
        colorStops: style.gradient?.colorStops,
        imageAlpha: style.image?.alpha,
        imageColor: style.image?.color,
      };
    }

    let type = options.materialType ?? "color";
    if (options.colorStops && options.colorStops.length >= 2) {
      type = "gradientMultiColor";
    } else if (options.gradientStartColor || options.gradientEndColor) {
      type =
        options.gradientDirection === "horizontal"
          ? "gradientHorizontal"
          : "gradientVertical";
    } else if (options.imageUrl) {
      type =
        options.materialType === "imageStretch"
          ? "imageStretch"
          : "imageRepeat";
    }

    return {
      type,
      color: style?.color ?? options.color,
      imageUrl: style?.image?.url ?? options.imageUrl,
      repeat: style?.repeat ?? options.repeat ?? { x: 1, y: 1 },
      gradientStartColor:
        style?.gradient?.startColor ?? options.gradientStartColor,
      gradientEndColor: style?.gradient?.endColor ?? options.gradientEndColor,
      gradientDirection:
        type === "gradientHorizontal"
          ? "horizontal"
          : type === "gradientVertical"
            ? "vertical"
            : options.gradientDirection ?? "vertical",
      colorStops: style?.gradient?.colorStops ?? options.colorStops,
      imageAlpha: style?.image?.alpha,
      imageColor: style?.image?.color,
    };
  }

  /** 构建墙体图形配置 */
  private buildWallGraphics(options: AddWallOptions): Cesium.WallGraphics {
    const cartesianPositions = this.positionsToCartesianArray(
      options.positions,
    );

    const graphics = new Cesium.WallGraphics();

    // 设置轮廓点
    graphics.positions = new Cesium.ConstantProperty(cartesianPositions);

    // 墙体高度（当使用二维点时生效）
    if (options.height !== undefined) {
      graphics.maximumHeights = new Cesium.ConstantProperty(
        new Array(cartesianPositions.length).fill(options.height),
      );
    }

    // 拉伸高度
    if (options.extrudedHeight !== undefined) {
      graphics.minimumHeights = new Cesium.ConstantProperty(
        new Array(cartesianPositions.length).fill(options.extrudedHeight),
      );
    }

    // 贴地设置（运行时字段，部分版本 typings 未声明）
    if (options.clampToGround !== undefined) {
      const g = graphics as unknown as {
        classificationType?: Cesium.ClassificationType | Cesium.ConstantProperty;
      };
      g.classificationType = new Cesium.ConstantProperty(
        options.clampToGround
          ? Cesium.ClassificationType.TERRAIN
          : Cesium.ClassificationType.CESIUM_3D_TILE,
      );
    }

    // 填充和轮廓
    const fill = options.style?.fill ?? true;
    graphics.fill = new Cesium.ConstantProperty(fill);

    const outline = options.style?.outline ?? false;
    graphics.outline = new Cesium.ConstantProperty(outline);

    // 轮廓颜色
    if (options.style?.outlineColor) {
      const outlineColor =
        typeof options.style.outlineColor === "string"
          ? Cesium.Color.fromCssColorString(options.style.outlineColor)
          : options.style.outlineColor;
      graphics.outlineColor = new Cesium.ConstantProperty(outlineColor);
    }

    // 轮廓宽度
    const outlineWidth = options.style?.outlineWidth ?? 1;
    graphics.outlineWidth = new Cesium.ConstantProperty(outlineWidth);

    // 粒度（弧度）
    if (options.style?.granularity !== undefined) {
      graphics.granularity = new Cesium.ConstantProperty(
        options.style.granularity,
      );
    }

    // 距离显示条件
    if (options.style?.distanceDisplayCondition !== undefined) {
      graphics.distanceDisplayCondition = new Cesium.ConstantProperty(
        options.style.distanceDisplayCondition,
      );
    }

    return graphics;
  }

  /** 按添加/更新参数绑定墙材质（须在 WallRecord 已登记后调用） */
  private bindWallMaterialFromOptions(
    rec: WallRecord,
    options: AddWallOptions | UpdateWallProperties,
  ): void {
    const graphics = rec.entity.wall;
    if (!graphics) return;

    const materialConfig = this.resolveMaterialType(options as AddWallOptions);
    const material = this.createWallMaterial(
      materialConfig.type,
      materialConfig.color,
      materialConfig.imageUrl,
      materialConfig.repeat,
      materialConfig.imageAlpha,
      materialConfig.imageColor,
      materialConfig.gradientStartColor,
      materialConfig.gradientEndColor,
      materialConfig.gradientDirection,
      materialConfig.colorStops,
    );

    if (material) {
      const imageMeta = materialConfig.imageUrl
        ? {
            url: materialConfig.imageUrl,
            repeat: materialConfig.repeat,
            alpha: materialConfig.imageAlpha,
            color: materialConfig.imageColor,
          }
        : undefined;
      applyWallMaterialToGraphics(graphics, rec, material, imageMeta);
    } else {
      graphics.material = new Cesium.ColorMaterialProperty(
        Cesium.Color.BLUE.withAlpha(0.6),
      );
    }
    if (!rec.viewer.isDestroyed()) {
      rec.viewer.scene.requestRender();
    }
  }

  /** 更新墙体材质 */
  private updateWallMaterial(
    graphics: Cesium.WallGraphics,
    rec: WallRecord,
    materialType: MaterialType,
    color?: string | Cesium.Color,
    imageUrl?: string,
    repeat?: { x: number; y: number },
    imageAlpha?: number,
    imageColor?: Cesium.Color,
    gradientStartColor?: string | Cesium.Color,
    gradientEndColor?: string | Cesium.Color,
    gradientDirection?: "vertical" | "horizontal",
    colorStops?: ColorStop[],
  ): void {
    const material = this.createWallMaterial(
      materialType,
      color,
      imageUrl,
      repeat,
      imageAlpha,
      imageColor,
      gradientStartColor,
      gradientEndColor,
      gradientDirection,
      colorStops,
    );
    if (material) {
      const imageMeta = imageUrl
        ? { url: imageUrl, repeat, alpha: imageAlpha, color: imageColor }
        : undefined;
      applyWallMaterialToGraphics(graphics, rec, material, imageMeta);
      if (!rec.viewer.isDestroyed()) {
        rec.viewer.scene.requestRender();
      }
    }
  }

  /** 更新墙体图形 */
  private updateWallGraphics(
    graphics: Cesium.WallGraphics,
    properties: UpdateWallProperties,
    originalPositions?: WallPosition[],
    currentRecord?: WallRecord,
  ): void {
    // 更新位置
    if (properties.positions !== undefined && originalPositions) {
      const newPositions = this.positionsToCartesianArray(properties.positions);
      graphics.positions = new Cesium.ConstantProperty(newPositions);
    }

    // 仅当 style 显式带 type 时才用 style 驱动材质；否则走下方快捷字段（避免仅含 fill/outline 的 style 把渐变/图片参数更新成 undefined）
    if (currentRecord && properties.style?.type !== undefined) {
      const style = properties.style;
      const type = style.type as MaterialType;
      this.updateWallMaterial(
        graphics,
        currentRecord,
        type,
        style.color,
        style.image?.url,
        style.repeat,
        style.image?.alpha,
        style.image?.color,
        style.gradient?.startColor,
        style.gradient?.endColor,
        type === "gradientHorizontal"
          ? "horizontal"
          : type === "gradientVertical"
            ? "vertical"
            : undefined,
        style.gradient?.colorStops,
      );
    } else if (
      currentRecord &&
      (properties.materialType !== undefined ||
        properties.color !== undefined ||
        properties.imageUrl !== undefined ||
        properties.gradientStartColor !== undefined ||
        properties.gradientEndColor !== undefined ||
        properties.colorStops !== undefined)
    ) {
      let type =
        properties.materialType ?? currentRecord?.materialType ?? "color";

      // 根据提供的参数推断类型
      if (properties.colorStops && properties.colorStops.length >= 2) {
        type = "gradientMultiColor";
      } else if (properties.gradientStartColor || properties.gradientEndColor) {
        type =
          properties.gradientDirection === "horizontal"
            ? "gradientHorizontal"
            : "gradientVertical";
      } else if (properties.imageUrl) {
        type =
          properties.materialType === "imageStretch"
            ? "imageStretch"
            : "imageRepeat";
      }

      this.updateWallMaterial(
        graphics,
        currentRecord,
        type,
        properties.color,
        properties.imageUrl,
        properties.repeat,
        properties.style?.image?.alpha,
        properties.style?.image?.color,
        properties.gradientStartColor,
        properties.gradientEndColor,
        properties.gradientDirection,
        properties.colorStops,
      );
    }

    // 更新高度
    if (properties.height !== undefined && graphics.positions?.getValue()) {
      const positions = graphics.positions.getValue() as Cesium.Cartesian3[];
      if (positions) {
        graphics.maximumHeights = new Cesium.ConstantProperty(
          new Array(positions.length).fill(properties.height),
        );
      }
    }

    // 更新拉伸高度
    if (
      properties.extrudedHeight !== undefined &&
      graphics.positions?.getValue()
    ) {
      const positions = graphics.positions.getValue() as Cesium.Cartesian3[];
      if (positions) {
        graphics.minimumHeights = new Cesium.ConstantProperty(
          new Array(positions.length).fill(properties.extrudedHeight),
        );
      }
    }

    // 更新贴地设置
    if (properties.clampToGround !== undefined) {
      const g = graphics as unknown as {
        classificationType?: Cesium.ConstantProperty;
      };
      g.classificationType = new Cesium.ConstantProperty(
        properties.clampToGround
          ? Cesium.ClassificationType.TERRAIN
          : Cesium.ClassificationType.CESIUM_3D_TILE,
      );
    }

    const st = properties.style;

    // 更新填充（支持仅写在 style 里）
    if (properties.fill !== undefined) {
      graphics.fill = new Cesium.ConstantProperty(properties.fill);
    } else if (st?.fill !== undefined) {
      graphics.fill = new Cesium.ConstantProperty(st.fill);
    }

    // 更新轮廓
    if (properties.outline !== undefined) {
      graphics.outline = new Cesium.ConstantProperty(properties.outline);
    } else if (st?.outline !== undefined) {
      graphics.outline = new Cesium.ConstantProperty(st.outline);
    }

    // 更新轮廓颜色
    if (properties.outlineColor !== undefined) {
      const oc =
        typeof properties.outlineColor === "string"
          ? Cesium.Color.fromCssColorString(properties.outlineColor)
          : properties.outlineColor;
      graphics.outlineColor = new Cesium.ConstantProperty(oc);
    } else if (st?.outlineColor !== undefined) {
      const oc =
        typeof st.outlineColor === "string"
          ? Cesium.Color.fromCssColorString(st.outlineColor)
          : st.outlineColor;
      graphics.outlineColor = new Cesium.ConstantProperty(oc);
    }

    // 更新轮廓宽度
    if (properties.outlineWidth !== undefined) {
      graphics.outlineWidth = new Cesium.ConstantProperty(
        properties.outlineWidth,
      );
    } else if (st?.outlineWidth !== undefined) {
      graphics.outlineWidth = new Cesium.ConstantProperty(st.outlineWidth);
    }
  }

  // ==================== 公共API ====================

  /**
   * 添加墙体
   * @param viewer Cesium Viewer
   * @param options 墙体配置
   * @returns 创建的Entity，失败返回undefined
   */
  add(viewer: Viewer, options: AddWallOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined;

    const id = options.id?.trim() ? options.id : createRandomXgxId("wall");
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined;

    if (!options.positions || options.positions.length < 2) {
      console.error("[Wall] 至少需要2个点才能构建墙体");
      return undefined;
    }

    try {
      const wallGraphics = this.buildWallGraphics(options);

      const entity = new Cesium.Entity({
        id,
        wall: wallGraphics,
        show: options.show !== false,
      });

      if (options.description !== undefined) {
        entity.description = new Cesium.ConstantProperty(options.description);
      }

      viewer.entities.add(entity);

      // 解析材质类型用于记录
      const materialConfig = this.resolveMaterialType(options);

      this.data.set(id, {
        viewer,
        entity,
        targetData: this.cloneTargetData(options.targetData),
        originalPositions: [...options.positions],
        materialType: materialConfig.type,
        solidColor:
          materialConfig.type === "color" ? materialConfig.color : undefined,
        imageUrl: materialConfig.imageUrl,
        repeat: materialConfig.repeat,
        gradientStartColor: materialConfig.gradientStartColor,
        gradientEndColor: materialConfig.gradientEndColor,
        gradientDirection: materialConfig.gradientDirection,
        colorStops: materialConfig.colorStops,
      });

      const stored = this.data.get(id);
      if (stored) {
        this.mergeEchoIntoRecTargetData(stored);
        this.bindWallMaterialFromOptions(stored, options);
      }

      return entity;
    } catch (error) {
      console.error(`[Wall] 添加墙体失败: ${id}`, error);
      return undefined;
    }
  }

  /**
   * 批量添加墙体
   */
  addBatch(
    viewer: Viewer,
    items: AddWallOptions[],
  ): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed())
      return { succeeded: [], failedIds: [] };

    const succeeded: Entity[] = [];
    const failedIds: string[] = [];

    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId("wall");
      const entity = this.add(viewer, { ...item, id: resolvedId });
      if (entity) {
        succeeded.push(entity);
      } else {
        failedIds.push(resolvedId);
      }
    }

    return { succeeded, failedIds };
  }

  /**
   * 批量添加墙体（简化版，返回ID数组）
   */
  addWalls(viewer: Viewer, options: AddWallOptions[]): string[] {
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
        const id = item.id?.trim() ? item.id : createRandomXgxId("wall");
        const entity = this.add(viewer, { ...item, id });
        if (entity) createdIds.push(id);
      } catch (error) {
        console.error(`[Wall] addWalls 第 ${i} 项失败:`, error);
      }
    }
    return createdIds;
  }

  /**
   * 更新墙体
   */
  updateWall(id: string, properties: UpdateWallProperties): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const wallGraphics = rec.entity.wall;
    if (!wallGraphics) return false;

    // 更新墙体图形
    this.updateWallGraphics(
      wallGraphics,
      properties,
      rec.originalPositions,
      rec,
    );

    if (properties.positions !== undefined) {
      rec.originalPositions = [...properties.positions];
    }

    // 更新记录中的材质信息
    if (properties.materialType !== undefined) {
      rec.materialType = properties.materialType;
    }
    if (properties.imageUrl !== undefined) {
      rec.imageUrl = properties.imageUrl;
    }
    if (properties.repeat !== undefined) {
      rec.repeat = properties.repeat;
    }
    if (properties.gradientStartColor !== undefined) {
      rec.gradientStartColor = properties.gradientStartColor;
    }
    if (properties.gradientEndColor !== undefined) {
      rec.gradientEndColor = properties.gradientEndColor;
    }
    if (properties.gradientDirection !== undefined) {
      rec.gradientDirection = properties.gradientDirection;
    }
    if (properties.colorStops !== undefined) {
      rec.colorStops = properties.colorStops;
    }
    if (properties.style?.type !== undefined) {
      rec.materialType = properties.style.type;
    }
    if (properties.style?.image?.url !== undefined) {
      rec.imageUrl = properties.style.image.url;
    }
    if (properties.style?.repeat !== undefined) {
      rec.repeat = properties.style.repeat;
    }
    if (properties.style?.gradient?.startColor !== undefined) {
      rec.gradientStartColor = properties.style.gradient.startColor;
    }
    if (properties.style?.gradient?.endColor !== undefined) {
      rec.gradientEndColor = properties.style.gradient.endColor;
    }
    if (properties.style?.gradient?.colorStops !== undefined) {
      rec.colorStops = properties.style.gradient.colorStops;
    }

    if (properties.materialType !== undefined) {
      if (properties.materialType !== "color") rec.solidColor = undefined;
    }
    if (properties.style?.type !== undefined && properties.style.type !== "color") {
      rec.solidColor = undefined;
    }
    if (properties.color !== undefined) {
      rec.solidColor = properties.color;
    }
    if (properties.style?.color !== undefined) {
      rec.solidColor = properties.style.color;
    }

    // 更新显示状态
    if (properties.show !== undefined) {
      rec.entity.show = properties.show;
    }

    // 更新描述
    if (properties.description !== undefined) {
      rec.entity.description = new Cesium.ConstantProperty(
        properties.description,
      );
    }

    // 更新业务数据（先合并 echo，再应用调用方 targetData）
    const echoKeys =
      properties.positions !== undefined ||
      properties.materialType !== undefined ||
      properties.color !== undefined ||
      properties.imageUrl !== undefined ||
      properties.repeat !== undefined ||
      properties.gradientStartColor !== undefined ||
      properties.gradientEndColor !== undefined ||
      properties.gradientDirection !== undefined ||
      properties.colorStops !== undefined ||
      properties.style !== undefined ||
      properties.height !== undefined ||
      properties.extrudedHeight !== undefined ||
      properties.clampToGround !== undefined ||
      properties.fill !== undefined ||
      properties.outline !== undefined ||
      properties.outlineColor !== undefined ||
      properties.outlineWidth !== undefined;
    if (echoKeys || properties.targetData !== undefined) {
      if (echoKeys) this.mergeEchoIntoRecTargetData(rec);
      if (properties.targetData !== undefined) {
        rec.targetData = { ...rec.targetData, ...properties.targetData };
      }
    }

    return true;
  }

  /**
   * 批量更新墙体
   */
  updateWalls(
    updates: Array<{ id: string } & UpdateWallProperties>,
  ): Array<{ id: string; success: boolean }> {
    return updates.map((update) => {
      const { id, ...rest } = update;
      return { id, success: this.updateWall(id, rest) };
    });
  }

  /**
   * 获取墙体业务数据
   */
  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id);
    if (!rec) return undefined;
    return { ...rec.targetData };
  }

  /**
   * 设置墙体业务数据（整体替换）
   */
  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...targetData };
    return true;
  }

  /**
   * 合并墙体业务数据
   */
  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...rec.targetData, ...patch };
    return true;
  }

  /**
   * 获取墙体信息快照
   */
  getWall(id: string): WallSnapshot | null {
    const rec = this.takeIfAlive(id);
    if (!rec) return null;

    const wall = rec.entity.wall;
    if (!wall) return null;

    const positions = wall.positions?.getValue() as
      | Cesium.Cartesian3[]
      | undefined;
    const fill = wall.fill?.getValue() as boolean | undefined;
    const outline = wall.outline?.getValue() as boolean | undefined;
    const outlineWidth = wall.outlineWidth?.getValue() as number | undefined;
    const description = rec.entity.description?.getValue() as
      | string
      | undefined;

    // 获取高度信息
    const maxHeights = wall.maximumHeights?.getValue() as number[] | undefined;
    const minHeights = wall.minimumHeights?.getValue() as number[] | undefined;
    const height =
      maxHeights && maxHeights.length > 0 ? maxHeights[0] : undefined;
    const extrudedHeight =
      minHeights && minHeights.length > 0 ? minHeights[0] : undefined;

    // 判断是否贴地
    const wallExt = wall as unknown as {
      classificationType?: { getValue: (t?: Cesium.JulianDate) => unknown };
    };
    const classificationType = wallExt.classificationType?.getValue(
      Cesium.JulianDate.now(),
    ) as Cesium.ClassificationType | undefined;
    const clampToGround =
      classificationType === Cesium.ClassificationType.TERRAIN;

    // 解析颜色Css（纯色读 solidColor，兼容旧数据读 targetData.color）
    let colorCss: string | undefined;
    if (rec.materialType === "color") {
      const raw =
        rec.solidColor ??
        (typeof rec.targetData?.color === "string"
          ? rec.targetData.color
          : undefined);
      const c = this.resolveColor(raw as string | Cesium.Color);
      colorCss = c?.toCssColorString();
    }

    // 解析渐变色Css
    let gradientStartColorCss: string | undefined;
    let gradientEndColorCss: string | undefined;
    if (
      (rec.materialType === "gradientVertical" ||
        rec.materialType === "gradientHorizontal") &&
      rec.gradientStartColor
    ) {
      const start = this.resolveColor(
        rec.gradientStartColor as string | Cesium.Color,
      );
      const end = this.resolveColor(
        rec.gradientEndColor as string | Cesium.Color,
      );
      gradientStartColorCss = start?.toCssColorString();
      gradientEndColorCss = end?.toCssColorString();
    }

    // 解析多色渐变
    let colorStopsSnapshot:
      | Array<{ position: number; colorCss: string; alpha?: number }>
      | undefined;
    if (rec.materialType === "gradientMultiColor" && rec.colorStops) {
      colorStopsSnapshot = rec.colorStops.map((stop) => ({
        position: stop.position,
        colorCss:
          this.resolveColor(stop.color)?.toCssColorString() ?? "#ffffff",
        alpha: stop.alpha,
      }));
    }

    return {
      id: rec.entity.id,
      positions: positions ? [...positions] : [],
      materialType: rec.materialType,
      colorCss,
      imageUrl: rec.imageUrl,
      repeat: rec.repeat,
      gradientStartColorCss,
      gradientEndColorCss,
      gradientDirection: rec.gradientDirection,
      colorStops: colorStopsSnapshot,
      height,
      extrudedHeight,
      clampToGround,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description,
      fill: fill ?? true,
      outline: outline ?? false,
      outlineWidth,
    };
  }

  /**
   * 获取所有墙体
   */
  getAllWalls(viewer?: Viewer): WallSnapshot[] {
    const out: WallSnapshot[] = [];
    for (const id of this.getIds(viewer)) {
      const snapshot = this.getWall(id);
      if (snapshot) out.push(snapshot);
    }
    return out;
  }

  /**
   * 获取墙体数量
   */
  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length;
  }

  /**
   * 获取所有墙体ID
   */
  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer);
  }

  /**
   * 设置所有墙体显隐
   */
  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue;
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      rec.entity.show = show;
    }
  }

  /**
   * 设置指定墙体显隐
   */
  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show);
  }

  /**
   * 移除所有墙体
   */
  removeAll(viewer?: Viewer): void {
    this.clear(viewer);
  }

  /**
   * 获取Entity对象
   */
  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity;
  }

  /**
   * 检查墙体是否存在
   */
  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined;
  }

  /**
   * 获取所有墙体ID
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
   * 更新墙体样式
   */
  updateStyle(id: string, style: WallStyleOptions): boolean {
    return this.updateWall(id, { style });
  }

  /**
   * 更新墙体位置
   */
  setPositions(id: string, positions: WallPosition[]): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const wall = rec.entity.wall;
    if (!wall) return false;

    const cartesianPositions = this.positionsToCartesianArray(positions);
    wall.positions = new Cesium.ConstantProperty(cartesianPositions);
    rec.originalPositions = [...positions];

    return true;
  }

  /**
   * 设置墙体显隐
   */
  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.show = visible;
    return true;
  }

  /**
   * 显示墙体
   */
  show(id: string): boolean {
    return this.setVisible(id, true);
  }

  /**
   * 隐藏墙体
   */
  hide(id: string): boolean {
    return this.setVisible(id, false);
  }

  /**
   * 设置墙体描述
   */
  setDescription(id: string, description: string): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.description = new Cesium.ConstantProperty(description);
    return true;
  }

  /**
   * 设置墙体图片（适用于 imageRepeat 和 imageStretch 模式）
   */
  setImage(
    id: string,
    imageUrl: string,
    repeat?: { x: number; y: number },
  ): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const wall = rec.entity.wall;
    if (!wall) return false;

    const finalRepeat = repeat ?? rec.repeat ?? { x: 1, y: 1 };
    const material =
      rec.materialType === "imageStretch"
        ? this.createImageStretchMaterial(imageUrl)
        : this.createImageRepeatMaterial(imageUrl, finalRepeat);

    applyWallMaterialToGraphics(wall, rec, material, {
      url: imageUrl,
      repeat: finalRepeat,
    });
    rec.imageUrl = imageUrl;
    if (repeat) rec.repeat = repeat;
    if (!rec.viewer.isDestroyed()) rec.viewer.scene.requestRender();

    return true;
  }

  /**
   * 设置墙体渐变
   */
  setGradient(
    id: string,
    startColor: string | Cesium.Color,
    endColor: string | Cesium.Color,
    direction?: "vertical" | "horizontal",
  ): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const wall = rec.entity.wall;
    if (!wall) return false;

    const dir = direction ?? rec.gradientDirection ?? "vertical";
    const material =
      dir === "vertical"
        ? this.createVerticalGradientMaterial(
            this.resolveColor(startColor)!,
            this.resolveColor(endColor)!,
          )
        : this.createHorizontalGradientMaterial(
            this.resolveColor(startColor)!,
            this.resolveColor(endColor)!,
          );

    applyWallMaterialToGraphics(wall, rec, material);
    rec.materialType =
      dir === "vertical" ? "gradientVertical" : "gradientHorizontal";
    rec.gradientStartColor = startColor;
    rec.gradientEndColor = endColor;
    rec.gradientDirection = dir;
    if (!rec.viewer.isDestroyed()) rec.viewer.scene.requestRender();

    return true;
  }

  /**
   * 设置墙体多色渐变
   */
  setMultiColorGradient(
    id: string,
    colorStops: ColorStop[],
    direction?: "vertical" | "horizontal",
  ): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const wall = rec.entity.wall;
    if (!wall) return false;

    const dir = direction ?? rec.gradientDirection ?? "vertical";
    const material = this.createMultiColorGradientMaterial(colorStops, dir);

    applyWallMaterialToGraphics(wall, rec, material);
    rec.materialType = "gradientMultiColor";
    rec.colorStops = colorStops;
    rec.gradientDirection = dir;
    if (!rec.viewer.isDestroyed()) rec.viewer.scene.requestRender();

    return true;
  }

  /**
   * 设置墙体高度
   */
  setHeight(id: string, height: number): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const wall = rec.entity.wall;
    if (!wall) return false;

    const positions = wall.positions?.getValue() as Cesium.Cartesian3[];
    if (positions) {
      wall.maximumHeights = new Cesium.ConstantProperty(
        new Array(positions.length).fill(height),
      );
    }

    return true;
  }

  /**
   * 移除单个墙体
   */
  remove(id: string): boolean {
    const rec = this.data.get(id);
    if (!rec) return false;

    rec.fabricMatProp?.dispose();
    this.data.delete(id);

    if (!rec.viewer.isDestroyed() && rec.viewer.entities.contains(rec.entity)) {
      rec.viewer.entities.remove(rec.entity);
    }

    return true;
  }

  /**
   * 批量移除墙体
   */
  removeBatch(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.remove(id)) count++;
    }
    return count;
  }

  /**
   * 清理墙体（可指定viewer）
   */
  clear(viewer?: Viewer): void {
    const toRemove: string[] = [];
    for (const [id, rec] of this.data) {
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      toRemove.push(id);
    }
    for (const id of toRemove) {
      this.remove(id);
    }
  }

  /**
   * 清理无效墙体（Entity已被删除）
   */
  pruneInvalid(): number {
    let count = 0;
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) {
        this.data.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * 销毁所有墙体
   */
  destroy(): void {
    this.clear();
  }
}
