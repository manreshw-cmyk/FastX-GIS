<script setup lang="ts">
import { normalizeHex } from './common/drawFormColor'
import { DeleteOutlined, createLazySfxApi, rgbaCss, useSfxPickDemo } from './common/useSfxPickDemo'
import SectorArcRadarScan from '../../FastX/SpecialEffects/SectorArcRadarScan'
import type { SectorArcRadarScanAddOptions } from '../../FastX/SpecialEffects/SectorArcRadarScan'

const title = '扇弧形雷达扫描'
const getApi = createLazySfxApi(SectorArcRadarScan)

interface SectorArcRadarScanForm {
  id: string
  longitude: number
  latitude: number
  height: number
  heading: number
  pitch: number
  roll: number
  scale: number
  maxRadius: number
  verticalAngle: number
  angle: number
  segments: number
  radialSegments: number
  color: string
  colorAlpha: number
  lineColor: string
  scanVisible: boolean
  scanColor: string
  scanAlpha: number
  scanLineColor: string
  scanAngleRatio: number
  duration: number
  show: boolean
}

function createDefaultForm(): SectorArcRadarScanForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    maxRadius: 300000,
    verticalAngle: 60,
    angle: 90,
    segments: 128,
    radialSegments: 32,
    color: '#006eff',
    colorAlpha: 0.5,
    lineColor: '#ff0000',
    scanVisible: true,
    scanColor: '#ffff00',
    scanAlpha: 1,
    scanLineColor: '#32cc5c',
    scanAngleRatio: 0.18,
    duration: 6000,
    show: true,
  }
}

function buildOptions(form: SectorArcRadarScanForm): SectorArcRadarScanAddOptions {
  return {
    id: form.id.trim() || undefined,
    position: { longitude: form.longitude, latitude: form.latitude, height: form.height },
    heading: form.heading,
    pitch: form.pitch,
    roll: form.roll,
    scale: form.scale,
    maxRadius: form.maxRadius,
    verticalAngle: form.verticalAngle,
    angle: form.angle,
    segments: form.segments,
    radialSegments: form.radialSegments,
    color: rgbaCss(form.color, form.colorAlpha),
    lineColor: form.lineColor,
    scanVisible: form.scanVisible,
    scanColor: rgbaCss(form.scanColor, form.scanAlpha),
    scanLineColor: form.scanLineColor,
    scanAngleRatio: form.scanAngleRatio,
    duration: form.duration,
    show: form.show,
  }
}

const {
  form,
  selectedId,
  tableData,
  tableShellRef,
  tableScrollY,
  columns,
  primaryButtonText,
  onPrimaryClick,
  onCancelSelect,
  onDeleteRow,
  tableRowClassName,
  customTableRow,
} = useSfxPickDemo({ createDefaultForm, buildOptions, getApi })

type ColorField = 'color' | 'lineColor' | 'scanColor' | 'scanLineColor'

const colorFallback: Record<ColorField, string> = {
  color: '#006eff',
  lineColor: '#ff0000',
  scanColor: '#ffff00',
  scanLineColor: '#32cc5c',
}

function onColorPick(field: ColorField, ev: Event): void {
  form[field] = normalizeHex((ev.target as HTMLInputElement).value, colorFallback[field])
}
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ title }}</div>
        <div class="hzd-shell">
          <section class="hzd-pane hzd-pane--form">
            <div class="hzd-pane-title">参数详情</div>
            <div class="hzd-pane-scroll hzd-scroll-skin">
              <div class="hzd-form-fields">
                <div class="hzd-field-row">
                  <span class="hzd-field-label">特效 ID</span>
                  <div class="hzd-field-control">
                    <a-input v-model:value="form.id" class="hzd-control-fill" size="small" allow-clear placeholder="可选，留空自动生成" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">经度(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.longitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">纬度(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.latitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">高度(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.height" class="hzd-control-fill" size="small" :step="10" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">航向(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.heading" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">俯仰(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.pitch" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">翻滚(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.roll" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">缩放</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.scale" class="hzd-control-fill" size="small" :min="0.01" :step="0.1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.maxRadius" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">垂直张角(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.verticalAngle" class="hzd-control-fill" size="small" :min="1" :max="82" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">水平张角(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.angle" class="hzd-control-fill" size="small" :min="1" :max="359" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">弧线密度</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.segments" class="hzd-control-fill" size="small" :min="8" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">径向密度</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.radialSegments" class="hzd-control-fill" size="small" :min="2" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick('color', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充透明度</span>
                  <div class="hzd-field-control">
                    <a-slider v-model:value="form.colorAlpha" class="hzd-slider-fill" :min="0" :max="1" :step="0.05" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">轮廓颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.lineColor }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.lineColor" @input="onColorPick('lineColor', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">扫描块</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.scanVisible" size="small" />
                  </div>
                </div>
                <div v-if="form.scanVisible" class="hzd-field-row">
                  <span class="hzd-field-label">扫描比例</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.scanAngleRatio" class="hzd-slider-fill" :min="0.02" :max="1" :step="0.01" />
                  </div>
                </div>
                <div v-if="form.scanVisible" class="hzd-field-row">
                  <span class="hzd-field-label">循环时长(ms)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.duration" class="hzd-control-fill" size="small" :min="200" />
                  </div>
                </div>
                <div v-if="form.scanVisible" class="hzd-field-row">
                  <span class="hzd-field-label">扫描颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.scanColor }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.scanColor" @input="onColorPick('scanColor', $event)" />
                    </label>
                  </div>
                </div>
                <div v-if="form.scanVisible" class="hzd-field-row">
                  <span class="hzd-field-label">扫描透明度</span>
                  <div class="hzd-field-control">
                    <a-slider v-model:value="form.scanAlpha" class="hzd-slider-fill" :min="0" :max="1" :step="0.05" />
                  </div>
                </div>
                <div v-if="form.scanVisible" class="hzd-field-row">
                  <span class="hzd-field-label">扫描轮廓</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.scanLineColor }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.scanLineColor" @input="onColorPick('scanLineColor', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.show" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <a-button type="primary" block class="map-tool-primary-btn hzd-primary-tall" @click="onPrimaryClick">
                      {{ primaryButtonText }}
                    </a-button>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">
                      取消选中
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">扇弧形雷达扫描列表</div>
            <div ref="tableShellRef" class="hzd-table-area hzd-scroll-skin hzd-table-area--scroll">
              <a-table
                class="hzd-table"
                :columns="columns"
                :data-source="tableData"
                :pagination="false"
                row-key="id"
                size="small"
                :scroll="{ y: tableScrollY }"
                :row-class-name="tableRowClassName"
                :custom-row="customTableRow"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'action'">
                    <a-tooltip title="删除">
                      <a-button type="text" danger size="small" class="hzd-del-btn" aria-label="删除" @click="onDeleteRow(record.id, $event)">
                        <template #icon><DeleteOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </template>
                </template>
              </a-table>
            </div>
          </section>
        </div>
      </div>
    </XDialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/styles/hzd-draw-panel.scss';
</style>
