import mapDemoComponentMetaJson from './component-map.json'
import defaultCardCoverUrl from '../../assets/images/login-bgc.png'

export interface MapDemoComponentMeta {
  key: string
  title: string
  fileName: string
  componentPath: string
  /** 仅在此填写相对路径（相对本文件 `component-map.ts`），如 `./image/xxx.png` 或 `../../assets/images/xxx.png`；不写则用默认图 */
  imageUrl?: string
}

type JsonRow = {
  key: string
  title: string
  fileName: string
  componentPath: string
  imageUrl?: string
}

const rows = mapDemoComponentMetaJson as JsonRow[]

function normPath(p: string): string {
  return p.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/')
}

/** 将 glob 产出的 key 登记为多种等价写法，便于与 JSON 里 `imageUrl` 对齐 */
function registerPathAliases(rawKey: string, url: string, into: Record<string, string>): void {
  const n = normPath(rawKey)
  into[n] = url
  if (n.startsWith('./')) {
    into[n.slice(2)] = url
  } else {
    into[`./${n}`] = url
  }
}

/** 仅收录「可在 JSON 的 imageUrl 里写到的路径」下的静态图，由 Vite 打包 */
const urlByImagePath: Record<string, string> = {}
for (const [key, url] of Object.entries(
  import.meta.glob('../../assets/images/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)) {
  registerPathAliases(key, url, urlByImagePath)
}
for (const [key, url] of Object.entries(
  import.meta.glob('./image/**/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
  }) as Record<string, string>,
)) {
  registerPathAliases(key, url, urlByImagePath)
}

function resolveImageUrlFromJson(spec: string): string | undefined {
  const n = normPath(spec)
  const candidates = [n, n.startsWith('./') ? n.slice(2) : `./${n}`]
  for (const c of candidates) {
    const hit = urlByImagePath[c]
    if (hit) return hit
  }
  return undefined
}

function resolveCoverForRow(row: JsonRow): string {
  const spec = row.imageUrl?.trim()
  if (!spec) return defaultCardCoverUrl
  return resolveImageUrlFromJson(spec) ?? defaultCardCoverUrl
}

const cardCoverByKey: Record<string, string> = {}
for (const row of rows) {
  cardCoverByKey[row.key] = resolveCoverForRow(row)
}

/** 首页等功能卡片封面：仅认 `component-map.json` 的 `imageUrl`；未配置或路径未命中已打包资源时用默认图 */
export function getCardCoverByMapDemoKey(key: string): string {
  return cardCoverByKey[key] ?? defaultCardCoverUrl
}

export const mapDemoComponentMetaList: MapDemoComponentMeta[] = rows.map((r) => ({
  key: r.key,
  title: r.title,
  fileName: r.fileName,
  componentPath: r.componentPath,
  imageUrl: r.imageUrl,
}))

export const mapDemoComponentMetaMap: Record<string, MapDemoComponentMeta> = Object.fromEntries(
  mapDemoComponentMetaList.map((item) => [item.key, item]),
)
