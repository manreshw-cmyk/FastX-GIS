<script setup lang="ts">
import { normalizeHex } from './common/drawFormColor'
import { DeleteOutlined, createLazySfxApi, rgbaCss, useSfxPickDemo } from './common/useSfxPickDemo'
import AimEffect from '../../FastX/SpecialEffects/AimEffect'
import type { AimEffectAddOptions } from '../../FastX/SpecialEffects/AimEffect'

const title = '瞄准特效'
const getApi = createLazySfxApi(AimEffect)
const DEFAULT_LINE_COLOR = '#ff0000'
const DEFAULT_RING_COLOR = '#ffffff'

interface AimEffectForm {
  id: string
  longitude: number
  latitude: number
  height: number
  sourceLongitude: number
  sourceLatitude: number
  sourceHeight: number
  outsideRadius: number
  insideRadius: number
  segments: number
  lineWidth: number
  color: string
  colorAlpha: number
  lineColor: string
  lineAlpha: number
  show: boolean
}

function createDefaultForm(): AimEffectForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    sourceLongitude: 120.55,
    sourceLatitude: 23.95,
    sourceHeight: 300000,
    outsideRadius: 50000,
    insideRadius: 1,
    segments: 96,
    lineWidth: 1,
    color: DEFAULT_LINE_COLOR,
    colorAlpha: 0.4,
    lineColor: DEFAULT_RING_COLOR,
    lineAlpha: 1,
    show: true,
  }
}

function createPosition(longitude: number, latitude: number, height: number) {
  return { longitude, latitude, height }
}

function buildOptions(form: AimEffectForm): AimEffectAddOptions {
  return {
    id: form.id.trim() || undefined,
    source: createPosition(form.sourceLongitude, form.sourceLatitude, form.sourceHeight),
    target: createPosition(form.longitude, form.latitude, form.height),
    outsideRadius: form.outsideRadius,
    insideRadius: Math.min(form.insideRadius, form.outsideRadius),
    segments: form.segments,
    lineWidth: form.lineWidth,
    color: rgbaCss(form.color, form.colorAlpha),
    lineColor: rgbaCss(form.lineColor, form.lineAlpha),
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

type ColorField = 'color' | 'lineColor'

const colorFallback: Record<ColorField, string> = {
  color: DEFAULT_LINE_COLOR,
  lineColor: DEFAULT_RING_COLOR,
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
                  <span class="hzd-field-label">目标经度(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.longitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">目标纬度(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.latitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">目标高度(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.height" class="hzd-control-fill" size="small" :step="10" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">起点经度(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.sourceLongitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">起点纬度(度)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.sourceLatitude" class="hzd-control-fill" size="small" :step="0.0001" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">起点高度(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.sourceHeight" class="hzd-control-fill" size="small" :step="1000" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">外圈半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.outsideRadius" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">内圈半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.insideRadius" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">几何分段</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.segments" class="hzd-control-fill" size="small" :min="12" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">线宽(px)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.lineWidth" class="hzd-control-fill" size="small" :min="1" :max="10" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">连线颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick('color', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">连线透明度</span>
                  <div class="hzd-field-control">
                    <a-slider v-model:value="form.colorAlpha" class="hzd-slider-fill" :min="0" :max="1" :step="0.05" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">瞄准环颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.lineColor }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="form.lineColor" @input="onColorPick('lineColor', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">瞄准环透明度</span>
                  <div class="hzd-field-control">
                    <a-slider v-model:value="form.lineAlpha" class="hzd-slider-fill" :min="0" :max="1" :step="0.05" />
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
            <div class="hzd-pane-title">瞄准特效列表</div>
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
