/**
 * SpecialEffects 特效集合。
 * 统一导出空间特效、天气特效、雷达扫描、视锥体和火力范围等能力。
 */
import RadiationCircle from "./RadiationCircle";
import RadiationCircleCollection from "./RadiationCircle/RadiationCircleCollection";
import CircleDiffusion from "./CircleDiffusion";
import CircleDiffusionCollection from "./CircleDiffusion/CircleDiffusionCollection";
import ElectronicFence from "./ElectronicFence";
import ElectronicFenceCollection from "./ElectronicFence/ElectronicFenceCollection";
import PolygonDiffusionWall from "./PolygonDiffusionWall";
import PolygonDiffusionWallCollection from "./PolygonDiffusionWall/PolygonDiffusionWallCollection";
import RadarEmissionWave from "./RadarEmissionWave";
import RadarEmissionWaveCollection from "./RadarEmissionWave/RadarEmissionWaveCollection";
import HemisphereRadarScan from "./HemisphereRadarScan";
import HemisphereRadarScanCollection from "./HemisphereRadarScan/HemisphereRadarScanCollection";
import GlobalRain from "./GlobalRain";
import GlobalSnow from "./GlobalSnow";
import GlobalFog from "./GlobalFog";
import SingleViewFrustum from "./SingleViewFrustum";
import SingleViewFrustumCollection from "./SingleViewFrustum/SingleViewFrustumCollection";
import AirRadar from "./AirRadar";
import AirRadarCollection from "./AirRadar/AirRadarCollection";
import SectorArcRadarScan from "./SectorArcRadarScan";
import SectorArcRadarScanCollection from "./SectorArcRadarScan/SectorArcRadarScanCollection";
import SectorDiffusionRadar from "./SectorDiffusionRadar";
import SectorDiffusionRadarCollection from "./SectorDiffusionRadar/SectorDiffusionRadarCollection";
import CircleDiffusionRadar from "./CircleDiffusionRadar";
import CircleDiffusionRadarCollection from "./CircleDiffusionRadar/CircleDiffusionRadarCollection";
import AimEffect from "./AimEffect";
import AimEffectCollection from "./AimEffect/AimEffectCollection";
import ConeEffect from "./ConeEffect";
import ConeEffectCollection from "./ConeEffect/ConeEffectCollection";
import ConicalScanner from "./ConicalScanner";
import ConicalScannerCollection from "./ConicalScanner/ConicalScannerCollection";
import DoubleViewFrustum from "./DoubleViewFrustum";
import DoubleViewFrustumCollection from "./DoubleViewFrustum/DoubleViewFrustumCollection";
import ParabolaRadar from "./ParabolaRadar";
import ParabolaRadarCollection from "./ParabolaRadar/ParabolaRadarCollection";
import RingConeScanner from "./RingConeScanner";
import RingConeScannerCollection from "./RingConeScanner/RingConeScannerCollection";
import RingRadar from "./RingRadar";
import RingRadarCollection from "./RingRadar/RingRadarCollection";
import ScanRadar from "./ScanRadar";
import ScanRadarCollection from "./ScanRadar/ScanRadarCollection";
import SquareConeScanner from "./SquareConeScanner";
import SquareConeScannerCollection from "./SquareConeScanner/SquareConeScannerCollection";
import FireRangeEffect from "./FireRangeEffect";
import FireRangeEffectCollection from "./FireRangeEffect/FireRangeEffectCollection";
import ParticleSystemEffect from "./ParticleSystemEffect";
import ExplosionEffect from "./ExplosionEffect";
import FrameAnimationEffect from "./FrameAnimationEffect";

export { default as RadiationCircle } from "./RadiationCircle";
export { default as RadiationCircleCollection } from "./RadiationCircle/RadiationCircleCollection";
export type { RadiationCircleAddOptions, RadiationCircleUpdateOptions } from "./RadiationCircle";

export { default as CircleDiffusion } from "./CircleDiffusion";
export { default as CircleDiffusionCollection } from "./CircleDiffusion/CircleDiffusionCollection";
export type { CircleDiffusionAddOptions, CircleDiffusionUpdateOptions } from "./CircleDiffusion";

export { default as ElectronicFence } from "./ElectronicFence";
export { default as ElectronicFenceCollection } from "./ElectronicFence/ElectronicFenceCollection";
export type {
  ElectronicFenceAddOptions,
  ElectronicFenceFlowDirection,
  ElectronicFenceUpdateOptions,
} from "./ElectronicFence";

export { default as PolygonDiffusionWall } from "./PolygonDiffusionWall";
export { default as PolygonDiffusionWallCollection } from "./PolygonDiffusionWall/PolygonDiffusionWallCollection";
export type { PolygonDiffusionWallAddOptions, PolygonDiffusionWallUpdateOptions } from "./PolygonDiffusionWall";

export { default as RadarEmissionWave } from "./RadarEmissionWave";
export { default as RadarEmissionWaveCollection } from "./RadarEmissionWave/RadarEmissionWaveCollection";
export type { RadarEmissionWaveAddOptions, RadarEmissionWaveUpdateOptions } from "./RadarEmissionWave";

export { default as HemisphereRadarScan } from "./HemisphereRadarScan";
export { default as HemisphereRadarScanCollection } from "./HemisphereRadarScan/HemisphereRadarScanCollection";
export type { HemisphereRadarScanAddOptions, HemisphereRadarScanUpdateOptions } from "./HemisphereRadarScan";

export { default as GlobalRain } from "./GlobalRain";
export type { GlobalRainOptions } from "./GlobalRain";

export { default as GlobalSnow } from "./GlobalSnow";
export type { GlobalSnowOptions } from "./GlobalSnow";

export { default as GlobalFog } from "./GlobalFog";
export type { GlobalFogOptions } from "./GlobalFog";

export { default as SingleViewFrustum } from "./SingleViewFrustum";
export { default as SingleViewFrustumCollection } from "./SingleViewFrustum/SingleViewFrustumCollection";
export type { SingleViewFrustumAddOptions, SingleViewFrustumUpdateOptions } from "./SingleViewFrustum";

export { default as AirRadar } from "./AirRadar";
export { default as AirRadarCollection } from "./AirRadar/AirRadarCollection";
export type { AirRadarAddOptions, AirRadarUpdateOptions } from "./AirRadar";

export { default as SectorArcRadarScan } from "./SectorArcRadarScan";
export { default as SectorArcRadarScanCollection } from "./SectorArcRadarScan/SectorArcRadarScanCollection";
export type { SectorArcRadarScanAddOptions, SectorArcRadarScanUpdateOptions } from "./SectorArcRadarScan";

export { default as SectorDiffusionRadar } from "./SectorDiffusionRadar";
export { default as SectorDiffusionRadarCollection } from "./SectorDiffusionRadar/SectorDiffusionRadarCollection";
export type { SectorDiffusionRadarAddOptions, SectorDiffusionRadarUpdateOptions } from "./SectorDiffusionRadar";

export { default as CircleDiffusionRadar } from "./CircleDiffusionRadar";
export { default as CircleDiffusionRadarCollection } from "./CircleDiffusionRadar/CircleDiffusionRadarCollection";
export type { CircleDiffusionRadarAddOptions, CircleDiffusionRadarUpdateOptions } from "./CircleDiffusionRadar";

export { default as AimEffect } from "./AimEffect";
export { default as AimEffectCollection } from "./AimEffect/AimEffectCollection";
export type { AimEffectAddOptions, AimEffectUpdateOptions } from "./AimEffect";

export { default as ConeEffect } from "./ConeEffect";
export { default as ConeEffectCollection } from "./ConeEffect/ConeEffectCollection";
export type { ConeEffectAddOptions, ConeEffectUpdateOptions } from "./ConeEffect";

export { default as ConicalScanner } from "./ConicalScanner";
export { default as ConicalScannerCollection } from "./ConicalScanner/ConicalScannerCollection";
export type { ConicalScannerAddOptions, ConicalScannerUpdateOptions } from "./ConicalScanner";

export { default as DoubleViewFrustum } from "./DoubleViewFrustum";
export { default as DoubleViewFrustumCollection } from "./DoubleViewFrustum/DoubleViewFrustumCollection";
export type { DoubleViewFrustumAddOptions, DoubleViewFrustumUpdateOptions } from "./DoubleViewFrustum";

export { default as ParabolaRadar } from "./ParabolaRadar";
export { default as ParabolaRadarCollection } from "./ParabolaRadar/ParabolaRadarCollection";
export type { ParabolaRadarAddOptions, ParabolaRadarUpdateOptions } from "./ParabolaRadar";

export { default as RingConeScanner } from "./RingConeScanner";
export { default as RingConeScannerCollection } from "./RingConeScanner/RingConeScannerCollection";
export type { RingConeScannerAddOptions, RingConeScannerUpdateOptions } from "./RingConeScanner";

export { default as RingRadar } from "./RingRadar";
export { default as RingRadarCollection } from "./RingRadar/RingRadarCollection";
export type { RingRadarAddOptions, RingRadarUpdateOptions } from "./RingRadar";

export { default as ScanRadar } from "./ScanRadar";
export { default as ScanRadarCollection } from "./ScanRadar/ScanRadarCollection";
export type { ScanRadarAddOptions, ScanRadarUpdateOptions } from "./ScanRadar";

export { default as SquareConeScanner } from "./SquareConeScanner";
export { default as SquareConeScannerCollection } from "./SquareConeScanner/SquareConeScannerCollection";
export type { SquareConeScannerAddOptions, SquareConeScannerUpdateOptions } from "./SquareConeScanner";

export { default as FireRangeEffect } from "./FireRangeEffect";
export { default as FireRangeEffectCollection } from "./FireRangeEffect/FireRangeEffectCollection";
export type { FireRangeEffectAddOptions, FireRangeEffectUpdateOptions } from "./FireRangeEffect";

export { default as ParticleSystemEffect } from "./ParticleSystemEffect";
export type {
  ParticleBurstOptions,
  ParticleDistanceInput,
  ParticleEmitterOptions,
  ParticleEmitterType,
  ParticleNearFarInput,
  ParticleSystemEffectAddOptions,
  ParticleSystemEffectUpdateOptions,
} from "./ParticleSystemEffect";

export { default as ExplosionEffect, DEFAULT_EXPLOSION_PARTICLE_IMAGE } from "./ExplosionEffect";
export type { ExplosionEffectAddOptions, ExplosionEffectUpdateOptions } from "./ExplosionEffect";

export { default as FrameAnimationEffect, DEFAULT_FRAME_ANIMATION_PATH } from "./FrameAnimationEffect";
export type { FrameAnimationEffectAddOptions, FrameAnimationEffectUpdateOptions } from "./FrameAnimationEffect";

export type {
  SpecialEffectsColorInput,
  SpecialEffectsLngLatHeight,
  SpecialEffectsLngLatHeightTuple,
  SpecialEffectsPositionInput,
} from "./shared";

/** FastX 特效集合，空间特效同时提供 Entity 单体类和 Primitive 批量类。 */
export const SpecialEffects = {
  RadiationCircle,
  RadiationCircleCollection,
  CircleDiffusion,
  CircleDiffusionCollection,
  ElectronicFence,
  ElectronicFenceCollection,
  PolygonDiffusionWall,
  PolygonDiffusionWallCollection,
  RadarEmissionWave,
  RadarEmissionWaveCollection,
  HemisphereRadarScan,
  HemisphereRadarScanCollection,
  GlobalRain,
  GlobalSnow,
  GlobalFog,
  SingleViewFrustum,
  SingleViewFrustumCollection,
  AirRadar,
  AirRadarCollection,
  SectorArcRadarScan,
  SectorArcRadarScanCollection,
  SectorDiffusionRadar,
  SectorDiffusionRadarCollection,
  CircleDiffusionRadar,
  CircleDiffusionRadarCollection,
  AimEffect,
  AimEffectCollection,
  ConeEffect,
  ConeEffectCollection,
  ConicalScanner,
  ConicalScannerCollection,
  DoubleViewFrustum,
  DoubleViewFrustumCollection,
  ParabolaRadar,
  ParabolaRadarCollection,
  RingConeScanner,
  RingConeScannerCollection,
  RingRadar,
  RingRadarCollection,
  ScanRadar,
  ScanRadarCollection,
  SquareConeScanner,
  SquareConeScannerCollection,
  FireRangeEffect,
  FireRangeEffectCollection,
  ParticleSystemEffect,
  ExplosionEffect,
  FrameAnimationEffect,
} as const;

export default SpecialEffects;
