/**
 * Globe 等高线 Shader 材质：在指定矩形范围内按高程间隔绘制等高线。
 */
import * as Cesium from 'cesium'
import type { LngLatHeightTuple } from './types'

/** 等高线 Shader 图层参数 */
export interface ContourShaderLayer {
  color: string
  spacing: number
  width: number
  range: [number, number, number, number]
}

const GLSL = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

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
  return vec2(degrees(longitude), degrees(latitude));
}

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec3 positionEC = -materialInput.positionToEyeEC;
  vec3 positionWC = (czm_inverseView * vec4(positionEC, 1.0)).xyz;
  vec2 sphericalLatLong = ECEF_TO_LLH(positionWC);
  float lon = sphericalLatLong.x;
  float lat = sphericalLatLong.y;
  float minLon = min(u_range.x, u_range.z);
  float maxLon = max(u_range.x, u_range.z);
  float minLat = min(u_range.y, u_range.w);
  float maxLat = max(u_range.y, u_range.w);
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
    material.alpha = 0.0;
    return material;
  }
  float height = materialInput.height;
  float distanceToContour = mod(height, u_spacing);
  #if (__VERSION__ == 300 || defined(GL_OES_standard_derivatives))
  float dxc = abs(dFdx(height));
  float dyc = abs(dFdy(height));
  float dF = max(dxc, dyc) * czm_pixelRatio * u_width;
  float alpha = (distanceToContour < dF) ? 1.0 : 0.0;
  #else
  float alpha = (distanceToContour < (czm_pixelRatio * u_width)) ? 1.0 : 0.0;
  #endif
  material.diffuse = u_color.rgb;
  material.alpha = alpha * u_color.a;
  return material;
}
`

/**
 * 由对角两点构建 Shader 图层参数。
 * @param p0 角点 1
 * @param p1 角点 2
 * @param color 线条颜色
 * @param spacing 等高距（米）
 * @param width 线宽（像素）
 */
export function layerFromCorners(
  p0: LngLatHeightTuple,
  p1: LngLatHeightTuple,
  color: string,
  spacing: number,
  width: number,
): ContourShaderLayer {
  return {
    color,
    spacing,
    width,
    range: [
      Math.min(p0[0], p1[0]),
      Math.min(p0[1], p1[1]),
      Math.max(p0[0], p1[0]),
      Math.max(p0[1], p1[1]),
    ],
  }
}

/**
 * 将等高线 Shader 材质应用到 Globe。
 * @param globe Cesium Globe
 * @param layer 图层参数
 */
export function applyContourGlobeShader(globe: Cesium.Globe, layer: ContourShaderLayer): void {
  globe.material = new Cesium.Material({
    fabric: {
      type: 'FastXContourGlobe',
      uniforms: {
        u_range: new Cesium.Cartesian4(layer.range[0], layer.range[1], layer.range[2], layer.range[3]),
        u_color: Cesium.Color.fromCssColorString(layer.color),
        u_spacing: layer.spacing,
        u_width: layer.width,
      },
      source: GLSL,
    },
  })
}

/**
 * 清除 Globe 上的等高线 Shader 材质。
 * @param globe Cesium Globe
 */
export function clearContourGlobeShader(globe: Cesium.Globe): void {
  globe.material = undefined as unknown as Cesium.Material
}
