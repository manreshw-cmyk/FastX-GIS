import * as Cesium from "cesium";

/** 普通经纬网线默认颜色：与 freexdemo FeLonLatGrid 保持一致。 */
const DEFAULT_LINE_COLOR = "rgba(255, 255, 255, 0.8)";
/** 特殊经纬线默认颜色：赤道、本初子午线、回归线、极圈等使用黄色。 */
const DEFAULT_SPECIAL_LINE_COLOR = "rgba(255, 255, 0, 1.0)";
/** 标签默认字体：与 freexdemo FeLonLatGrid 保持一致。 */
const DEFAULT_FONT = "16px 宋体";
/** 普通线默认像素宽度。 */
const DEFAULT_LINE_WIDTH = 1.0;
/** 特殊线默认像素宽度。 */
const DEFAULT_SPECIAL_LINE_WIDTH = 1.0;
/** 标签与特殊线贴地高度，单位米；1 米用于避免 z-fighting。 */
const LABEL_AND_LINE_HEIGHT = 1;
/** 相机高度低于该值时隐藏经纬网，单位米。 */
const MIN_SHOW_HEIGHT = 26000;
/** 经纬网标签和特殊线的采样步长，单位度。 */
const QUARTER_DEGREE = 0.25;
/** 将小数经纬度转为 0.25 度整数单位，用于避免浮点取模误差。 */
const QUARTER_DEGREE_UNITS = 4;

const GRID_GLOBE_SHADER = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

uniform bool lonLatGrid_show;
uniform vec4 lonLatGrid_color;
uniform float lonLatGrid_width;
uniform float lonLatGrid_spacing;

vec2 ECEF_TO_LLH(vec3 xyz) {
  const float radiusEquator = 6378137.0;
  const float radiusPolar = 6356752.3142;

  float p = sqrt(xyz.x * xyz.x + xyz.y * xyz.y);
  float theta = atan(xyz.z * radiusEquator, p * radiusPolar);
  float eDashSquared =
    (radiusEquator * radiusEquator - radiusPolar * radiusPolar) /
    (radiusPolar * radiusPolar);
  float sin_theta = sin(theta);
  float cos_theta = cos(theta);
  float flattening = (radiusEquator - radiusPolar) / radiusEquator;
  float eccentricitySquared = 2.0 * flattening - flattening * flattening;
  float latitude = atan(
    (xyz.z + eDashSquared * radiusPolar * sin_theta * sin_theta * sin_theta) /
    (p - eccentricitySquared * radiusEquator * cos_theta * cos_theta * cos_theta)
  );
  float longitude = atan(xyz.y, xyz.x);
  longitude = degrees(longitude);
  latitude = degrees(latitude);
  return vec2(longitude, latitude);
}

czm_material hgt_lonLatGrid(czm_material material, vec2 sphericalLatLong) {
  float distanceToContourLon = mod(sphericalLatLong.x, lonLatGrid_spacing);
  float distanceToContourLat = mod(sphericalLatLong.y, lonLatGrid_spacing);

  #if (__VERSION__ == 300 || defined(GL_OES_standard_derivatives))
  float dxcLon = abs(dFdx(sphericalLatLong.x));
  float dycLon = abs(dFdy(sphericalLatLong.x));
  float dFLon = max(dxcLon, dycLon) * czm_pixelRatio * lonLatGrid_width;

  float dxcLat = abs(dFdx(sphericalLatLong.y));
  float dycLat = abs(dFdy(sphericalLatLong.y));
  float dFLat = max(dxcLat, dycLat) * czm_pixelRatio * lonLatGrid_width;

  float alpha =
    ((distanceToContourLon < dFLon) || (distanceToContourLat < dFLat))
      ? 1.0
      : 0.0;
  #else
  float alpha =
    ((distanceToContourLon < (czm_pixelRatio * lonLatGrid_width)) ||
     (distanceToContourLat < (czm_pixelRatio * lonLatGrid_width)))
      ? 1.0
      : 0.0;
  #endif

  vec4 outColor = czm_gammaCorrect(
    vec4(lonLatGrid_color.rgb, alpha * lonLatGrid_color.a)
  );
  material.diffuse = outColor.rgb;
  material.alpha = outColor.a;
  return material;
}

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  material.alpha = 0.0;

  if (lonLatGrid_show == false || lonLatGrid_spacing <= 0.0) {
    return material;
  }

  vec3 positionEC = -materialInput.positionToEyeEC;
  vec3 positionWC = (czm_inverseView * vec4(positionEC, 1.0)).xyz;
  vec2 sphericalLatLong = ECEF_TO_LLH(positionWC);
  return hgt_lonLatGrid(material, sphericalLatLong);
}
`;

/** 单条特殊经纬线的数值与标签文本。 */
interface SpecialLine {
  /** 经度或纬度值，单位度。 */
  value: number;
  /** 特殊线显示的中文名称。 */
  text: string;
}

/** 标签运行时引用，用于动态显隐和跟随屏幕中心移动。 */
interface GridLabelRef {
  /** Cesium 标签对象。 */
  label: Cesium.Label;
  /** 标签对应的经度或纬度值，单位度。 */
  value: number;
  /** `true` 表示纬线标签，`false` 表示经线标签。 */
  isLat: boolean;
  /** `true` 表示特殊线标签，特殊标签不随网格间隔隐藏。 */
  special: boolean;
}

/** Cesium 内部瓦片渲染队列，仅用于读取当前屏幕平均瓦片级别。 */
type GlobeWithTiles = Cesium.Globe & {
  _surface?: {
    _tilesToRender?: Array<{ level?: number }>;
  };
};

/**
 * 3D 经纬网配置。
 *
 * 默认值完全按 `E:\freexdemo` 中 `FeLonLatGrid` 的视觉参数设置：
 * 普通线白色 0.8 透明度、特殊线黄色、字体 `16px 宋体`、线宽 1px。
 */
export interface LonLatGridOptions {
  /** 普通经纬网线颜色，支持 CSS 字符串或 Cesium.Color。 */
  lineColor?: string | Cesium.Color;
  /** 普通经纬网线宽，单位像素。 */
  width?: number;
  /** 普通经纬网线宽别名，便于业务侧按语义传参。 */
  lineWidth?: number;
  /** 特殊经纬线颜色，支持 CSS 字符串或 Cesium.Color。 */
  specialColor?: string | Cesium.Color;
  /** 特殊经纬线颜色别名。 */
  specialLineColor?: string | Cesium.Color;
  /** 特殊经纬线线宽，单位像素。 */
  specialWidth?: number;
  /** 特殊经纬线线宽别名。 */
  specialLineWidth?: number;
  /** 经纬标签字体。 */
  font?: string;
  /** 普通经纬标签颜色，默认跟随普通经纬网线颜色。 */
  fontColor?: string | Cesium.Color;
  /** 特殊经纬标签颜色，默认跟随特殊经纬线颜色。 */
  specialFontColor?: string | Cesium.Color;
}

/** 将字符串或 Cesium.Color 统一转为新的 Cesium.Color 实例。 */
function colorFromInput(
  value: string | Cesium.Color | undefined,
  fallback: string | Cesium.Color,
): Cesium.Color {
  if (value instanceof Cesium.Color) return Cesium.Color.clone(value);
  if (fallback instanceof Cesium.Color) return Cesium.Color.clone(fallback);
  return Cesium.Color.fromCssColorString(value ?? fallback);
}

/** 将颜色输入标准化为 CSS 字符串，便于 getter 返回和颜色相等判断。 */
function colorCssFromInput(
  value: string | Cesium.Color | undefined,
  fallback: string | Cesium.Color,
): string {
  if (value instanceof Cesium.Color) return value.toCssColorString();
  if (fallback instanceof Cesium.Color) return fallback.toCssColorString();
  return value ?? fallback;
}

/** 把经纬度映射成 0.25 度单位的整数，消除浮点步进带来的 `%` 误差。 */
function quarterUnits(value: number): number {
  return Math.round(value * QUARTER_DEGREE_UNITS);
}

/** 保留参考实现标签文本里的整数/小数表现，不额外补零。 */
function formatDegree(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${value}`;
}

/** 生成普通经线标签文本，例如 `W120°`、`E10.25°`。 */
function formatLonLabel(value: number): string {
  return value < 0
    ? `W${formatDegree(Math.abs(value))}°`
    : `E${formatDegree(value)}°`;
}

/** 生成普通纬线标签文本，例如 `S30°`、`N23.5°`。 */
function formatLatLabel(value: number): string {
  return value < 0
    ? `S${formatDegree(Math.abs(value))}°`
    : `N${formatDegree(value)}°`;
}

/**
 * 基于 Cesium Globe shader 绘制的三维经纬网。
 *
 * 普通经纬网通过地球材质绘制，特殊经纬线和文字通过 Primitive/LabelCollection 绘制。
 * 视觉参数、网格级别切换、特殊线范围和标签步长均按 `E:\freexdemo` 的
 * `FeLonLatGrid` 实现对齐。
 */
export class LonLatGrid {
  /** 当前 Cesium Viewer。 */
  private readonly viewer: Cesium.Viewer;
  /** Viewer 的 primitive 容器，用来挂载特殊线和标签。 */
  private readonly primitives: Cesium.PrimitiveCollection;
  /** 所有经纬标签的运行时引用。 */
  private readonly labels: GridLabelRef[] = [];
  /** 创建经纬网前的 globe material，销毁时恢复。 */
  private readonly previousGlobeMaterial: Cesium.Material | undefined;

  /** 普通经纬网线颜色 CSS 值。 */
  private lineColorCss: string;
  /** 特殊经纬线颜色 CSS 值。 */
  private specialLineColorCss: string;
  /** 普通经纬标签颜色 CSS 值。 */
  private fontColorCss: string;
  /** 特殊经纬标签颜色 CSS 值。 */
  private specialFontColorCss: string;
  /** 经纬标签字体。 */
  private font: string;
  /** 普通经纬网线宽，单位像素。 */
  private lineWidth: number;
  /** 特殊经纬线线宽，单位像素。 */
  private specialLineWidth: number;

  /** 普通经纬网地球材质。 */
  private material: Cesium.Material | undefined;
  /** 特殊经纬线 Primitive。 */
  private specialLinePrimitive: Cesium.Primitive | undefined;
  /** 特殊线 Primitive 使用的颜色材质，便于运行时改色。 */
  private specialLineMaterial: Cesium.Material | undefined;
  /** 经纬标签集合。 */
  private labelCollection: Cesium.LabelCollection | undefined;
  /** postRender 监听移除函数。 */
  private removePostRender: (() => void) | undefined;
  /** 外部控制显隐状态；高度过低时会临时隐藏但不改变该值。 */
  private visible = true;
  /** 上一帧高度可见状态，用于从隐藏恢复时重新设置标签显隐。 */
  private heightVisible = true;
  /** 当前屏幕下瓦片等级平均值，用于决定网格间隔。 */
  private level = -1;
  /** 当前网格细分间隔，单位度。 */
  private gridSubdivide = -1;
  /** 销毁标记，避免重复回收 Cesium 资源。 */
  private destroyed = false;

  /** 需要高亮的经线：本初子午线与逆本初子午线。 */
  private readonly specialLonLines: SpecialLine[] = [
    { value: 0, text: "本初子午线" },
    { value: 180, text: "逆本初子午线" },
  ];

  /** 需要高亮的纬线：赤道、回归线、极圈。 */
  private readonly specialLatLines: SpecialLine[] = [
    { value: 0, text: "赤道" },
    { value: 23.5, text: "北回归线" },
    { value: -23.5, text: "南回归线" },
    { value: 66.5, text: "北极圈" },
    { value: -66.5, text: "南极圈" },
  ];

  /**
   * 创建三维经纬网。
   *
   * @param viewer Cesium Viewer。
   * @param options 可选样式配置；不传时使用 freexdemo 默认视觉参数。
   */
  constructor(viewer: Cesium.Viewer, options: LonLatGridOptions = {}) {
    this.viewer = viewer;
    this.primitives = viewer.scene.primitives;
    this.lineColorCss = colorCssFromInput(
      options.lineColor,
      DEFAULT_LINE_COLOR,
    );
    this.specialLineColorCss = colorCssFromInput(
      options.specialLineColor ?? options.specialColor,
      DEFAULT_SPECIAL_LINE_COLOR,
    );
    this.fontColorCss = colorCssFromInput(
      options.fontColor,
      options.lineColor ?? DEFAULT_LINE_COLOR,
    );
    this.specialFontColorCss = colorCssFromInput(
      options.specialFontColor,
      options.specialLineColor ??
        options.specialColor ??
        DEFAULT_SPECIAL_LINE_COLOR,
    );
    this.font = options.font ?? DEFAULT_FONT;
    this.lineWidth =
      options.lineWidth ?? options.width ?? DEFAULT_LINE_WIDTH;
    this.specialLineWidth =
      options.specialLineWidth ??
      options.specialWidth ??
      DEFAULT_SPECIAL_LINE_WIDTH;
    this.previousGlobeMaterial = viewer.scene.globe.material;

    this.initBaseGridMaterial();
    this.initSpecialLines();
    this.initLabels();
    this.removePostRender = viewer.scene.postRender.addEventListener(() => {
      this.update();
    });
    this.update();
  }

  /** 销毁经纬网，移除特殊线、标签和监听，并恢复创建前的 globe material。 */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removePostRender?.();
    this.removePostRender = undefined;

    const globe = this.viewer.scene.globe;
    if (globe.material === this.material) {
      globe.material = this.previousGlobeMaterial;
    }
    this.material = undefined;

    if (this.specialLinePrimitive) {
      this.primitives.remove(this.specialLinePrimitive);
      this.specialLinePrimitive = undefined;
      this.specialLineMaterial = undefined;
    }
    if (this.labelCollection) {
      this.primitives.remove(this.labelCollection);
      this.labelCollection = undefined;
    }
    this.labels.length = 0;
    this.viewer.scene.requestRender();
  }

  /**
   * 设置经纬网显隐。
   *
   * @param flag `true` 显示，`false` 隐藏。
   */
  setVisible(flag: boolean): void {
    if (this.destroyed || this.visible === flag) return;
    this.visible = flag;

    if (flag) {
      this.removePostRender?.();
      this.removePostRender = this.viewer.scene.postRender.addEventListener(
        () => {
          this.update();
        },
      );
      this.update();
    } else {
      this.removePostRender?.();
      this.removePostRender = undefined;
      this.heightVisible = false;
      this.applyHeightVisibility(false);
    }
    this.viewer.scene.requestRender();
  }

  /** 获取外部显隐状态。 */
  getVisible(): boolean {
    return this.visible;
  }

  /** 设置全部标签字体。 */
  setFont(font: string): void {
    if (!font || this.font === font) return;
    this.font = font;
    for (const item of this.labels) item.label.font = font;
    this.viewer.scene.requestRender();
  }

  /** 获取当前标签字体。 */
  getFont(): string {
    return this.font;
  }

  /** 设置普通经纬标签颜色。 */
  setFontColor(color: string | Cesium.Color): void {
    const css = colorCssFromInput(color, this.fontColorCss);
    if (!css || this.fontColorCss === css) return;
    this.fontColorCss = css;
    const fillColor = colorFromInput(color, this.fontColorCss);
    for (const item of this.labels) {
      if (!item.special) item.label.fillColor = Cesium.Color.clone(fillColor);
    }
    this.viewer.scene.requestRender();
  }

  /** 获取普通经纬标签颜色 CSS 值。 */
  getFontColor(): string {
    return this.fontColorCss;
  }

  /** 设置特殊经纬标签颜色。 */
  setSpecialFontColor(color: string | Cesium.Color): void {
    const css = colorCssFromInput(color, this.specialFontColorCss);
    if (!css || this.specialFontColorCss === css) return;
    this.specialFontColorCss = css;
    const fillColor = colorFromInput(color, this.specialFontColorCss);
    for (const item of this.labels) {
      if (item.special) item.label.fillColor = Cesium.Color.clone(fillColor);
    }
    this.viewer.scene.requestRender();
  }

  /** 获取特殊经纬标签颜色 CSS 值。 */
  getSpecialFontColor(): string {
    return this.specialFontColorCss;
  }

  /** 设置普通经纬网线颜色。 */
  setLineColor(color: string | Cesium.Color): void {
    const css = colorCssFromInput(color, this.lineColorCss);
    if (!css || this.lineColorCss === css) return;
    this.lineColorCss = css;
    if (this.material) {
      this.material.uniforms.lonLatGrid_color = colorFromInput(
        color,
        this.lineColorCss,
      );
    }
    this.viewer.scene.requestRender();
  }

  /** 获取普通经纬网线颜色 CSS 值。 */
  getLineColor(): string {
    return this.lineColorCss;
  }

  /** 设置普通经纬网线宽，单位像素。 */
  setLineWidth(width: number): void {
    if (!Number.isFinite(width) || width <= 0 || this.lineWidth === width) {
      return;
    }
    this.lineWidth = width;
    if (this.material) this.material.uniforms.lonLatGrid_width = width;
    this.viewer.scene.requestRender();
  }

  /** 获取普通经纬网线宽，单位像素。 */
  getLineWidth(): number {
    return this.lineWidth;
  }

  /** 设置特殊经纬线颜色。 */
  setSpecialLineColor(color: string | Cesium.Color): void {
    const css = colorCssFromInput(color, this.specialLineColorCss);
    if (!css || this.specialLineColorCss === css) return;
    this.specialLineColorCss = css;
    if (this.specialLineMaterial) {
      this.specialLineMaterial.uniforms.color = colorFromInput(
        color,
        this.specialLineColorCss,
      );
    }
    this.viewer.scene.requestRender();
  }

  /** 获取特殊经纬线颜色 CSS 值。 */
  getSpecialLineColor(): string {
    return this.specialLineColorCss;
  }

  /**
   * 初始化普通经纬网地球材质。
   *
   * 普通网格不创建影像 Provider，而是直接通过 Globe material 在地球表面绘制。
   */
  private initBaseGridMaterial(): void {
    this.material = new Cesium.Material({
      fabric: {
        type: "FastXLonLatGrid",
        uniforms: {
          lonLatGrid_show: true,
          lonLatGrid_color: colorFromInput(
            this.lineColorCss,
            DEFAULT_LINE_COLOR,
          ),
          lonLatGrid_width: this.lineWidth,
          lonLatGrid_spacing: 10,
        },
        source: GRID_GLOBE_SHADER,
      },
      translucent: false,
    });
    this.viewer.scene.globe.material = this.material;
  }

  /** 初始化特殊经纬线 Primitive。 */
  private initSpecialLines(): void {
    const instances: Cesium.GeometryInstance[] = [];

    for (const line of this.specialLonLines) {
      const positions: number[] = [];
      for (let lat = -90; lat <= 90; lat += QUARTER_DEGREE) {
        positions.push(line.value, Number(lat.toFixed(2)), LABEL_AND_LINE_HEIGHT);
      }
      instances.push(this.createPolylineInstance(positions));
    }

    for (const line of this.specialLatLines) {
      const positions: number[] = [];
      for (let lon = -180; lon <= 180; lon += QUARTER_DEGREE) {
        positions.push(Number(lon.toFixed(2)), line.value, LABEL_AND_LINE_HEIGHT);
      }
      instances.push(this.createPolylineInstance(positions));
    }

    this.specialLineMaterial = Cesium.Material.fromType(
      Cesium.Material.ColorType,
      {
        color: colorFromInput(
          this.specialLineColorCss,
          DEFAULT_SPECIAL_LINE_COLOR,
        ),
      },
    );
    this.specialLinePrimitive = this.primitives.add(
      new Cesium.Primitive({
        geometryInstances: instances,
        appearance: new Cesium.PolylineMaterialAppearance({
          material: this.specialLineMaterial,
        }),
        allowPicking: false,
      }),
    ) as Cesium.Primitive;
  }

  /** 根据经纬度数组创建单条特殊线几何实例。 */
  private createPolylineInstance(positions: number[]): Cesium.GeometryInstance {
    return new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
        width: this.specialLineWidth,
        vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
      }),
    });
  }

  /**
   * 初始化全部经纬标签。
   *
   * 经线范围 `[-180, 180)`、纬线范围 `[-80, 80]`、步长 0.25 度，
   * 与 freexdemo 的标签生成逻辑一致。
   */
  private initLabels(): void {
    this.labelCollection = new Cesium.LabelCollection({
      scene: this.viewer.scene,
    });

    for (let lon = -180; lon < 180; lon += QUARTER_DEGREE) {
      const value = Number(lon.toFixed(2));
      const special = this.specialLonLines.find((item) => item.value === value);
      this.addLabel({
        value,
        isLat: false,
        special: Boolean(special),
        position: [value, 0],
        text: special?.text ?? formatLonLabel(value),
      });
    }

    for (let lat = -80; lat <= 80; lat += QUARTER_DEGREE) {
      const value = Number(lat.toFixed(2));
      const special = this.specialLatLines.find((item) => item.value === value);
      this.addLabel({
        value,
        isLat: true,
        special: Boolean(special),
        position: [0, value],
        text: special?.text ?? formatLatLabel(value),
      });
    }

    this.labelCollection = this.primitives.add(
      this.labelCollection,
    ) as Cesium.LabelCollection;
  }

  /** 添加单个经纬标签并登记运行时引用。 */
  private addLabel(options: {
    value: number;
    isLat: boolean;
    special: boolean;
    position: [number, number];
    text: string;
  }): void {
    if (!this.labelCollection) return;
    const label = this.labelCollection.add({
      id: options.value,
      show: options.special,
      position: Cesium.Cartesian3.fromDegrees(
        options.position[0],
        options.position[1],
        LABEL_AND_LINE_HEIGHT,
      ),
      text: options.text,
      font: this.font,
      fillColor: colorFromInput(
        options.special ? this.specialFontColorCss : this.fontColorCss,
        options.special ? DEFAULT_SPECIAL_LINE_COLOR : DEFAULT_LINE_COLOR,
      ),
    });
    this.labels.push({
      label,
      value: options.value,
      isLat: options.isLat,
      special: options.special,
    });
  }

  /** 每帧更新经纬网显隐、标签位置和网格间隔。 */
  private update(): void {
    if (this.destroyed || !this.visible || this.viewer.isDestroyed()) return;

    const shouldShow =
      this.viewer.camera.positionCartographic.height > MIN_SHOW_HEIGHT;
    if (!shouldShow) {
      if (this.heightVisible) {
        this.heightVisible = false;
        this.applyHeightVisibility(false);
      }
      return;
    }

    if (!this.heightVisible) {
      this.heightVisible = true;
      this.applyHeightVisibility(true);
      this.updateLabelShow();
    }

    this.updateLabelPosition();

    const nextLevel = this.getCurrentTileLevel();
    if (!nextLevel || nextLevel === this.level) return;
    this.level = nextLevel;

    const nextSubdivide = this.getGridSubdivide();
    if (nextSubdivide === this.gridSubdivide) return;
    this.gridSubdivide = nextSubdivide;
    if (this.material) {
      this.material.uniforms.lonLatGrid_spacing = this.gridSubdivide;
    }
    this.updateLabelShow();
  }

  /** 应用高度阈值导致的整组显隐。 */
  private applyHeightVisibility(flag: boolean): void {
    if (this.material) this.material.uniforms.lonLatGrid_show = flag;
    if (this.specialLinePrimitive) this.specialLinePrimitive.show = flag;
    if (!flag) {
      for (const item of this.labels) item.label.show = false;
    }
  }

  /** 根据屏幕中心经纬度移动可见标签，使标签始终贴近当前视口中心十字。 */
  private updateLabelPosition(): void {
    const center = this.pickCanvasCenterLonLat();
    if (!center) return;

    for (const item of this.labels) {
      if (!item.label.show) continue;
      item.label.position = item.isLat
        ? Cesium.Cartesian3.fromDegrees(
            center.longitude,
            item.value,
            LABEL_AND_LINE_HEIGHT,
          )
        : Cesium.Cartesian3.fromDegrees(
            item.value,
            center.latitude,
            LABEL_AND_LINE_HEIGHT,
          );
    }
  }

  /** 根据当前网格间隔更新普通标签显隐，特殊线标签始终显示。 */
  private updateLabelShow(): void {
    for (const item of this.labels) {
      item.label.show =
        item.special || this.shouldShowRegularLabel(item.value);
    }
  }

  /** 判断某个普通标签是否落在当前网格间隔上。 */
  private shouldShowRegularLabel(value: number): boolean {
    const stepUnits = Math.max(1, quarterUnits(this.gridSubdivide));
    return quarterUnits(value) % stepUnits === 0;
  }

  /** 获取当前渲染瓦片的平均级别。 */
  private getCurrentTileLevel(): number | undefined {
    const tiles = (this.viewer.scene.globe as GlobeWithTiles)._surface
      ?._tilesToRender;
    if (!tiles?.length) return undefined;
    const total = tiles.reduce((sum, tile) => sum + (tile.level ?? 0), 0);
    return Math.round(total / tiles.length);
  }

  /** 根据瓦片级别计算网格间隔，单位度。 */
  private getGridSubdivide(): number {
    if (!this.level || this.level <= 2) return 10;
    if (this.level <= 5) return 5;
    if (this.level <= 7) return 2;
    if (this.level <= 9) return 1;
    return QUARTER_DEGREE;
  }

  /** 拾取屏幕中心点对应的地表经纬度。 */
  private pickCanvasCenterLonLat():
    | { longitude: number; latitude: number }
    | undefined {
    const scene = this.viewer.scene;
    const canvas = scene.canvas;
    const center = new Cesium.Cartesian2(
      canvas.width * 0.5,
      canvas.height * 0.5,
    );
    const ray = this.viewer.camera.getPickRay(center);
    if (!ray) return undefined;
    const cartesian = scene.globe.pick(ray, scene);
    if (!cartesian) return undefined;
    const cartographic = scene.globe.ellipsoid.cartesianToCartographic(
      cartesian,
    );
    if (!cartographic) return undefined;
    return {
      longitude: Cesium.Math.toDegrees(cartographic.longitude),
      latitude: Cesium.Math.toDegrees(cartographic.latitude),
    };
  }
}
