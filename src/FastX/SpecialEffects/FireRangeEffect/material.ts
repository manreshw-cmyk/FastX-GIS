import * as Cesium from "cesium";
import type { FireRangeEffectResolvedOptions } from ".";

const FIRE_RANGE_GRADIENT_SOURCE = `
uniform vec4 apexColor;
uniform vec4 middleColor;
uniform vec4 farColor;
uniform float fillAlpha;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
  czm_material material = czm_getDefaultMaterial(materialInput);
  float radial = clamp(materialInput.st.s, 0.0, 1.0);
  float vertical = clamp(materialInput.st.t, 0.0, 1.0);
  float nearToMiddle = smoothstep(0.0, 0.58, radial);
  float middleToFar = smoothstep(0.45, 1.0, radial);
  vec4 color = mix(apexColor, middleColor, nearToMiddle);
  color = mix(color, farColor, middleToFar);

  float wallWeight = smoothstep(0.78, 1.0, radial);
  float verticalEdge = abs(vertical - 0.5) * 2.0;
  color.rgb = mix(color.rgb, farColor.rgb, wallWeight * verticalEdge * 0.28);

  material.diffuse = color.rgb;
  material.alpha = color.a * fillAlpha;
  return material;
}
`;

/** 创建火力范围体填充面使用的径向渐变材质。 */
export function createFireRangeGradientMaterial(options: FireRangeEffectResolvedOptions): Cesium.Material {
  return new Cesium.Material({
    fabric: {
      type: "FastXFireRangeGradient",
      uniforms: {
        apexColor: Cesium.Color.clone(options.apexColor),
        middleColor: Cesium.Color.clone(options.middleColor),
        farColor: Cesium.Color.clone(options.farColor),
        fillAlpha: options.fillAlpha,
      },
      source: FIRE_RANGE_GRADIENT_SOURCE,
    },
  });
}
