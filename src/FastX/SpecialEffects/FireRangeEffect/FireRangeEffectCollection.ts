/**
 * 火力范围 Primitive 批量绘制类。
 *
 * 批量绘制使用专用 Primitive，可渲染带径向渐变的填充面，并复用单体相同的火力范围几何。
 */
import * as Cesium from "cesium";
import { PrimitiveEffectBase } from "../common/effect-core";
import {
  createFireRangeGeometry,
  type FireRangeLineSpec,
  type FireRangeSurfaceMesh,
} from "./geometry";
import { createFireRangeGradientMaterial } from "./material";
import type {
  FireRangeEffectAddOptions,
  FireRangeEffectResolvedOptions,
  FireRangeEffectUpdateOptions,
} from ".";
import { resolveFireRangeEffectOptions } from ".";

/** 火力范围 Primitive 批量绘制类。 */
export default class FireRangeEffectCollection extends PrimitiveEffectBase<
  FireRangeEffectAddOptions,
  FireRangeEffectResolvedOptions
> {
  constructor() {
    super("fire-range-effect");
  }

  /** 批量新增火力范围 Primitive，返回成功创建的 id。 */
  addRanges(viewer: Cesium.Viewer, options: FireRangeEffectAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定火力范围 Primitive。 */
  override update(id: string, options: FireRangeEffectUpdateOptions): boolean {
    return super.update(id, options);
  }

  /** 合并默认参数并转换为 Cesium 可直接使用的值。 */
  protected override resolveOptions(
    options: FireRangeEffectAddOptions & { id: string },
  ): FireRangeEffectResolvedOptions {
    return resolveFireRangeEffectOptions(options);
  }

  /** 根据解析参数创建填充渐变面、远端网格和外轮廓 Primitive。 */
  protected override createPrimitives(
    viewer: Cesium.Viewer,
    id: string,
    options: FireRangeEffectResolvedOptions,
  ): Cesium.Primitive[] {
    const geometry = createFireRangeGeometry(options);
    const primitives = [
      geometry.surface ? createSurfacePrimitive(`${id}-surface`, geometry.surface, geometry.modelMatrix, options) : undefined,
      createLinePrimitive(`${id}-grid`, geometry.gridLines, geometry.modelMatrix, options.show),
      createLinePrimitive(`${id}-outline`, geometry.outlineLines, geometry.modelMatrix, options.show),
    ].filter((primitive): primitive is Cesium.Primitive => !!primitive);

    primitives.forEach((primitive) => viewer.scene.primitives.add(primitive));
    return primitives;
  }
}

function createSurfacePrimitive(
  id: string,
  mesh: FireRangeSurfaceMesh,
  modelMatrix: Cesium.Matrix4,
  options: FireRangeEffectResolvedOptions,
): Cesium.Primitive {
  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      id,
      geometry: createSurfaceGeometry(mesh),
    }),
    appearance: new Cesium.MaterialAppearance({
      material: createFireRangeGradientMaterial(options),
      translucent: true,
      flat: true,
      faceForward: true,
      renderState: {
        depthMask: false,
        blending: Cesium.BlendingState.ALPHA_BLEND,
        cull: {
          enabled: false,
        },
      },
    }),
    asynchronous: false,
    modelMatrix: Cesium.Matrix4.clone(modelMatrix),
    show: options.show,
  });
}

function createSurfaceGeometry(mesh: FireRangeSurfaceMesh): Cesium.Geometry {
  const positionValues = new Float64Array(mesh.positions.length * 3);
  const normalValues = new Float32Array(mesh.positions.length * 3);
  const stValues = new Float32Array(mesh.st);

  mesh.positions.forEach((position, index) => {
    positionValues[index * 3] = position[0];
    positionValues[index * 3 + 1] = position[1];
    positionValues[index * 3 + 2] = position[2];

    const normal = normalizeLocalNormal(position);
    normalValues[index * 3] = normal.x;
    normalValues[index * 3 + 1] = normal.y;
    normalValues[index * 3 + 2] = normal.z;
  });

  const attributes = new Cesium.GeometryAttributes();
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: positionValues,
  });
  attributes.normal = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: normalValues,
  });
  attributes.st = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 2,
    values: stValues,
  });

  return new Cesium.Geometry({
    attributes,
    indices: mesh.positions.length > 65_535 ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positionValues),
  });
}

function createLinePrimitive(
  id: string,
  lines: FireRangeLineSpec[],
  modelMatrix: Cesium.Matrix4,
  show: boolean,
): Cesium.Primitive | undefined {
  const instances = lines
    .filter((line) => line.positions.length >= 2)
    .map((line, index) =>
      new Cesium.GeometryInstance({
        id: `${id}-${index}`,
        geometry: new Cesium.PolylineGeometry({
          positions: line.positions.map((point) => new Cesium.Cartesian3(point[0], point[1], point[2])),
          width: line.width,
          arcType: Cesium.ArcType.NONE,
          vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
        }),
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(line.color),
        },
      }),
    );

  if (!instances.length) return undefined;
  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PolylineColorAppearance({
      translucent: true,
    }),
    asynchronous: false,
    modelMatrix: Cesium.Matrix4.clone(modelMatrix),
    show,
  });
}

function normalizeLocalNormal(point: readonly [number, number, number]): Cesium.Cartesian3 {
  const normal = new Cesium.Cartesian3(point[0], point[1], point[2]);
  if (Cesium.Cartesian3.magnitudeSquared(normal) < 0.000001) return Cesium.Cartesian3.clone(Cesium.Cartesian3.UNIT_Z);
  return Cesium.Cartesian3.normalize(normal, normal);
}
