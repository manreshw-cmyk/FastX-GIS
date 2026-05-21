import * as Cesium from "cesium";

export const PlaneMaterialType = {
  COLOR: "color",
  IMAGE: "image",
  VIDEO: "video",
} as const;

export type PlaneMaterialTypeValue =
  (typeof PlaneMaterialType)[keyof typeof PlaneMaterialType];

/** 视频材质播放参数（作用于 HTMLVideoElement） */
export interface PlaneVideoOptions {
  /** 是否播放（创建/更新后生效；默认 true） */
  playing?: boolean;
  /** 循环播放 */
  loop?: boolean;
  /** 静音（播放时建议 true，便于通过浏览器自动播放策略） */
  muted?: boolean;
  /** 播放倍速，默认 1 */
  playbackRate?: number;
  /**
   * 播放次数：0 表示不限制（由 loop 决定是否循环）；
   * >0 时每次自然结束计 1 次，达到后暂停
   */
  playCount?: number;
  /** 浏览器原生视频控件 */
  showControls?: boolean;
  /** 预加载 */
  preload?: "auto" | "metadata" | "none";
}

/** @deprecated 仅用于读取旧数据；请使用 `playing` */
export type LegacyPlaneVideoOptions = PlaneVideoOptions & {
  autoplay?: boolean;
  startPaused?: boolean;
};

export const DEFAULT_PLANE_VIDEO: Readonly<Required<PlaneVideoOptions>> = {
  playing: true,
  loop: true,
  muted: true,
  playbackRate: 1,
  playCount: 0,
  showControls: false,
  preload: "auto",
};

export const DEFAULT_ENTITY_PLANE = new Cesium.Plane(
  Cesium.Cartesian3.UNIT_Z,
  0.0,
);
export const DEFAULT_IMAGE_REPEAT = { x: 1, y: 1 };

function finiteOr(n: unknown, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function colorFromString(css: string, alpha = 1): Cesium.Color {
  const a = Math.min(1, Math.max(0, finiteOr(alpha, 1)));
  return Cesium.Color.fromCssColorString(css).withAlpha(a);
}

/** 兼容旧字段 `autoplay` / `startPaused`，统一为 `playing` */
export function normalizePlaneVideoOptions(
  partial?: LegacyPlaneVideoOptions,
): PlaneVideoOptions {
  if (!partial || typeof partial !== "object") return {};
  const { autoplay, startPaused, playing, ...rest } = partial;
  let resolvedPlaying = playing;
  if (resolvedPlaying === undefined) {
    if (startPaused === true) resolvedPlaying = false;
    else if (autoplay === false) resolvedPlaying = false;
    else resolvedPlaying = true;
  }
  return { ...rest, playing: resolvedPlaying };
}

export function resolvePlaneVideoOptions(
  partial?: LegacyPlaneVideoOptions,
): Required<PlaneVideoOptions> {
  const p = normalizePlaneVideoOptions(partial);
  return {
    playing: p.playing !== false,
    loop: p.loop !== false,
    muted: p.muted !== false,
    playbackRate: finiteOr(p.playbackRate, DEFAULT_PLANE_VIDEO.playbackRate),
    playCount: Math.max(
      0,
      Math.floor(finiteOr(p.playCount, DEFAULT_PLANE_VIDEO.playCount)),
    ),
    showControls: p.showControls === true,
    preload:
      p.preload === "none" || p.preload === "metadata" ? p.preload : "auto",
  };
}

/**
 * 用户角 → Cesium `HeadingPitchRoll`（ENU：X 东 / Y 北 / Z 上）。
 * 水平 `PlaneGraphics` 约定：俯仰绕东轴 → Cesium `roll`；翻滚绕北轴 → Cesium `pitch`。
 */
export function planeHprFromUserDegrees(
  headingDegrees: number,
  pitchDegrees: number,
  rollDegrees: number,
): Cesium.HeadingPitchRoll {
  return new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(finiteOr(headingDegrees, 0)),
    Cesium.Math.toRadians(finiteOr(rollDegrees, 0)),
    Cesium.Math.toRadians(finiteOr(pitchDegrees, 0)),
  );
}

/** Entity 姿态四元数：`Transforms.headingPitchRollQuaternion`。 */
export function planeEntityOrientationFromUserAt(
  position: Cesium.Cartesian3,
  headingDegrees: number,
  pitchDegrees: number,
  rollDegrees: number,
): Cesium.Quaternion {
  return Cesium.Transforms.headingPitchRollQuaternion(
    position,
    planeHprFromUserDegrees(headingDegrees, pitchDegrees, rollDegrees),
  );
}
/** @deprecated 使用 {@link planeEntityOrientationFromUserAt} */
export function planeOrientationQuaternionFromUserAt(
  center: Cesium.Cartesian3,
  headingDegrees: number,
  pitchDegrees: number,
  rollDegrees: number,
  result = new Cesium.Quaternion(),
): Cesium.Quaternion {
  return Cesium.Quaternion.clone(
    planeEntityOrientationFromUserAt(
      center,
      headingDegrees,
      pitchDegrees,
      rollDegrees,
    ),
    result,
  );
}

/** @deprecated 使用 {@link planeHprFromUserDegrees} */
export function planeOrientationHprFromUserDegrees(
  headingDegrees: number,
  pitchDegrees: number,
  rollDegrees: number,
): Cesium.HeadingPitchRoll {
  return planeHprFromUserDegrees(headingDegrees, pitchDegrees, rollDegrees);
}

export function planeUserDegreesFromOrientationHpr(
  hpr: Cesium.HeadingPitchRoll,
): {
  headingDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
} {
  return {
    headingDegrees: Cesium.Math.toDegrees(hpr.heading),
    pitchDegrees: Cesium.Math.toDegrees(hpr.roll),
    rollDegrees: Cesium.Math.toDegrees(hpr.pitch),
  };
}

export type VideoEndedListener = () => void;

export function detachVideoEndedListener(
  el: HTMLVideoElement,
  listener?: VideoEndedListener,
): void {
  if (!listener) return;
  try {
    el.removeEventListener("ended", listener);
  } catch {
    /* ignore */
  }
}

export function applyPlaneVideoOptions(
  el: HTMLVideoElement,
  opts: PlaneVideoOptions | LegacyPlaneVideoOptions,
  prevListener?: VideoEndedListener,
): VideoEndedListener | undefined {
  const o = resolvePlaneVideoOptions(opts);
  detachVideoEndedListener(el, prevListener);

  el.loop = o.loop && o.playCount <= 0;
  el.muted = o.muted;
  el.controls = o.showControls;
  el.preload = o.preload;
  el.playbackRate = Math.min(16, Math.max(0.25, o.playbackRate));

  let endedCount = 0;
  let onEnded: VideoEndedListener | undefined;

  if (o.playCount > 0) {
    onEnded = () => {
      endedCount += 1;
      if (endedCount >= o.playCount) {
        el.pause();
        el.loop = false;
        return;
      }
      el.currentTime = 0;
      void el.play().catch(() => {});
    };
    el.addEventListener("ended", onEnded);
  } else if (!o.loop) {
    onEnded = () => {
      el.pause();
    };
    el.addEventListener("ended", onEnded);
  }

  if (o.playing) void el.play().catch(() => {});
  else el.pause();

  return onEnded;
}

export function createPlaneVideoElement(
  url: string,
  opts?: PlaneVideoOptions | LegacyPlaneVideoOptions,
): { element: HTMLVideoElement; endedListener?: VideoEndedListener } {
  const el = document.createElement("video");
  el.src = url;
  el.crossOrigin = "anonymous";
  el.playsInline = true;
  const endedListener = applyPlaneVideoOptions(el, opts ?? DEFAULT_PLANE_VIDEO);
  return { element: el, endedListener };
}

export function disposePlaneVideoElement(
  el?: HTMLVideoElement,
  endedListener?: VideoEndedListener,
): void {
  if (!el) return;
  detachVideoEndedListener(el, endedListener);
  try {
    el.pause();
    el.removeAttribute("src");
    el.load();
  } catch {
    /* ignore */
  }
}

export interface PlaneMaterialBuildInput {
  materialType: PlaneMaterialTypeValue;
  color?: string;
  alpha?: number;
  imageUrl?: string;
  videoUrl?: string;
  video?: PlaneVideoOptions | LegacyPlaneVideoOptions;
  imageRepeat?: { x: number; y: number };
}

export interface PlaneMaterialBuildResult {
  material: Cesium.Material;
  translucent: boolean;
  videoElement?: HTMLVideoElement;
  videoEndedListener?: VideoEndedListener;
}

export function buildPlaneModelMatrix(
  longitude: number,
  latitude: number,
  height: number,
  width: number,
  planeHeight: number,
  headingDegrees: number,
  pitchDegrees: number,
  rollDegrees: number,
  result = new Cesium.Matrix4(),
): Cesium.Matrix4 {
  const center = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);
  const hpr = planeHprFromUserDegrees(
    headingDegrees,
    pitchDegrees,
    rollDegrees,
  );
  const frame = Cesium.Transforms.headingPitchRollToFixedFrame(center, hpr);
  const scale = Cesium.Matrix4.fromScale(
    new Cesium.Cartesian3(width, planeHeight, 1.0),
    new Cesium.Matrix4(),
  );
  return Cesium.Matrix4.multiply(frame, scale, result);
}

export function buildPlaneMaterialForPrimitive(
  input: PlaneMaterialBuildInput,
  existingVideo?: HTMLVideoElement,
  existingListener?: VideoEndedListener,
): PlaneMaterialBuildResult {
  const colorCss = input.color ?? "#00bcd4";
  const alpha = finiteOr(input.alpha, 0.85);
  const repeat = input.imageRepeat ?? DEFAULT_IMAGE_REPEAT;

  switch (input.materialType) {
    case PlaneMaterialType.IMAGE: {
      const url = input.imageUrl?.trim();
      if (!url) {
        const c = colorFromString(colorCss, alpha);
        return {
          material: Cesium.Material.fromType("Color", { color: c }),
          translucent: c.alpha < 1,
        };
      }
      const tint = Cesium.Color.WHITE.withAlpha(
        Math.min(1, Math.max(0, alpha)),
      );
      const mat = Cesium.Material.fromType("Image", {
        image: url,
        repeat: new Cesium.Cartesian2(
          finiteOr(repeat.x, 1),
          finiteOr(repeat.y, 1),
        ),
        color: tint,
        transparent: alpha < 1,
      });
      return { material: mat, translucent: alpha < 1 };
    }
    case PlaneMaterialType.VIDEO: {
      const url = input.videoUrl?.trim();
      if (!url) {
        const c = colorFromString(colorCss, alpha);
        return {
          material: Cesium.Material.fromType("Color", { color: c }),
          translucent: c.alpha < 1,
        };
      }
      disposePlaneVideoElement(existingVideo, existingListener);
      const { element, endedListener } = createPlaneVideoElement(
        url,
        input.video,
      );
      const tint = Cesium.Color.WHITE.withAlpha(
        Math.min(1, Math.max(0, alpha)),
      );
      const mat = Cesium.Material.fromType("Image", {
        image: element,
        color: tint,
        transparent: alpha < 1,
      });
      return {
        material: mat,
        translucent: alpha < 1,
        videoElement: element,
        videoEndedListener: endedListener,
      };
    }
    case PlaneMaterialType.COLOR:
    default: {
      const c = colorFromString(colorCss, alpha);
      return {
        material: Cesium.Material.fromType("Color", { color: c }),
        translucent: c.alpha < 1,
      };
    }
  }
}

/** 从 add/update/style/targetData 解析材质相关字段（Entity / Collection 共用） */
export interface PlaneStyleLike {
  materialType?: PlaneMaterialTypeValue;
  color?: string | Cesium.Color;
  alpha?: number;
  imageUrl?: string;
  videoUrl?: string;
  video?: PlaneVideoOptions | LegacyPlaneVideoOptions;
  imageRepeat?: { x: number; y: number };
}

export interface PlaneMaterialSource extends PlaneStyleLike {
  materialType?: PlaneMaterialTypeValue;
  targetData?: Record<string, unknown>;
  style?: PlaneStyleLike;
}

export function resolvePlaneMaterialTypeFromSource(
  source: PlaneMaterialSource,
  fallback: PlaneMaterialTypeValue,
): PlaneMaterialTypeValue {
  const raw =
    source.materialType ??
    source.style?.materialType ??
    (typeof source.targetData?.materialType === "string"
      ? (source.targetData.materialType as PlaneMaterialTypeValue)
      : undefined);
  if (
    raw === PlaneMaterialType.COLOR ||
    raw === PlaneMaterialType.IMAGE ||
    raw === PlaneMaterialType.VIDEO
  ) {
    return raw;
  }
  return fallback;
}

function pickSubField<T>(
  direct: T | undefined,
  style: T | undefined,
  td: unknown,
): T | undefined {
  if (direct !== undefined) return direct;
  if (style !== undefined) return style;
  if (td !== undefined) return td as T;
  return undefined;
}

export function pickPlaneVideoFromSource(
  source: PlaneMaterialSource,
): PlaneVideoOptions | undefined {
  const v = pickSubField(
    source.video,
    source.style?.video,
    source.targetData?.video,
  );
  return v && typeof v === "object"
    ? normalizePlaneVideoOptions(v as LegacyPlaneVideoOptions)
    : undefined;
}

export function materialPatchTouchesPlane(
  source: PlaneMaterialSource,
  isCreate: boolean,
): boolean {
  if (isCreate) return true;
  return (
    source.materialType !== undefined ||
    source.color !== undefined ||
    source.alpha !== undefined ||
    source.imageUrl !== undefined ||
    source.videoUrl !== undefined ||
    source.imageRepeat !== undefined ||
    source.video !== undefined ||
    source.style?.materialType !== undefined ||
    source.style?.imageUrl !== undefined ||
    source.style?.videoUrl !== undefined ||
    source.style?.imageRepeat !== undefined ||
    source.style?.video !== undefined
  );
}
