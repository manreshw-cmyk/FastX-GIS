<script setup lang="ts">
import { normalizeHex } from './drawFormColor'
import { DeleteOutlined, useSfxPickDemo } from './useSfxPickDemo'
import type { SfxSpatialDemoConfig, SfxSpatialEffectForm, SfxSpatialField } from './sfx-spatial-demo'

const props = defineProps<{
  config: SfxSpatialDemoConfig<any>
}>()

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
} = useSfxPickDemo<SfxSpatialEffectForm, any>({
  createDefaultForm: props.config.createDefaultForm,
  buildOptions: props.config.buildOptions,
  getApi: props.config.getApi,
  preserveHeightOnPick: props.config.preserveHeightOnPick,
  zeroHeightOnPick: props.config.zeroHeightOnPick,
  normalizePickedHeight: props.config.normalizePickedHeight,
})

function isVisible(field: SfxSpatialField): boolean {
  return field.showWhen ? field.showWhen(form) : true
}

function onColorPick(field: SfxSpatialField, ev: Event): void {
  const fallback = field.fallback ?? '#ffffff'
  form[field.key] = normalizeHex((ev.target as HTMLInputElement).value, fallback)
}
</script>

<template>
  <div class="map-tool-float map-tool-float--hzd-point">
    <XDialog :width="560" height="85vh">
      <div class="hzd-dialog-body">
        <div class="map-tool-head hzd-page-title">{{ config.title }}</div>
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
                <div v-for="field in config.fields" :key="field.key" v-show="isVisible(field)" class="hzd-field-row">
                  <span class="hzd-field-label">{{ field.label }}</span>
                  <div class="hzd-field-control" :class="{ 'hzd-field-control--slider': field.control === 'slider' }">
                    <a-input-number
                      v-if="field.control === 'number'"
                      v-model:value="form[field.key]"
                      class="hzd-control-fill"
                      size="small"
                      :min="field.min"
                      :max="field.max"
                      :step="field.step"
                      :placeholder="field.placeholder"
                      :controls="true"
                    />
                    <a-slider
                      v-else-if="field.control === 'slider'"
                      v-model:value="form[field.key]"
                      class="hzd-slider-fill"
                      :min="field.min ?? 0"
                      :max="field.max ?? 1"
                      :step="field.step ?? 0.05"
                    />
                    <a-switch v-else-if="field.control === 'switch'" v-model:checked="form[field.key]" size="small" />
                    <label v-else class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: String(form[field.key]) }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="String(form[field.key])" @input="onColorPick(field, $event)" />
                    </label>
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
            <div class="hzd-pane-title">{{ config.tableTitle ?? `${config.title}列表` }}</div>
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
