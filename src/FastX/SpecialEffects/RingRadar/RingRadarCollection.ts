/**
 * 环形雷达扫描 Primitive 批量绘制类。
 *
 * 批量路径使用 Primitive 承载内外环弧面、网格和扫描叶片；几何和动画计算与单体 Entity 路径保持一致。
 */
import * as Cesium from "cesium";
import {
  createSpecialEffectId,
  isValidViewer,
  removePrimitive,
  requestSceneRender,
} from "../shared";
import {
  calcRingRadarScanAlpha,
  calcRingRadarScanAngle,
  createRingRadarAnimationState,
  createRingRadarScanStateKey,
  type RingRadarAnimationState,
} from "./animation";
import {
  createRingRadarScanBladeFaces,
  createRingRadarStaticGeometry,
  type RingRadarFaceSpec,
  type RingRadarLineSpec,
} from "./geometry";
import {
  resolveRingRadarOptions,
  type RingRadarAddOptions,
  type RingRadarResolvedOptions,
  type RingRadarUpdateOptions,
} from ".";

interface RingRadarPrimitiveRecord {
  viewer: Cesium.Viewer;
  id: string;
  sourceOptions: RingRadarAddOptions & { id: string };
  options: RingRadarResolvedOptions;
  staticPrimitives: Cesium.Primitive[];
  scanPrimitive?: Cesium.Primitive;
  scanStateKey?: string;
  animation: RingRadarAnimationState;
}

interface RingRadarPrimitiveBucket {
  ids: Set<string>;
  removeListener: () => void;
}

/** 环形雷达扫描 Primitive 批量绘制类。 */
export default class RingRadarCollection {
  private readonly records = new Map<string, RingRadarPrimitiveRecord>();
  private readonly buckets = new Map<Cesium.Viewer, RingRadarPrimitiveBucket>();

  /** 新增一个环形雷达扫描 Primitive，返回特效 id。 */
  add(viewer: Cesium.Viewer, options: RingRadarAddOptions): string | undefined {
    if (!isValidViewer(viewer)) return undefined;

    const id = options.id ?? createSpecialEffectId("ring-radar-primitive");
    if (this.records.has(id)) return undefined;

    const sourceOptions = { ...options, id };
    const resolvedOptions = resolveRingRadarOptions(sourceOptions);
    const record = this.createRecord(viewer, sourceOptions, resolvedOptions);
    this.records.set(id, record);
    this.ensureBucket(viewer).ids.add(id);
    requestSceneRender(viewer);
    return id;
  }

  /** 批量新增环形雷达扫描 Primitive，返回成功创建的 id。 */
  addMany(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    if (!isValidViewer(viewer) || !Array.isArray(options)) return [];
    return options.map((item) => this.add(viewer, item)).filter((id): id is string => !!id);
  }

  /** 批量新增环形雷达扫描 Primitive，返回成功创建的 id。 */
  addRadars(viewer: Cesium.Viewer, options: RingRadarAddOptions[]): string[] {
    return this.addMany(viewer, options);
  }

  /** 更新指定环形雷达扫描 Primitive。 */
  update(id: string, options: RingRadarUpdateOptions): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.buckets.get(record.viewer)?.ids.delete(id);

    const sourceOptions = { ...record.sourceOptions, ...options, id };
    const resolvedOptions = resolveRingRadarOptions(sourceOptions);
    const nextRecord = this.createRecord(record.viewer, sourceOptions, resolvedOptions, record.animation.startTime);
    this.records.set(id, nextRecord);
    this.ensureBucket(record.viewer).ids.add(id);
    requestSceneRender(record.viewer);
    return true;
  }

  /** 设置指定环形雷达扫描 Primitive 显隐。 */
  show(id: string, visible: boolean): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    record.options.show = visible;
    record.sourceOptions.show = visible;
    [...record.staticPrimitives, record.scanPrimitive].forEach((primitive) => {
      if (primitive) primitive.show = visible;
    });
    requestSceneRender(record.viewer);
    return true;
  }

  /** 获取指定特效对应的 Primitive 集合。 */
  get(id: string): Cesium.Primitive[] | undefined {
    const record = this.records.get(id);
    return record ? [...record.staticPrimitives, ...(record.scanPrimitive ? [record.scanPrimitive] : [])] : undefined;
  }

  /** 获取当前管理的全部 id；传入 viewer 时只返回该 Viewer 下的 id。 */
  getAllIds(viewer?: Cesium.Viewer): string[] {
    return [...this.records.values()]
      .filter((record) => !viewer || record.viewer === viewer)
      .map((record) => record.id);
  }

  /** 删除指定环形雷达扫描 Primitive。 */
  remove(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    this.removeRecordPrimitives(record);
    this.records.delete(id);
    this.buckets.get(record.viewer)?.ids.delete(id);
    this.cleanupBucket(record.viewer);
    return true;
  }

  /** 清空全部环形雷达扫描 Primitive；传入 viewer 时只清空该 Viewer 下的特效。 */
  clear(viewer?: Cesium.Viewer): void {
    this.getAllIds(viewer).forEach((id) => this.remove(id));
  }

  /** 销毁当前管理器中的全部环形雷达扫描 Primitive。 */
  destroy(): void {
    this.clear();
  }

  private createRecord(
    viewer: Cesium.Viewer,
    sourceOptions: RingRadarAddOptions & { id: string },
    options: RingRadarResolvedOptions,
    startTime?: number,
  ): RingRadarPrimitiveRecord {
    const staticGeometry = createRingRadarStaticGeometry(options);
    const staticPrimitives = [
      createFacePrimitive(`${options.id}-surface`, staticGeometry.faces, options.show),
      createLinePrimitive(`${options.id}-grid`, staticGeometry.lines, options.show),
    ].filter((primitive): primitive is Cesium.Primitive => !!primitive);
    staticPrimitives.forEach((primitive) => viewer.scene.primitives.add(primitive));

    const animation = createRingRadarAnimationState(startTime);
    const scanBundle = this.createScanPrimitive(options, animation);
    if (scanBundle.primitive) viewer.scene.primitives.add(scanBundle.primitive);

    return {
      viewer,
      id: options.id,
      sourceOptions,
      options,
      staticPrimitives,
      scanPrimitive: scanBundle.primitive,
      scanStateKey: scanBundle.stateKey,
      animation,
    };
  }

  private removeRecordPrimitives(record: RingRadarPrimitiveRecord): void {
    [...record.staticPrimitives, record.scanPrimitive].forEach((primitive) => {
      if (primitive) removePrimitive(record.viewer, primitive);
    });
    record.staticPrimitives = [];
    record.scanPrimitive = undefined;
    record.scanStateKey = undefined;
  }

  private ensureBucket(viewer: Cesium.Viewer): RingRadarPrimitiveBucket {
    let bucket = this.buckets.get(viewer);
    if (!bucket) {
      const listener = () => this.updateAnimation(viewer);
      viewer.scene.preRender.addEventListener(listener);
      bucket = {
        ids: new Set(),
        removeListener: () => {
          if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(listener);
        },
      };
      this.buckets.set(viewer, bucket);
    }
    return bucket;
  }

  private updateAnimation(viewer: Cesium.Viewer): void {
    let hasVisibleScan = false;
    this.buckets.get(viewer)?.ids.forEach((id) => {
      const record = this.records.get(id);
      if (!record) return;

      const nextStateKey = createRingRadarScanStateKey(record.options, record.animation);
      if (nextStateKey !== record.scanStateKey) {
        removePrimitive(record.viewer, record.scanPrimitive);
        const scanBundle = this.createScanPrimitive(record.options, record.animation);
        record.scanPrimitive = scanBundle.primitive;
        record.scanStateKey = scanBundle.stateKey;
        if (scanBundle.primitive) viewer.scene.primitives.add(scanBundle.primitive);
      }

      if (record.scanPrimitive) record.scanPrimitive.show = record.options.show;
      hasVisibleScan = hasVisibleScan || record.options.show;
    });

    if (hasVisibleScan) requestSceneRender(viewer);
  }

  private cleanupBucket(viewer: Cesium.Viewer): void {
    const bucket = this.buckets.get(viewer);
    if (!bucket || bucket.ids.size > 0) return;
    bucket.removeListener();
    this.buckets.delete(viewer);
  }

  private createScanPrimitive(
    options: RingRadarResolvedOptions,
    animation: RingRadarAnimationState,
  ): { primitive?: Cesium.Primitive; stateKey: string } {
    const color = Cesium.Color.clone(options.scanBladeColor);
    color.alpha = calcRingRadarScanAlpha(options.scanBladeAlpha, options.scanBlink, animation);
    const angle = calcRingRadarScanAngle(options, animation);
    const faces = createRingRadarScanBladeFaces(options, angle, color);
    const stateKey = createRingRadarScanStateKey(options, animation);
    return { primitive: createFacePrimitive(`${options.id}-scan-blade`, faces, options.show), stateKey };
  }
}

function createFacePrimitive(
  id: string,
  faces: RingRadarFaceSpec[],
  show: boolean,
): Cesium.Primitive | undefined {
  const instances = faces
    .filter((face) => face.positions.length >= 3)
    .map(
      (face, index) =>
        new Cesium.GeometryInstance({
          id: `${id}-${index}`,
          geometry: createFaceGeometry(face.positions),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(face.color),
          },
        }),
    );
  if (!instances.length) return undefined;

  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: false,
      flat: true,
    }),
    asynchronous: false,
    show,
  });
}

function createLinePrimitive(
  id: string,
  lines: RingRadarLineSpec[],
  show: boolean,
): Cesium.Primitive | undefined {
  const instances = lines
    .filter((line) => line.positions.length >= 2)
    .map(
      (line, index) =>
        new Cesium.GeometryInstance({
          id: `${id}-${index}`,
          geometry: new Cesium.PolylineGeometry({
            positions: line.positions,
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
    show,
  });
}

function createFaceGeometry(positions: Cesium.Cartesian3[]): Cesium.Geometry {
  const values = new Float64Array(positions.length * 3);
  positions.forEach((position, index) => {
    values[index * 3] = position.x;
    values[index * 3 + 1] = position.y;
    values[index * 3 + 2] = position.z;
  });

  const indices: number[] = [];
  for (let index = 1; index < positions.length - 1; index += 1) {
    indices.push(0, index, index + 1);
  }

  const attributes = new Cesium.GeometryAttributes();
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values,
  });

  return new Cesium.Geometry({
    attributes,
    indices: positions.length > 65535 ? new Uint32Array(indices) : new Uint16Array(indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromPoints(positions),
  });
}
