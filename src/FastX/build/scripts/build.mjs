/**
 * fastx-sdk 构建：校验 README → 准备 default 样式 → 拷贝 Cesium → Rollup 打包 JS + d.ts
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import colors from 'picocolors'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(buildDir, '../../..')

function log(step, msg) {
  console.log(colors.cyan(`[fastx-sdk] ${step}`), msg)
}

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function copyDir(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
}

// 0. npm pack / publish 会读取本目录 README.md（package.json files 已包含）
function ensureReadme() {
  const readme = path.join(buildDir, 'README.md')
  if (!fs.existsSync(readme)) {
    throw new Error(`缺少 README.md，npm pack 将无法展示包说明：\n  ${readme}`)
  }
  log('0/5', `已就绪 README.md（${fs.statSync(readme).size} bytes，将随包发布）`)
}

// 1. default/index.css ← Cesium widgets.css + 包内占位说明
function prepareDefaultCss() {
  const widgetsCss = path.join(rootDir, 'node_modules/cesium/Build/Cesium/Widgets/widgets.css')
  const outCss = path.join(buildDir, 'default/index.css')
  fs.mkdirSync(path.dirname(outCss), { recursive: true })
  if (!fs.existsSync(widgetsCss)) {
    throw new Error(`未找到 Cesium widgets.css，请先在仓库根目录执行 npm install：\n  ${widgetsCss}`)
  }
  const header = `/* fastx-sdk default styles — 含 Cesium Widgets 基础样式 */\n`
  fs.writeFileSync(outCss, header + fs.readFileSync(widgetsCss, 'utf8'), 'utf8')
  log('1/5', '已生成 default/index.css')
}

// 2. lib/Cesium ← node_modules/cesium/Build/Cesium + 类型声明
function copyCesiumAssets() {
  const src = path.join(rootDir, 'node_modules/cesium/Build/Cesium')
  const dest = path.join(buildDir, 'lib/Cesium')
  if (!fs.existsSync(src)) {
    throw new Error(`未找到 Cesium Build 目录：\n  ${src}`)
  }
  rimraf(dest)
  copyDir(src, dest)
  log('2/5', '已拷贝 lib/Cesium（含 index.js / Workers / Assets / Widgets）')
}

function copyCesiumTypes() {
  const src = path.join(rootDir, 'node_modules/cesium/Source/Cesium.d.ts')
  const dest = path.join(buildDir, 'lib/Cesium.d.ts')
  if (!fs.existsSync(src)) {
    throw new Error(`未找到 Cesium.d.ts：\n  ${src}`)
  }
  fs.copyFileSync(src, dest)
  log('3/5', '已拷贝 lib/Cesium.d.ts（TypeScript 类型，内网无需 cesium 包）')
}

/** vendor/<id>/ → lib/<id>/（manifest 登记的插件目录） */
function copyVendorPlugins() {
  const manifestPath = path.join(buildDir, 'vendor/manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`缺少 vendor/manifest.json：\n  ${manifestPath}`)
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  for (const plugin of manifest.plugins ?? []) {
    const src = path.join(buildDir, 'vendor', plugin.id)
    const dest = path.join(buildDir, 'lib', plugin.id)
    if (!fs.existsSync(src)) {
      throw new Error(`vendor 插件目录不存在：${src}`)
    }
    rimraf(dest)
    copyDir(src, dest)
    log('2b/5', `已拷贝 lib/${plugin.id}（${plugin.name}@${plugin.version}）`)
  }
}

/** dist/entry.d.ts 注入包内 Cesium 类型，内网无需 node_modules/cesium */
function patchEntryDts() {
  const dtsPath = path.join(buildDir, 'dist/entry.d.ts')
  if (!fs.existsSync(dtsPath)) return
  let text = fs.readFileSync(dtsPath, 'utf8')
  const ref = '/// <reference path="../lib/Cesium.d.ts" />\n'
  if (!text.startsWith('/// <reference path="../lib/Cesium.d.ts"')) {
    text = ref + text
  }
  fs.writeFileSync(dtsPath, text, 'utf8')
  log('5/5', '已为 dist/entry.d.ts 注入包内 Cesium 类型引用')
}

// 3. dist/ ← Rollup
function runRollup() {
  const config = path.join(buildDir, 'rollup.config.js')
  log('4/5', 'Rollup 打包…')
  const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['rollup', '-c', config],
    { cwd: buildDir, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' },
  )
  if (r.status !== 0) process.exit(r.status ?? 1)
  log('5/5', 'Rollup 打包完成 → dist/')
  patchEntryDts()
}

/** 构建后校验：防止打包缺文件或 Cesium 引用路径错误 */
function verifyPackIntegrity() {
  const checks = [
    ['dist/fastx.esm.js', (p) => {
      const code = fs.readFileSync(p, 'utf8')
      if (!code.includes("from '../lib/Cesium/index.js'")) {
        throw new Error('dist/fastx.esm.js 未引用包内 ../lib/Cesium/index.js')
      }
      if (!code.includes('__fastxEnsureCesiumBaseUrl')) {
        throw new Error('dist/fastx.esm.js 缺少 Cesium BASE_URL 前置初始化')
      }
      if (/from ['"]cesium['"]/.test(code)) {
        throw new Error('dist/fastx.esm.js 仍引用外部 cesium 包')
      }
      if (!code.includes('../assets/mouse/')) {
        throw new Error('dist/fastx.esm.js 未包含包内鼠标样式 assets/mouse 解析逻辑')
      }
    }],
    ['dist/fastx.cjs.cjs', (p) => {
      const code = fs.readFileSync(p, 'utf8')
      if (!code.includes('../lib/Cesium/index.cjs')) {
        throw new Error('dist/fastx.cjs.cjs 未引用包内 ../lib/Cesium/index.cjs')
      }
      if (!code.includes('__fastxEnsureCesiumBaseUrl')) {
        throw new Error('dist/fastx.cjs.cjs 缺少 Cesium BASE_URL 前置初始化')
      }
      if (!code.includes('../assets/mouse/')) {
        throw new Error('dist/fastx.cjs.cjs 未包含包内鼠标样式 assets/mouse 解析逻辑')
      }
    }],
    ['dist/entry.d.ts', (p) => {
      const text = fs.readFileSync(p, 'utf8')
      if (!text.includes('/// <reference path="../lib/Cesium.d.ts" />')) {
        throw new Error('dist/entry.d.ts 缺少 Cesium 类型引用')
      }
    }],
    ['lib/Cesium/index.js', (p) => {
      if (fs.statSync(p).size < 1_000_000) throw new Error('lib/Cesium/index.js 体积异常（可能拷贝不完整）')
    }],
    ['lib/Cesium/Workers', (p) => {
      if (fs.readdirSync(p).length < 10) throw new Error('lib/Cesium/Workers 文件过少')
    }],
    ['lib/Cesium/Assets', (p) => {
      if (!fs.existsSync(path.join(p, 'approximateTerrainHeights.json'))) {
        throw new Error('lib/Cesium/Assets 缺少 approximateTerrainHeights.json')
      }
    }],
    ['assets/mouse/pointer.cur', (p) => {
      if (fs.statSync(p).size < 1000) throw new Error('assets/mouse/pointer.cur 体积异常')
    }],
    ['assets/mouse/tilt.cur', (p) => {
      if (fs.statSync(p).size < 1000) throw new Error('assets/mouse/tilt.cur 体积异常')
    }],
    ['assets/mouse/center.cur', (p) => {
      if (fs.statSync(p).size < 1000) throw new Error('assets/mouse/center.cur 体积异常')
    }],
    ['lib/Cesium.d.ts', null],
    ['lib/heatmap/heatmap.min.js', (p) => {
      if (fs.statSync(p).size < 1000) throw new Error('lib/heatmap/heatmap.min.js 体积异常')
    }],
    ['lib/turf/turf.min.js', (p) => {
      if (fs.statSync(p).size < 100_000) throw new Error('lib/turf/turf.min.js 体积异常')
    }],
    ['lib/cesium-navigation/CesiumNavigation.umd.js', null],
    ['default/index.css', null],
    ['package.json', (p) => {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (pkg.dependencies?.cesium || pkg.peerDependencies?.cesium) {
        throw new Error('package.json 不应依赖外部 cesium（应完全自包含）')
      }
      if (!pkg.files?.includes('assets')) {
        throw new Error('package.json files 缺少 assets，鼠标样式资源不会随 npm 包发布')
      }
    }],
  ]

  for (const [rel, validate] of checks) {
    const full = path.join(buildDir, rel)
    if (!fs.existsSync(full)) {
      throw new Error(`校验失败，缺少文件：${rel}`)
    }
    if (validate) validate(full)
  }
  log('verify', '打包完整性校验通过（dist / lib/Cesium / lib/plugins / 类型 / 无外部 cesium 依赖）')
}

function removeOldTgz() {
  for (const name of fs.readdirSync(buildDir)) {
    if (!name.startsWith('fastx-sdk-') || !name.endsWith('.tgz')) continue
    const file = path.join(buildDir, name)
    try {
      fs.unlinkSync(file)
      log('pack', `已删除旧包 ${name}`)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : ''
      if (code === 'EBUSY' || code === 'EPERM') {
        throw new Error(
          `无法覆盖 ${name}（文件被占用）。请关闭 IDE 中打开的 .tgz 后重试 npm run build:sdk。`,
        )
      }
      throw err
    }
  }
}

function runNpmPack() {
  removeOldTgz()
  log('pack', '正在生成 fastx-sdk-*.tgz …')
  const npmCache = path.join(buildDir, '.npm-cache')
  const r = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['pack', '--silent', '--ignore-scripts', '--cache', npmCache],
    { cwd: buildDir, encoding: 'utf8', shell: process.platform === 'win32' },
  )
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    process.exit(r.status ?? 1)
  }
  const tgzName = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop()
  if (!tgzName) {
    throw new Error('npm pack 未返回 tarball 文件名')
  }
  const tgzPath = path.join(buildDir, tgzName)
  if (!fs.existsSync(tgzPath)) {
    throw new Error(`npm pack 未生成文件：${tgzPath}`)
  }
  const sizeMb = (fs.statSync(tgzPath).size / (1024 * 1024)).toFixed(2)
  log('pack', `已生成 ${tgzName}（${sizeMb} MB）`)
  return { tgzName, tgzPath, sizeMb }
}

function printSuccessBanner(tgz) {
  const logo = `
   ███████╗ █████╗ ███████╗████████╗██╗  ██╗     ██████╗ ██╗███████╗
   ██╔════╝██╔══██╗██╔════╝╚══██╔══╝╚██╗██╔╝     ██╔══██╗██║██╔════╝
   █████╗  ███████║███████╗   ██║    ╚███╔╝█████╗██████╔╝██║███████╗
   ██╔══╝  ██╔══██║╚════██║   ██║    ██╔██╗╚════╝██╔══██╗██║╚════██║
   ██║     ██║  ██║███████║   ██║   ██╔╝ ██╗     ██████╔╝██║███████║
   ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝     ╚═════╝ ╚═╝╚══════╝
      `

  console.log(
    colors.green(logo) +
      `\n${colors.green('✓')} ${colors.bold('fastx-sdk 构建成功')}\n` +
      `\n  ${colors.dim('📁 发布目录:')} ${colors.cyan('src/FastX/build')}` +
      `\n  ${colors.dim('📦 安装包:')} ${colors.yellow(tgz.tgzName)} ${colors.dim(`(${tgz.sizeMb} MB)`)}` +
      `\n  ${colors.dim('📦 打包格式:')} ${colors.yellow('ESM + CJS + d.ts')}` +
      `\n` +
      `\n  ${colors.dim('npm publish 请在 src/FastX/build 目录执行')}` +
      `\n  ${colors.dim('npm 将自动读取本目录 README.md 作为包首页说明')}` +
      `\n` +
      `\n  ${colors.green('✨ 开源不易，请珍惜!')}\n`,
  )
}

function main() {
  log('start', '开始构建 fastx-sdk …')
  ensureReadme()
  fs.mkdirSync(path.join(buildDir, 'dist'), { recursive: true })
  prepareDefaultCss()
  copyCesiumAssets()
  copyVendorPlugins()
  copyCesiumTypes()
  runRollup()
  verifyPackIntegrity()
  const tgz = runNpmPack()
  log('done', '全部完成')
  printSuccessBanner(tgz)
}

main()
