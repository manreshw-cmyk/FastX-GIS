/**
 * Vite 集成：开发态代理 + 生产态拷贝 fastx-sdk 包内 Cesium 静态资源，并注入 CESIUM_BASE_URL。
 *
 * vite.config.ts:
 *   import { vitePluginFastxSdk } from 'fastx-sdk/vite-plugin'
 *   plugins: [vitePluginFastxSdk({ cesiumBaseUrl: '/Cesium/' })]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.dirname(fileURLToPath(import.meta.url))
const cesiumRoot = path.join(pkgRoot, 'lib/Cesium')

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function safeJoin(root, requestPath) {
  const rel = decodeURIComponent(requestPath.split('?')[0] || '/').replace(/^\/+/, '')
  const filePath = path.normalize(path.join(root, rel))
  if (!filePath.startsWith(path.normalize(root))) return null
  return filePath
}

/**
 * @param {{ cesiumBaseUrl?: string }} [options]
 */
export function vitePluginFastxSdk(options = {}) {
  const baseUrl = normalizeBaseUrl(options.cesiumBaseUrl ?? '/Cesium/')
  const mountPath = baseUrl.replace(/\/$/, '') || '/Cesium'
  let outDir = 'dist'

  return {
    name: 'vite-plugin-fastx-sdk',
    config() {
      return {
        define: {
          'globalThis.__FASTX_CESIUM_BASE__': JSON.stringify(baseUrl),
        },
        optimizeDeps: {
          exclude: ['fastx-sdk'],
        },
      }
    },
    configResolved(config) {
      outDir = config.build.outDir
    },
    configureServer(server) {
      server.middlewares.use(mountPath, (req, res, next) => {
        const filePath = safeJoin(cesiumRoot, req.url ?? '/')
        if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next()
        }
        const ext = path.extname(filePath).toLowerCase()
        const types = {
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.wasm': 'application/wasm',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
        }
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
        fs.createReadStream(filePath).pipe(res)
      })
    },
    closeBundle() {
      if (!fs.existsSync(cesiumRoot)) {
        console.warn('[vite-plugin-fastx-sdk] 未找到 lib/Cesium，请先执行 npm run build:sdk 或安装完整 fastx-sdk 包')
        return
      }
      const dest = path.join(outDir, mountPath.replace(/^\//, ''))
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.cpSync(cesiumRoot, dest, { recursive: true })
    },
  }
}
