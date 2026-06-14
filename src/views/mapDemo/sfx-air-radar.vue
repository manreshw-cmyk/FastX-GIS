<script setup lang="ts">
import { normalizeHex } from './common/drawFormColor'
import { DeleteOutlined, createLazySfxApi, positionAtZeroHeight, rgbaCss, useSfxPickDemo } from './common/useSfxPickDemo'
import AirRadar from '../../FastX/SpecialEffects/AirRadar'

const title = '空中扫描雷达'
const getApi = createLazySfxApi(AirRadar)

interface AirRadarForm {
  id: string
  longitude: number
  latitude: number
  height: number
  heading: number
  pitch: number
  roll: number
  scale: number
  length: number
  angle: number
  bottomRadius: number
  innerRadius: number
  segments: number
  lineWidth: number
  scanSpeed: number
  scanAngle: number
  fill: boolean
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
  scanColor: string
  scanAlpha: number
  show: boolean
}

function createDefaultForm(): AirRadarForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    scale: 1,
    length: 200000,
    angle: 30,
    bottomRadius: 0,
    innerRadius: 0,
    segments: 96,
    lineWidth: 1,
    scanSpeed: 60,
    scanAngle: 24,
    fill: true,
    color: '#ffff00',
    colorAlpha: 0.1,
    lineColor: '#00ff00',
    lineAlpha: 0.8,
    scanColor: '#00ff78',
    scanAlpha: 0.35,
    show: true,
  }
}

function buildOptions(form: AirRadarForm) {
  return {
    id: form.id.trim() || undefined,
    position: positionAtZeroHeight(form),
    heading: form.heading,
    pitch: form.pitch,
    roll: form.roll,
    scale: form.scale,
    length: form.length,
    angle: form.angle,
    bottomRadius: form.bottomRadius > 0 ? form.bottomRadius : undefined,
    innerRadius: form.innerRadius,
    segments: form.segments,
    lineWidth: form.lineWidth,
    scanSpeed: form.scanSpeed,
    scanAngle: form.scanAngle,
    fill: form.fill,
    color: rgbaCss(form.color, form.colorAlpha),
    lineColor: rgbaCss(form.lineColor, form.lineAlpha),
    scanColor: rgbaCss(form.scanColor, form.scanAlpha),
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

function onColorPick(field: 'color' | 'lineColor' | 'scanColor', ev: Event): void {
  const fallback = field === 'color' ? '#ffff00' : field === 'lineColor' ? '#00ff00' : '#00ff78'
  form[field] = normalizeHex((ev.target as HTMLInputElement).value, fallback)
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
                  <span class="hzd-field-label">经度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.longitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">纬度（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.latitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">航向（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.heading" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">俯仰（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.pitch" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">滚转（°）</span>
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
                  <span class="hzd-field-label">探测长度(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.length" class="hzd-control-fill" size="small" :min="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">雷达张角（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.angle" class="hzd-control-fill" size="small" :min="1" :max="179" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">底面半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.bottomRadius" class="hzd-control-fill" size="small" :min="0" placeholder="0=自动" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">内环(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.innerRadius" class="hzd-control-fill" size="small" :min="0" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">分段数</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.segments" class="hzd-control-fill" size="small" :min="8" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">线宽(px)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.lineWidth" class="hzd-control-fill" size="small" :min="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">扫描速度(°/s)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.scanSpeed" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">扫描张角（°）</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.scanAngle" class="hzd-control-fill" size="small" :min="1" :max="120" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">填充面</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.fill" size="small" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">锥体颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick('color', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">锥体透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
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
                  <span class="hzd-field-label">扫描颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.scanColor }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.scanColor" @input="onColorPick('scanColor', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">扫描透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.scanAlpha" class="hzd-slider-fill" :min="0" :max="1" :step="0.05" />
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
            <div class="hzd-pane-title">空中扫描雷达列表</div>
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
