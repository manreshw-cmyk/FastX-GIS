<script setup lang="ts">
import { normalizeHex } from './common/drawFormColor'
import { DeleteOutlined, createLazySfxApi, positionAtZeroHeight, rgbaCss, useSfxPickDemo } from './common/useSfxPickDemo'
import CircleDiffusion from '../../FastX/SpecialEffects/CircleDiffusion'

const title = '圆扩散'
const listTitle = '圆扩散列表'
const getApi = createLazySfxApi(CircleDiffusion)

interface CircleDiffusionForm {
  id: string
  longitude: number
  latitude: number
  height: number
  maxRadius: number
  duration: number
  color: string
  colorAlpha: number
  show: boolean
}

function createDefaultForm(): CircleDiffusionForm {
  return {
    id: '',
    longitude: 120.95,
    latitude: 23.75,
    height: 0,
    maxRadius: 1000000,
    duration: 2000,
    color: '#00ff00',
    colorAlpha: 1,
    show: true,
  }
}

function buildOptions(form: CircleDiffusionForm) {
  return {
    id: form.id.trim() || undefined,
    position: positionAtZeroHeight(form),
    maxRadius: form.maxRadius,
    duration: form.duration,
    color: rgbaCss(form.color, form.colorAlpha),
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

function onColorPick(ev: Event): void {
  form.color = normalizeHex((ev.target as HTMLInputElement).value, '#00ff00')
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
                  <span class="hzd-field-label">最大半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.maxRadius" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">扩散时长(ms)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.duration" class="hzd-control-fill" size="small" :min="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">颜色</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native"><span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" /><input type="color" class="hzd-color-hit" :value="form.color" @input="onColorPick" /></label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.colorAlpha" class="hzd-slider-fill" :min="0" :max="1" :step="0.05" />
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
            <div class="hzd-pane-title">{{ listTitle }}</div>
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
