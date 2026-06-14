<script setup lang="ts">
import { normalizeHex } from './common/drawFormColor'
import { DeleteOutlined, createLazySfxApi, positionAtZeroHeight, rgbaCss, useSfxPickDemo } from './common/useSfxPickDemo'
import RadarEmissionWave from '../../FastX/SpecialEffects/RadarEmissionWave'

const title = '雷达发射波'
const getApi = createLazySfxApi(RadarEmissionWave)

interface RadarWaveForm {
  id: string
  longitude: number
  latitude: number
  height: number
  heading: number
  pitch: number
  roll: number
  length: number
  bottomRadius: number
  duration: number
  repeat: number
  offset: number
  thickness: number
  color: string
  colorAlpha: number
  show: boolean
}

function createDefaultForm(): RadarWaveForm {
  return { id: '', longitude: 120.95, latitude: 23.75, height: 0, heading: 135, pitch: 0, roll: 0, length: 500000, bottomRadius: 50000, duration: 2000, repeat: 30, offset: 0, thickness: 0.1, color: '#00bfff', colorAlpha: 1, show: true }
}

function buildOptions(form: RadarWaveForm) {
  return {
    id: form.id.trim() || undefined,
    position: positionAtZeroHeight(form),
    heading: form.heading,
    pitch: form.pitch,
    roll: form.roll,
    length: form.length,
    bottomRadius: form.bottomRadius,
    duration: form.duration,
    repeat: form.repeat,
    offset: form.offset,
    thickness: form.thickness,
    color: rgbaCss(form.color, form.colorAlpha),
    show: form.show,
  }
}

const { form, selectedId, tableData, tableShellRef, tableScrollY, columns, primaryButtonText, onPrimaryClick, onCancelSelect, onDeleteRow, tableRowClassName, customTableRow } = useSfxPickDemo({ createDefaultForm, buildOptions, getApi })

function onColorPick(ev: Event): void {
  form.color = normalizeHex((ev.target as HTMLInputElement).value, '#00bfff')
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
                  <span class="hzd-field-label">航向(°)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.heading" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">俯仰(°)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.pitch" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">滚转(°)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.roll" class="hzd-control-fill" size="small" :step="1" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">锥体长度(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.length" class="hzd-control-fill" size="small" :min="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">底面半径(m)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.bottomRadius" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">波动周期(ms)</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.duration" class="hzd-control-fill" size="small" :min="100" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">重复层数</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.repeat" class="hzd-control-fill" size="small" :min="1" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">偏移量</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.offset" class="hzd-control-fill" size="small" :step="0.01" :controls="true" />
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">厚度</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.thickness" class="hzd-control-fill" size="small" :min="0" :max="1" :step="0.01" :controls="true" />
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
            <div class="hzd-pane-title">雷达发射波列表</div>
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

.map-tool-float--hzd-point :deep(.x-dialog-panel) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-tool-float--hzd-point :deep(.x-dialog-inner) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 10px;
}

.hzd-dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hzd-dialog-body > .map-tool-head {
  flex-shrink: 0;
}

.hzd-page-title {
  margin-bottom: 8px;
}

.hzd-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
}

.hzd-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.hzd-pane--form {
  flex: 0 1 auto;
  max-height: min(48vh, 420px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 4px;
}

.hzd-pane--table {
  flex: 1 1 0;
  min-height: 100px;
}

.hzd-pane--table .hzd-pane-title {
  margin-bottom: 6px;
}

.hzd-pane-title {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
}

.hzd-pane-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 12px;
  margin-right: 0;
  box-sizing: border-box;
}

.hzd-scroll-skin {
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);
}

.hzd-scroll-skin::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.hzd-scroll-skin::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.22);
  border-radius: 8px;
}

.hzd-scroll-skin::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(130, 190, 255, 0.55), rgba(80, 140, 220, 0.45));
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hzd-scroll-skin::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(150, 205, 255, 0.78), rgba(100, 160, 235, 0.62));
}

.hzd-form-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 4px;
}

.hzd-field-row {
  display: grid;
  grid-template-columns: minmax(0, 118px) minmax(0, 1fr);
  column-gap: 14px;
  align-items: center;
  min-height: 32px;
}

.hzd-field-row--actions {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 0;
  grid-template-columns: 1fr;
}

.hzd-field-row--actions .hzd-actions-col {
  grid-column: 1 / -1;
  width: 100%;
}

.hzd-field-label {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hzd-field-control {
  min-width: 0;
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.hzd-field-control--slider {
  justify-content: flex-end;
}

/** 参数右侧控件约占本列 80%，靠右与滚动条留出间距 */
.hzd-field-control .hzd-control-fill {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input-number) {
  width: 80% !important;
  max-width: 100%;
}

.hzd-field-control :deep(.ant-input-affix-wrapper) {
  width: 80% !important;
  max-width: 100%;
}
.hzd-field-control :deep(.ant-select) { width: 80% !important; max-width: 100%; }


.hzd-field-control :deep(.ant-input) {
  width: 100%;
}

.hzd-field-control > .ant-space {
  width: 80%;
  justify-content: flex-end;
}

.hzd-muted {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.hzd-color-native {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 80%;
  max-width: 100%;
  min-height: 32px;
  cursor: pointer;
  position: relative;
  padding: 2px 0;
}

.hzd-color-hit {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.hzd-color-native:focus-within .hzd-swatch {
  outline: 2px solid rgba(120, 190, 255, 0.65);
  outline-offset: 2px;
}

.hzd-swatch {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2) inset;
  background: rgba(255, 255, 255, 0.06);
}

.hzd-slider-fill {
  flex: 0 0 auto;
  width: 80%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
}

.hzd-actions-col {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.hzd-primary-tall {
  min-height: 35px !important;
  height: 35px !important;
  padding: 0 14px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}

.hzd-cancel-select {
  color: rgba(255, 255, 255, 0.55) !important;
  align-self: center;
  padding: 0 4px !important;
  height: auto !important;
}

.hzd-cancel-select:hover {
  color: rgba(180, 220, 255, 0.95) !important;
}

.hzd-del-btn {
  width: 28px !important;
  height: 28px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  color: rgba(255, 130, 130, 0.95) !important;
}

.hzd-del-btn:hover {
  color: #ffccc7 !important;
  background: rgba(255, 80, 80, 0.12) !important;
}

.hzd-table :deep(.ant-table-thead > tr > th),
.hzd-table :deep(.ant-table-tbody > tr > td) {
  text-align: center !important;
}

.hzd-table :deep(.ant-table-thead > tr > th) {
  padding: 8px 6px !important;
}

.hzd-table :deep(.ant-table-tbody > tr > td) {
  padding: 7px 6px !important;
}

.hzd-table-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.hzd-table-area--scroll :deep(.ant-table-wrapper),
.hzd-table-area--scroll :deep(.ant-spin-nested-loading),
.hzd-table-area--scroll :deep(.ant-spin-container),
.hzd-table-area--scroll :deep(.ant-table),
.hzd-table-area--scroll :deep(.ant-table-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.hzd-table-area--scroll :deep(.ant-table-container) {
  overflow: hidden;
}

.hzd-table-area--scroll :deep(.ant-table-body) {
  flex: 1;
  overflow: auto !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(110, 168, 235, 0.55) rgba(0, 0, 0, 0.28);
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.22);
  border-radius: 8px;
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(130, 190, 255, 0.55), rgba(80, 140, 220, 0.45));
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hzd-table-area--scroll :deep(.ant-table-body)::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(150, 205, 255, 0.78), rgba(100, 160, 235, 0.62));
}

</style>