/**
 * 扇弧形雷达扫描 Shader 材质。
 * 扫描块边界由真实几何决定，Shader 只负责稳定的填充和边缘质感。
 */
import * as Cesium from "cesium";
import { registerCesiumMaterial } from "../shared";
import type { SectorArcRadarScanResolvedOptions } from ".";

/** 扇弧形雷达扫描自定义材质类型。 */
export const SECTOR_ARC_RADAR_SCAN_MATERIAL_TYPE = "FastXSectorArcRadarScanMaterial";

/** Shader 使用的 Uniform 集合。 */
export interface SectorArcRadarScanMaterialUniforms extends Record<string, unknown> {
  /** 扫描块填充颜色。 */
  color: Cesium.Color;
  /** 扫描块边缘颜色。 */
  lineColor: Cesium.Color;
  /** 边缘亮度强度。 */
  edgeStrength: number;
}

/** 注册扇弧形雷达扫描 Shader 材质。 */
export function registerSectorArcRadarScanMaterial(): void {
  registerCesiumMaterial(
    SECTOR_ARC_RADAR_SCAN_MATERIAL_TYPE,
    createDefaultSectorArcRadarScanUniforms(),
    `
      float fastx_sector_scan_edge(float distanceToEdge, float edgeWidth) {
        return 1.0 - smoothstep(0.0, edgeWidth, distanceToEdge);
      }

      czm_material czm_getMaterial(czm_materialInput materialInput) {
        czm_material material = czm_getDefaultMaterial(materialInput);
        vec2 st = clamp(materialInput.st, 0.0, 1.0);
        float u = st.s;
        float v = st.t;
        float edgeDistance = min(min(u, 1.0 - u), min(v, 1.0 - v));
        float edge = fastx_sector_scan_edge(edgeDistance, 0.016) * edgeStrength;
        material.diffuse = mix(color.rgb, lineColor.rgb, clamp(edge * lineColor.a, 0.0, 1.0));
        material.alpha = max(color.a, edge * lineColor.a);
        return material;
      }
    `,
  );
}

/** 创建 Primitive 使用的扫描材质。 */
export function createSectorArcRadarScanMaterial(options: SectorArcRadarScanResolvedOptions): Cesium.Material {
  registerSectorArcRadarScanMaterial();
  return Cesium.Material.fromType(
    SECTOR_ARC_RADAR_SCAN_MATERIAL_TYPE,
    createSectorArcRadarScanUniforms(options),
  );
}

/** 创建当前扫描块使用的 Shader Uniform。 */
function createSectorArcRadarScanUniforms(options: SectorArcRadarScanResolvedOptions): SectorArcRadarScanMaterialUniforms {
  return {
    color: options.scanColor,
    lineColor: options.scanLineColor,
    edgeStrength: 1,
  };
}

/** 创建材质注册时使用的默认 Uniform。 */
function createDefaultSectorArcRadarScanUniforms(): SectorArcRadarScanMaterialUniforms {
  return {
    color: Cesium.Color.YELLOW,
    lineColor: Cesium.Color.LIME,
    edgeStrength: 1,
  };
}
