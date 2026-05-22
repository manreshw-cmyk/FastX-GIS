import * as Cesium from "cesium";
import type { Color, Entity, Property, Viewer } from "cesium";
import { createRandomXgxId } from "../../Coordinates";
import type { PointPositionInput, PointPositionsTuple } from "../Point";

export type ModelPositionsTuple = PointPositionsTuple;

export interface ModelStyleOptions {
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  heightReference?: Cesium.HeightReference;
  silhouetteColor?: Color;
  silhouetteSize?: number;
  distanceDisplayCondition?: Cesium.DistanceDisplayCondition;
  shadows?: Cesium.ShadowMode;
}

/**
 * 添加 glTF 模型（`Entity` + `ModelGraphics`）。
 * - 位置：`position` 或 `positions` 二选一。
 * - `uri`：`.glb` / `.gltf` 或 blob / data URL。
 */
export interface AddModelOptions {
  id?: string;
  position?: PointPositionInput;
  positions?: ModelPositionsTuple;
  uri: string;
  style?: ModelStyleOptions;
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  heightReference?: keyof typeof Cesium.HeightReference;
  /**
   * 航向角（度），与 Cesium `HeadingPitchRoll` / `Transforms.headingPitchRollQuaternion` 一致：
   * 0° 朝北，**顺时针**增大（俯视地图）；例如 **+90° 朝东**。
   */
  headingDegrees?: number;
  /**
   * 俯仰角（度）：**正为抬头**（机头向上），**负为俯冲**（机头向下）。
   */
  pitchDegrees?: number;
  /**
   * 横滚角（度）：**正为右倾**（右翼向下），**负为左倾**（左翼向下）。
   */
  rollDegrees?: number;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
}

export interface UpdateModelProperties {
  longitude?: number;
  latitude?: number;
  height?: number;
  position?: PointPositionInput;
  positions?: ModelPositionsTuple;
  uri?: string;
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  heightReference?: keyof typeof Cesium.HeightReference;
  headingDegrees?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
  show?: boolean;
  description?: string;
  targetData?: Record<string, unknown>;
  style?: ModelStyleOptions;
}

export interface ModelSnapshot {
  id: string;
  longitude: number;
  latitude: number;
  height: number;
  uri?: string;
  scale?: number;
  minimumPixelSize?: number;
  maximumScale?: number;
  runAnimations?: boolean;
  /** 航向角（度），见 `AddModelOptions.headingDegrees` */
  headingDegrees?: number;
  /** 俯仰角（度），正抬头、负俯冲，见 `AddModelOptions.pitchDegrees` */
  pitchDegrees?: number;
  /** 横滚角（度），正右倾、负左倾，见 `AddModelOptions.rollDegrees` */
  rollDegrees?: number;
  show: boolean;
  targetData: Record<string, unknown>;
  description?: string;
}

interface ModelOrientationDeg {
  heading: number;
  pitch: number;
  roll: number;
}

interface ModelRecord {
  viewer: Viewer;
  entity: Entity;
  targetData: Record<string, unknown>;
  orientationDeg: ModelOrientationDeg;
}

function toCartesian3(
  position: PointPositionInput,
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

function positionFromTuple(
  positions: ModelPositionsTuple,
  result = new Cesium.Cartesian3(),
): Cesium.Cartesian3 {
  const h = positions[2] ?? 0;
  return Cesium.Cartesian3.fromDegrees(
    Number(positions[0]),
    Number(positions[1]),
    Number(h),
    undefined,
    result,
  );
}

function resolveAddCartesian(
  options: AddModelOptions,
): Cesium.Cartesian3 | undefined {
  if (options.position !== undefined && options.positions !== undefined)
    return undefined;
  if (options.position !== undefined) return toCartesian3(options.position);
  if (options.positions !== undefined && options.positions.length >= 2) {
    return positionFromTuple(options.positions);
  }
  return undefined;
}

function parseHeightRef(
  s: keyof typeof Cesium.HeightReference | undefined,
): Cesium.HeightReference {
  if (!s) return Cesium.HeightReference.NONE;
  return Cesium.HeightReference[s] ?? Cesium.HeightReference.NONE;
}

function mergeModelGraphics(
  mg: Cesium.ModelGraphics,
  options: AddModelOptions | UpdateModelProperties,
  isCreate: boolean,
): void {
  const st = options.style;
  const uri =
    (options as AddModelOptions).uri ?? (options as UpdateModelProperties).uri;
  if (uri !== undefined) mg.uri = new Cesium.ConstantProperty(uri);

  const scale =
    st?.scale ??
    (options as AddModelOptions).scale ??
    (options as UpdateModelProperties).scale;
  if (scale !== undefined) mg.scale = new Cesium.ConstantProperty(scale);
  else if (isCreate) mg.scale = new Cesium.ConstantProperty(1);

  const mps =
    st?.minimumPixelSize ??
    (options as AddModelOptions).minimumPixelSize ??
    (options as UpdateModelProperties).minimumPixelSize;
  if (mps !== undefined) mg.minimumPixelSize = new Cesium.ConstantProperty(mps);

  const mx =
    st?.maximumScale ??
    (options as AddModelOptions).maximumScale ??
    (options as UpdateModelProperties).maximumScale;
  if (mx !== undefined) mg.maximumScale = new Cesium.ConstantProperty(mx);

  const ra =
    st?.runAnimations ??
    (options as AddModelOptions).runAnimations ??
    (options as UpdateModelProperties).runAnimations;
  if (ra !== undefined) mg.runAnimations = new Cesium.ConstantProperty(ra);
  else if (isCreate) mg.runAnimations = new Cesium.ConstantProperty(true);

  const hrKey =
    (options as AddModelOptions).heightReference ??
    (options as UpdateModelProperties).heightReference;
  const hr =
    st?.heightReference ??
    (hrKey !== undefined ? parseHeightRef(hrKey) : undefined);
  if (hr !== undefined) mg.heightReference = new Cesium.ConstantProperty(hr);
  else if (isCreate)
    mg.heightReference = new Cesium.ConstantProperty(
      Cesium.HeightReference.NONE,
    );

  if (st?.silhouetteColor !== undefined) {
    mg.silhouetteColor = new Cesium.ConstantProperty(st.silhouetteColor);
  }
  if (st?.silhouetteSize !== undefined) {
    mg.silhouetteSize = new Cesium.ConstantProperty(st.silhouetteSize);
  }
  if (st?.distanceDisplayCondition !== undefined) {
    mg.distanceDisplayCondition = new Cesium.ConstantProperty(
      st.distanceDisplayCondition,
    );
  }
  if (st?.shadows !== undefined)
    mg.shadows = new Cesium.ConstantProperty(st.shadows);
}

function sampleProperty<T>(
  p: Property | undefined,
  time = Cesium.JulianDate.now(),
): T | undefined {
  if (!p || typeof (p as Cesium.Property).getValue !== "function")
    return undefined;
  return (p as Cesium.Property).getValue(time) as T | undefined;
}

const scratchCart = new Cesium.Cartesian3();

function defaultOrientationDeg(): {
  heading: number;
  pitch: number;
  roll: number;
} {
  return { heading: 0, pitch: 0, roll: 0 };
}

function readOrientationDegFromOptions(
  options: AddModelOptions | UpdateModelProperties,
  fallback: { heading: number; pitch: number; roll: number },
): { heading: number; pitch: number; roll: number } {
  const o = options as AddModelOptions & UpdateModelProperties;
  return {
    heading:
      o.headingDegrees !== undefined
        ? Number(o.headingDegrees)
        : fallback.heading,
    pitch:
      o.pitchDegrees !== undefined ? Number(o.pitchDegrees) : fallback.pitch,
    roll: o.rollDegrees !== undefined ? Number(o.rollDegrees) : fallback.roll,
  };
}

function syncOrientationToTargetData(rec: ModelRecord): void {
  const d = rec.orientationDeg;
  rec.targetData = {
    ...rec.targetData,
    headingDegrees: d.heading,
    pitchDegrees: d.pitch,
    rollDegrees: d.roll,
  };
}

function attachModelOrientationCallback(rec: ModelRecord): void {
  rec.entity.orientation = new Cesium.CallbackProperty((time) => {
    const pos = rec.entity.position?.getValue(time, scratchCart);
    if (!pos) return undefined;
    const d = rec.orientationDeg;
    // 直接传入角度，不做取反：正值 pitch = 抬头（逆时针），正值 roll = 右倾（顺时针）
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(d.heading),
      Cesium.Math.toRadians(d.pitch),
      Cesium.Math.toRadians(d.roll),
    );
    return Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
  }, false);
}

/**
 * 基础绘制 — 模型（`Entity` + `ModelGraphics`）。
 */
export default class Model {
  private readonly data = new Map<string, ModelRecord>();

  private isRecordAlive(rec: ModelRecord): boolean {
    if (rec.viewer.isDestroyed()) return false;
    return rec.viewer.entities.contains(rec.entity);
  }

  private takeIfAlive(id: string): ModelRecord | undefined {
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

  add(viewer: Viewer, options: AddModelOptions): Entity | undefined {
    if (!viewer || viewer.isDestroyed()) return undefined;
    const id = options.id?.trim() ? options.id : createRandomXgxId("mdl");
    if (this.data.has(id) || viewer.entities.getById(id)) return undefined;
    if (!options.uri?.trim()) return undefined;

    const position = resolveAddCartesian(options);
    if (!position) return undefined;

    const mg = new Cesium.ModelGraphics();
    mergeModelGraphics(mg, options, true);

    const td = this.cloneTargetData(options.targetData);
    td.modelUri = options.uri.trim();

    const orientationDeg = readOrientationDegFromOptions(
      options,
      defaultOrientationDeg(),
    );

    const entity = new Cesium.Entity({
      id,
      position: new Cesium.ConstantPositionProperty(position),
      model: mg,
      show: options.show !== false,
    });
    if (options.description !== undefined) {
      entity.description = new Cesium.ConstantProperty(options.description);
    }

    const rec: ModelRecord = { viewer, entity, targetData: td, orientationDeg };
    syncOrientationToTargetData(rec);
    attachModelOrientationCallback(rec);

    viewer.entities.add(entity);
    this.data.set(id, rec);
    return entity;
  }

  addBatch(
    viewer: Viewer,
    items: AddModelOptions[],
  ): { succeeded: Entity[]; failedIds: string[] } {
    if (!viewer || viewer.isDestroyed())
      return { succeeded: [], failedIds: [] };
    const succeeded: Entity[] = [];
    const failedIds: string[] = [];
    for (const item of items) {
      const resolvedId = item.id?.trim() ? item.id : createRandomXgxId("mdl");
      const e = this.add(viewer, { ...item, id: resolvedId });
      if (e) succeeded.push(e);
      else failedIds.push(resolvedId);
    }
    return { succeeded, failedIds };
  }

  addModels(viewer: Viewer, items: AddModelOptions[]): string[] {
    if (
      !viewer ||
      viewer.isDestroyed() ||
      !Array.isArray(items) ||
      items.length === 0
    )
      return [];
    const ids: string[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i]!;
        const id = item.id?.trim() ? item.id : createRandomXgxId("mdl");
        const ent = this.add(viewer, { ...item, id });
        if (ent) ids.push(id);
      } catch (e) {
        console.error(`[FastX.Draw.Model] addModels 第 ${i} 项失败:`, e);
      }
    }
    return ids;
  }

  updateModel(id: string, properties: UpdateModelProperties): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;

    const p = properties;
    if (p.position !== undefined) {
      rec.entity.position = new Cesium.ConstantPositionProperty(
        toCartesian3(p.position),
      );
    } else if (p.positions !== undefined) {
      if (p.positions.length < 2) return false;
      rec.entity.position = new Cesium.ConstantPositionProperty(
        positionFromTuple(p.positions),
      );
    } else if (p.longitude !== undefined && p.latitude !== undefined) {
      const h = p.height !== undefined ? p.height : 0;
      rec.entity.position = new Cesium.ConstantPositionProperty(
        Cesium.Cartesian3.fromDegrees(
          Number(p.longitude),
          Number(p.latitude),
          Number(h),
        ),
      );
    }

    if (
      p.headingDegrees !== undefined ||
      p.pitchDegrees !== undefined ||
      p.rollDegrees !== undefined
    ) {
      rec.orientationDeg = readOrientationDegFromOptions(p, rec.orientationDeg);
    }

    const mg =
      rec.entity.model ?? (rec.entity.model = new Cesium.ModelGraphics());
    mergeModelGraphics(mg, p, false);

    if (p.uri !== undefined) {
      rec.targetData = { ...rec.targetData, modelUri: p.uri };
    }

    if (p.show !== undefined) rec.entity.show = p.show;
    if (p.description !== undefined)
      rec.entity.description = new Cesium.ConstantProperty(p.description);
    if (p.targetData !== undefined) {
      rec.targetData = { ...rec.targetData, ...p.targetData };
    }
    syncOrientationToTargetData(rec);
    return true;
  }

  updateModels(
    updates: Array<{ id: string } & UpdateModelProperties>,
  ): Array<{ id: string; success: boolean }> {
    return updates.map((u) => {
      const { id, ...rest } = u;
      return { id, success: this.updateModel(id, rest) };
    });
  }

  getTargetData(id: string): Record<string, unknown> | undefined {
    const rec = this.takeIfAlive(id);
    if (!rec) return undefined;
    return { ...rec.targetData };
  }

  setTargetData(id: string, targetData: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...targetData };
    return true;
  }

  mergeTargetData(id: string, patch: Record<string, unknown>): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.targetData = { ...rec.targetData, ...patch };
    return true;
  }

  getModel(id: string): ModelSnapshot | null {
    const rec = this.takeIfAlive(id);
    if (!rec) return null;
    const pos = sampleProperty<Cesium.Cartesian3>(rec.entity.position);
    if (!pos) return null;
    const carto = Cesium.Cartographic.fromCartesian(pos);
    const mg = rec.entity.model;
    const uri = mg ? sampleProperty<string>(mg.uri) : undefined;
    const stored =
      typeof rec.targetData.modelUri === "string"
        ? rec.targetData.modelUri
        : undefined;
    const scale = mg ? sampleProperty<number>(mg.scale) : undefined;
    const minimumPixelSize = mg
      ? sampleProperty<number>(mg.minimumPixelSize)
      : undefined;
    const maximumScale = mg
      ? sampleProperty<number>(mg.maximumScale)
      : undefined;
    const runAnimations = mg
      ? sampleProperty<boolean>(mg.runAnimations)
      : undefined;
    const desc = sampleProperty<string>(rec.entity.description);

    const headingDegrees = rec.orientationDeg.heading;
    const pitchDegrees = rec.orientationDeg.pitch;
    const rollDegrees = rec.orientationDeg.roll;

    return {
      id: rec.entity.id,
      longitude: Cesium.Math.toDegrees(carto.longitude),
      latitude: Cesium.Math.toDegrees(carto.latitude),
      height: carto.height,
      uri: uri ?? stored,
      scale,
      minimumPixelSize,
      maximumScale,
      runAnimations,
      headingDegrees,
      pitchDegrees,
      rollDegrees,
      show: rec.entity.show,
      targetData: { ...rec.targetData },
      description: desc,
    };
  }

  getAllModels(viewer?: Viewer): ModelSnapshot[] {
    const out: ModelSnapshot[] = [];
    for (const mid of this.getIds(viewer)) {
      const s = this.getModel(mid);
      if (s) out.push(s);
    }
    return out;
  }

  getCount(viewer?: Viewer): number {
    return this.getIds(viewer).length;
  }

  getAllIds(viewer?: Viewer): string[] {
    return this.getIds(viewer);
  }

  setAllVisibility(show: boolean, viewer?: Viewer): void {
    for (const [, r] of this.data) {
      if (!this.isRecordAlive(r)) continue;
      if (viewer !== undefined && r.viewer !== viewer) continue;
      r.entity.show = show;
    }
  }

  setSpecifyVisibility(id: string, show: boolean): boolean {
    return this.setVisible(id, show);
  }

  removeAll(viewer?: Viewer): void {
    this.clear(viewer);
  }

  getEntity(id: string): Entity | undefined {
    return this.takeIfAlive(id)?.entity;
  }

  has(id: string): boolean {
    return this.takeIfAlive(id) !== undefined;
  }

  getIds(viewer?: Viewer): string[] {
    const out: string[] = [];
    for (const [id, rec] of this.data) {
      if (!this.isRecordAlive(rec)) continue;
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      out.push(id);
    }
    return out;
  }

  setVisible(id: string, visible: boolean): boolean {
    const rec = this.takeIfAlive(id);
    if (!rec) return false;
    rec.entity.show = visible;
    return true;
  }

  remove(id: string): boolean {
    const rec = this.data.get(id);
    if (!rec) return false;
    this.data.delete(id);
    if (!rec.viewer.isDestroyed() && rec.viewer.entities.contains(rec.entity)) {
      rec.viewer.entities.remove(rec.entity);
    }
    return true;
  }

  removeBatch(ids: string[]): number {
    let n = 0;
    for (const id of ids) {
      if (this.remove(id)) n += 1;
    }
    return n;
  }

  clear(viewer?: Viewer): void {
    const toRemove: string[] = [];
    for (const [id, rec] of this.data) {
      if (viewer !== undefined && rec.viewer !== viewer) continue;
      toRemove.push(id);
    }
    for (const id of toRemove) this.remove(id);
  }

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

  destroy(): void {
    this.clear();
  }
}
