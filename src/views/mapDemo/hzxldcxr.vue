<script setup lang="ts">
import { useHzxldcxrPolylineDemo } from './components/common/useHzxldcxrPolylineDemo'

const {
  title,
  form,
  plotArmed,
  selectedId,
  draftVertices,
  tableData,
  tableShellRef,
  tableScrollY,
  columns,
  lineKindFormOptions,
  arcTypeFormOptions,
  cornerTypeFormOptions,
  primaryButtonText,
  primaryButtonType,
  onPrimaryClick,
  onCancelSelect,
  onColorPick,
  hex6ForColorInput,
  onDeleteRow,
  tableRowClassName,
  customTableRow,
} = useHzxldcxrPolylineDemo()
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
                  <span class="hzd-field-label">线 ID</span>
                  <div class="hzd-field-control">
                    <a-input
                      v-model:value="form.id"
                      class="hzd-control-fill"
                      size="small"
                      allow-clear
                      placeholder="可选，留空自动生成"
                      :disabled="!!selectedId"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">线类型</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.lineKind"
                      class="hzd-control-fill hzd-select-like-input"
                      popup-class-name="hzd-select-dropdown-dark"
                      size="small"
                      :options="lineKindFormOptions"
                    />
                  </div>
                </div>

                <div
                  v-if="form.lineKind !== 'wall' && form.lineKind !== 'volume_block' && form.lineKind !== 'volume_tube'"
                  class="hzd-field-row"
                >
                  <span class="hzd-field-label">路径弧段 arcType</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.arcType"
                      class="hzd-control-fill hzd-select-like-input"
                      popup-class-name="hzd-select-dropdown-dark"
                      size="small"
                      :options="arcTypeFormOptions"
                    />
                  </div>
                </div>

                <div v-if="form.lineKind === 'volume_block' || form.lineKind === 'volume_tube'" class="hzd-field-row">
                  <span class="hzd-field-label">体拐角 cornerType</span>
                  <div class="hzd-field-control">
                    <a-select
                      v-model:value="form.cornerType"
                      class="hzd-control-fill hzd-select-like-input"
                      popup-class-name="hzd-select-dropdown-dark"
                      size="small"
                      :options="cornerTypeFormOptions"
                    />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">主色(虚线段等)</span>
                  <div class="hzd-field-control">
                    <label class="hzd-color-native">
                      <span class="hzd-swatch" :style="{ backgroundColor: form.color }" aria-hidden="true" />
                      <input type="color" class="hzd-color-hit" :value="hex6ForColorInput(form.color)" @input="onColorPick('color', $event)" />
                    </label>
                  </div>
                </div>
                <div class="hzd-field-row">
                  <span class="hzd-field-label">主色透明度</span>
                  <div class="hzd-field-control hzd-field-control--slider">
                    <a-slider v-model:value="form.alpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                  </div>
                </div>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">线宽(px)/管径参考</span>
                  <div class="hzd-field-control">
                    <a-input-number v-model:value="form.width" class="hzd-control-fill" size="small" />
                  </div>
                </div>

                <template v-if="form.lineKind === 'clamp_ground'">
                  <p class="hzd-muted">
                    贴地线：`polylineClampToGround = 1`；标绘时每点一条「椭球面实线」预览，点「完成线段」后再生成贴地 Entity（避免预览阶段反复重建 GroundPolyline 导致卡顿与显存暴涨）。顶点过多或路径过长时可能自动降级（见 targetData）。
                  </p>
                </template>

                <div class="hzd-field-row">
                  <span class="hzd-field-label">显示</span>
                  <div class="hzd-field-control">
                    <a-switch v-model:checked="form.show" size="small" />
                  </div>
                </div>

                <template v-if="form.lineKind === 'dashed'">
                  <p class="hzd-muted">虚线段颜色取「主色」；以下为间隙（隐藏段）。</p>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">间隙颜色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.dashGapColor }" aria-hidden="true" />
                        <input
                          type="color"
                          class="hzd-color-hit"
                          :value="hex6ForColorInput(form.dashGapColor)"
                          @input="onColorPick('dashGapColor', $event)"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">间隙透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.dashGapAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">dashLength</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.dashLength" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">dashPattern</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.dashPattern" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                </template>

                <template v-if="form.lineKind === 'outline'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">描边颜色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.outlineRingColor }" aria-hidden="true" />
                        <input
                          type="color"
                          class="hzd-color-hit"
                          :value="hex6ForColorInput(form.outlineRingColor)"
                          @input="onColorPick('outlineRingColor', $event)"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">描边透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.outlineRingAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">描边宽度</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.outlineRingWidth" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                </template>

                <template v-if="form.lineKind === 'glowing'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">glowPower</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.glowPower" :min="0.05" :max="0.9" :step="0.02" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">taperPower</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.taperPower" :min="0.2" :max="1" :step="0.02" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <p class="hzd-muted">发光线建议线宽 ≥ 6（提交时自动取较大值）。</p>
                </template>

                <template v-if="form.lineKind === 'flowing'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">流动贴图 URL</span>
                    <div class="hzd-field-control">
                      <a-input v-model:value="form.flowingImageUrl" class="hzd-control-fill" size="small" placeholder="留空则程序条纹拖尾" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">流动着色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.flowTint }" aria-hidden="true" />
                        <input
                          type="color"
                          class="hzd-color-hit"
                          :value="hex6ForColorInput(form.flowTint)"
                          @input="onColorPick('flowTint', $event)"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">着色透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.flowTintAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">一周期(秒)</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.flowCycleSeconds" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">拖尾长度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.trailLength" :min="0.05" :max="0.95" :step="0.02" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">沿线重复</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.repeatAlongLine" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">重复流动</span>
                    <div class="hzd-field-control">
                      <a-switch v-model:checked="form.repeatFlow" size="small" />
                    </div>
                  </div>
                </template>

                <template v-if="form.lineKind === 'arrow'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">线宽（含箭头）</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.arrowSize" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">箭头颜色</span>
                    <div class="hzd-field-control">
                      <label class="hzd-color-native">
                        <span class="hzd-swatch" :style="{ backgroundColor: form.arrowColor }" aria-hidden="true" />
                        <input
                          type="color"
                          class="hzd-color-hit"
                          :value="hex6ForColorInput(form.arrowColor)"
                          @input="onColorPick('arrowColor', $event)"
                        />
                      </label>
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">箭头透明度</span>
                    <div class="hzd-field-control hzd-field-control--slider">
                      <a-slider v-model:value="form.arrowAlpha" :min="0" :max="1" :step="0.05" class="hzd-slider-fill" />
                    </div>
                  </div>
                  <p class="hzd-muted">
                    整条折线 + Cesium 原生末端箭头（`PolylineArrowMaterialProperty`）。「线宽（含箭头）」未填时用上方通用线宽。
                  </p>
                </template>

                <template v-if="form.lineKind === 'gradient'">
                  <p class="hzd-muted">渐变串与贴图同时存在时仅贴图生效。渐变串示例：0.0,#00000000,1.0,#ff00ff</p>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">渐变串</span>
                    <div class="hzd-field-control">
                      <a-input v-model:value="form.gradientColorTexture" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">渐变贴图 URL</span>
                    <div class="hzd-field-control">
                      <a-input v-model:value="form.gradientImageUrl" class="hzd-control-fill" size="small" placeholder="可选" />
                    </div>
                  </div>
                </template>

                <template v-if="form.lineKind === 'volume_block'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">体块宽度(m)</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.vbWidth" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">基准高度(m)</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.vbBase" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">延伸高度(m)</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.vbExtrude" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                </template>

                <template v-if="form.lineKind === 'volume_tube'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">管半径(m)</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.tubeRadius" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">平滑度</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.tubeSmooth" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <p class="hzd-muted">对应 PolylineVolume granularity：数值越大路径细分越密、越圆滑。</p>
                </template>

                <template v-if="form.lineKind === 'wall'">
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">墙基准高(m)</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.wallBase" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                  <div class="hzd-field-row">
                    <span class="hzd-field-label">墙延伸高(m)</span>
                    <div class="hzd-field-control">
                      <a-input-number v-model:value="form.wallExtrude" class="hzd-control-fill" size="small" />
                    </div>
                  </div>
                </template>

                <div class="hzd-field-row hzd-field-row--actions">
                  <div class="hzd-actions-col">
                    <a-button
                      :type="primaryButtonType"
                      block
                      class="map-tool-primary-btn hzd-primary-tall"
                      @click="onPrimaryClick"
                    >
                      {{ primaryButtonText }}
                    </a-button>
                    <a-button v-if="selectedId" type="link" size="small" class="hzd-cancel-select" @click="onCancelSelect">
                      取消选中
                    </a-button>
                    <p v-if="plotArmed && !selectedId" class="hzd-muted">
                      当前顶点 {{ draftVertices.length }} 个；≥2 个后可点「完成线段」。拾取点默认椭球高为 0；有量化地形、高度≈0 且路径不太长时自动贴地。仅箭头线挂载时会将 `depthTestAgainstTerrain` 置 false。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="hzd-pane hzd-pane--table">
            <div class="hzd-pane-title">折线列表</div>
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
                      <a-button
                        type="text"
                        danger
                        size="small"
                        class="hzd-del-btn"
                        aria-label="删除"
                        @click="onDeleteRow(record.id, $event)"
                      >
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

.hzd-field-control :deep(.ant-select) {
  width: 80% !important;
  max-width: 100%;
  overflow: visible;
}

/** 表单内所有下拉：与 small 输入框视觉统一；保留右侧下拉箭头 */
.hzd-field-control .hzd-select-like-input :deep(.ant-select-selector) {
  height: 24px !important;
  min-height: 24px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  padding-inline-end: 28px !important;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22) !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  box-shadow: none !important;
  overflow: visible !important;
}

.hzd-field-control .hzd-select-like-input :deep(.ant-select-arrow),
.hzd-field-control .hzd-select-like-input :deep(.ant-select-suffix) {
  opacity: 1 !important;
  color: rgba(255, 255, 255, 0.78) !important;
  inset-inline-end: 8px !important;
}

.hzd-field-control .hzd-select-like-input :deep(.anticon) {
  opacity: 1 !important;
  color: rgba(255, 255, 255, 0.78) !important;
}

.hzd-field-control .hzd-select-like-input :deep(.ant-select-selection-item),
.hzd-field-control .hzd-select-like-input :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
  color: rgba(255, 255, 255, 0.88);
}

.hzd-field-control .hzd-select-like-input :deep(.ant-select:not(.ant-select-disabled):hover .ant-select-selector),
.hzd-field-control .hzd-select-like-input :deep(.ant-select-focused .ant-select-selector) {
  border-color: rgba(120, 180, 255, 0.45) !important;
}

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
  margin: 0;
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

.hzd-table :deep(.ant-table-tbody > tr.hzd-point-row--active > td) {
  background: rgba(80, 140, 220, 0.18) !important;
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
