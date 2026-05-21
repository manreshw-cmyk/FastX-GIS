/**
 * 开发时可在控制台执行（需已有 `viewer`）：
 * `const { runBatchCollectionsSmoke } = await import('./CesiumX/Draw/runBatchCollectionsSmoke'); await runBatchCollectionsSmoke(viewer)`
 * 用于快速走通 Billboard / Model / Box / PolylineVolume / Plane 等 Collection 的增删改查与显隐 API。
 */
import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'
import BillboardCollection from './Billboard/BillboardCollection'
import ModelCollection from './Model/ModelCollection'
import BoxCollection from './Box/BoxCollection'
import PolylineVolumeCollection from './PolylineVolume/PolylineVolumeCollection'
import { ShapeType } from './PolylineVolume/shape'
import PlaneCollection from './Plane/PlaneCollection'
import { buildPlaneModelMatrix } from './Plane/planeShared'

const svgPin = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="20" fill="#faad14" stroke="#222" stroke-width="3"/></svg>`

export async function runBatchCollectionsSmoke(viewer: Viewer): Promise<void> {
  if (!viewer || viewer.isDestroyed()) return

  const lon = 120.95
  const lat = 23.75
  const h = 500

  const bb = new BillboardCollection()
  const bbIds = bb.addBillboards(viewer, [
    {
      positions: [lon, lat, h],
      svg: svgPin,
      scale: 1.2,
      targetData: { tag: 'smoke-bb' },
    },
  ])
  if (bbIds[0]) {
    bb.updateBillboard(bbIds[0]!, { scale: 1.4, pixelOffsetX: 2 })
    bb.getBillboard(bbIds[0]!)
    bb.setSpecifyVisibility(bbIds[0]!, true)
  }
  bb.getAllBillboards(viewer)
  bb.getCount(viewer)
  bb.setAllVisibility(true, viewer)
  bb.removeAll(viewer)
  bb.pruneInvalid()

  const mc = new ModelCollection()
  const boxDims: [number, number, number] = [120, 120, 120]
  const box = new BoxCollection()
  const boxIds = box.addBoxes(viewer, [
    { positions: [lon + 0.02, lat, h], dimensions: boxDims, color: '#00bcd4', alpha: 0.5 },
  ])
  if (boxIds[0]) {
    box.updateBox(boxIds[0]!, { color: '#ff9800', alpha: 0.6 })
    box.getBox(boxIds[0]!)
  }
  box.getAllBoxes(viewer)
  box.clear(viewer)
  box.pruneInvalid()

  const gltfUrl =
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb'
  const mIds = await mc.addModels(viewer, [
    {
      id: 'smoke-mc-a',
      positions: [lon - 0.02, lat, h],
      uri: gltfUrl,
      scale: 10,
      headingDegrees: 0,
      pitchDegrees: 0,
      rollDegrees: 0,
      targetData: { tag: 'smoke-mc-a' },
    },
    {
      id: 'smoke-mc-b',
      positions: [lon - 0.025, lat + 0.002, h],
      uri: gltfUrl,
      scale: 8,
      headingDegrees: 45,
      pitchDegrees: 5,
      rollDegrees: -3,
    },
  ])
  if (mIds.length) {
    const snap = mc.getModel('smoke-mc-b')
    if (snap && Math.abs(snap.headingDegrees - 45) > 1e-6) {
      console.warn('ModelCollection smoke: heading mismatch', snap)
    }
    mc.updateModel('smoke-mc-a', { scale: 12, pitchDegrees: 10 })
    mc.updateModels([
      { id: 'smoke-mc-b', longitude: lon - 0.024, latitude: lat + 0.002, headingDegrees: 30, rollDegrees: 0 },
    ])
    mc.getModel('smoke-mc-a')
    mc.setSpecifyVisibility('smoke-mc-a', true)
  }
  mc.getAllModels(viewer)
  mc.getCount(viewer)
  mc.getAllIds(viewer)
  mc.setAllVisibility(true, viewer)
  mc.remove('smoke-mc-b')
  mc.clear(viewer)
  mc.pruneInvalid()

  const pvc = new PolylineVolumeCollection()
  const pvIds = pvc.addPolylineVolumes(viewer, [
    {
      id: 'smoke-pvc-a',
      positions: [
        [lon, lat, h],
        [lon + 0.015, lat + 0.01, h + 200],
        [lon + 0.03, lat, h + 100],
      ],
      shapeType: ShapeType.CIRCLE,
      color: '#7c4dff',
      alpha: 0.65,
      targetData: { tag: 'smoke-pvc' },
    },
    {
      positions: [
        [lon + 0.04, lat + 0.02, h],
        [lon + 0.055, lat + 0.025, h + 150],
      ],
      shapeType: ShapeType.HEXAGON,
      color: '#26a69a',
      alpha: 0.7,
    },
  ])
  if (pvIds[0]) {
    pvc.updatePolylineVolume(pvIds[0]!, { alpha: 0.55, show: true })
    pvc.getPolylineVolume(pvIds[0]!)
  }
  if (pvIds.length >= 2 && pvIds[1]) {
    pvc.updatePolylineVolumes([
      { id: pvIds[1]!, color: '#ff7043', shapeType: ShapeType.SQUARE },
    ])
    pvc.getPolylineVolume(pvIds[1]!)
  }
  pvc.getAllPolylineVolumes(viewer)
  pvc.getCount(viewer)
  pvc.getAllIds(viewer)
  pvc.setSpecifyVisibility(pvIds[0] ?? 'smoke-pvc-a', true)
  pvc.setAllVisibility(true, viewer)
  if (pvIds[1]) pvc.remove(pvIds[1])
  pvc.remove('smoke-pvc-a')
  pvc.clear(viewer)
  pvc.getAllIds()
  pvc.pruneInvalid()
  pvc.destroy()

  const plc = new PlaneCollection()
  const assertPlaneUp = (lng: number, lat2: number, alt: number, w: number, ph: number, hd = 0, pt = 0, rl = 0) => {
    const c = Cesium.Cartesian3.fromDegrees(lng, lat2, alt)
    const up = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(c, new Cesium.Cartesian3())
    const m = buildPlaneModelMatrix(lng, lat2, alt, w, ph, hd, pt, rl)
    const n = Cesium.Matrix3.getColumn(Cesium.Matrix4.getMatrix3(m, new Cesium.Matrix3()), 2, new Cesium.Cartesian3())
    Cesium.Cartesian3.normalize(n, n)
    if (Cesium.Cartesian3.dot(n, up) < 0.98) {
      console.warn('PlaneCollection smoke: plane not horizontal', { lng, lat2, hd, pt, rl })
    }
  }
  const plIds = plc.addPlanes(viewer, [
    {
      id: 'smoke-plc-a',
      positions: [lon + 0.06, lat, h],
      dimensions: [120, 80],
      headingDegrees: 12,
      materialType: 'color',
      color: '#e91e63',
      alpha: 0.88,
      targetData: { tag: 'smoke-plc' },
    },
    {
      id: 'smoke-plc-b2',
      positions: [lon + 0.062, lat + 0.002, h + 30],
      dimensions: [100, 100],
      pitchDegrees: -5,
      materialType: 'color',
      color: '#2196f3',
      alpha: 0.75,
    },
  ])
  assertPlaneUp(lon + 0.06, lat, h, 120, 80, 12)
  assertPlaneUp(lon + 0.062, lat + 0.002, h + 30, 100, 100, 0, -5)
  if (plIds[0]) {
    plc.updatePlane(plIds[0]!, { alpha: 0.75, headingDegrees: 20, rollDegrees: 8 })
    plc.getPlane(plIds[0]!)
  }
  const videoId = 'smoke-plc-video'
  const plVideoIds = plc.addPlanes(viewer, [
    {
      id: videoId,
      positions: [lon + 0.064, lat - 0.002, h + 20],
      dimensions: [90, 60],
      materialType: 'video',
      videoUrl:
        'https://cesium.com/public/SandcastleSampleData/big-buck-bunny_trailer.mp4',
      video: { playing: true, loop: true, muted: true, playbackRate: 1, playCount: 0 },
    },
  ])
  const videoPlId = plVideoIds[0] ?? videoId
  if (plc.getPlaneVideoElement(videoPlId)) {
    plc.pausePlaneVideo(videoPlId)
    plc.applyPlaneVideoOptions(videoPlId, { playing: true, loop: true, muted: true })
  }

  if (videoPlId) plc.remove(videoPlId)
  plc.getAllPlanes(viewer)
  plc.getCount(viewer)
  plc.getAllIds(viewer)
  plc.setSpecifyVisibility(plIds[0] ?? 'smoke-plc-a', true)
  plc.setAllVisibility(true, viewer)
  if (plIds[1]) plc.remove(plIds[1])
  plc.remove('smoke-plc-a')
  plc.clear(viewer)
  plc.getAllIds()
  plc.pruneInvalid()
  plc.destroy()

  void Cesium
}
