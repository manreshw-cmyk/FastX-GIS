<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

interface SectionCard {
  key?: string
  title: string
  image: string
}

interface SectionItem {
  key: string
  title: string
  cards: SectionCard[]
}

const props = defineProps<{
  sections: SectionItem[]
}>()

const emit = defineEmits<{
  activeChange: [key: string]
  cardClick: [payload: { sectionKey: string; cardKey: string; title: string }]
}>()
const handleCardClick = (sectionKey: string, card: SectionCard) => {
  const cardKey = card.key || ''
  if (!cardKey) return
  emit('cardClick', { sectionKey, cardKey, title: card.title })
}

const contentRef = ref<HTMLElement | null>(null)
const sectionRefs = ref<Record<string, HTMLElement | null>>({})

const setSectionRef = (key: string, el: unknown) => {
  const raw = el as { $el?: HTMLElement } | HTMLElement | null
  sectionRefs.value[key] =
    raw && typeof raw === 'object' && '$el' in raw ? (raw.$el ?? null) : (raw as HTMLElement | null)
}

const syncActiveByScroll = () => {
  const container = contentRef.value
  if (!container) return

  const sectionElements = props.sections
    .map((section) => sectionRefs.value[section.key])
    .filter((item): item is HTMLElement => !!item)

  if (!sectionElements.length) return

  let current = props.sections[0]?.key ?? ''
  const topLine = container.scrollTop + 24

  sectionElements.forEach((element) => {
    if (topLine >= element.offsetTop) {
      current = element.dataset.anchor || current
    }
  })

  if (current) {
    emit('activeChange', current)
  }
}

const scrollToSection = async (key: string) => {
  await nextTick()
  const container = contentRef.value
  if (!container) return

  const target = sectionRefs.value[key]
  if (target) {
    const top = target.offsetTop - 12
    container.scrollTo({ top, behavior: 'smooth' })
  }
}

defineExpose({
  scrollToSection,
})

onMounted(() => {
  syncActiveByScroll()
})
</script>

<template>
  <a-layout-content class="home-content-shell">
    <div ref="contentRef" class="home-content" @scroll="syncActiveByScroll">
      <section
        v-for="section in sections"
        :key="section.key"
        :ref="(el) => setSectionRef(section.key, el)"
        :data-anchor="section.key"
        class="content-section"
      >
        <div class="section-head">
          <a-typography-title :level="3" class="section-title">
            {{ section.title }}
          </a-typography-title>
        </div>

        <a-row :gutter="[14, 14]">
          <a-col v-for="card in section.cards" :key="card.key || card.title" :xs="24" :sm="12" :md="8" :lg="6" :xl="4">
            <a-card class="feature-card" :bordered="false" @click="handleCardClick(section.key, card)">
              <template #cover>
                <div class="card-cover">
                  <img :src="card.image" :alt="card.title" class="card-image" />
                </div>
              </template>
              <div class="card-title">{{ card.title }}</div>
            </a-card>
          </a-col>
        </a-row>
      </section>
    </div>
  </a-layout-content>
</template>

<style scoped lang="scss">
.home-content-shell {
  height: calc(100vh - 64px);
  overflow: hidden;

  .home-content {
    height: 100%;
    overflow-y: auto;
    padding: 16px;
    background: #f6f8fb;

    .content-section {
      margin-bottom: 18px;
      padding: 12px 14px 14px;
      border-radius: 8px;
      background: #fff;
      border: 1px solid #eef1f6;

      .section-head {
        border-bottom: 1px solid #d9d9d9;
        margin-bottom: 12px;

        .section-title {
          margin-bottom: 8px !important;
          color: #152c42 !important;
          font-size: 18px !important;
        }
      }

      .feature-card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
        overflow: hidden;
        border-radius: 6px;
        border: 1px solid #e8edf3;
        cursor: pointer;
        transition: all 0.2s ease;

        :deep(.ant-card-body) {
          padding: 18px !important;
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(10, 25, 45, 0.12);
        }

        .card-cover {
          height: 152px;
          background: #f5f7fb;
          border-bottom: 1px solid #edf1f6;
          overflow: hidden;

          .card-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }

        .card-title {
          line-height: 1.2;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: #24394d;
        }
      }
    }
  }
}
</style>
