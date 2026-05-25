import path from 'node:path'
import { fileURLToPath } from 'node:url'
import alias from '@rollup/plugin-alias'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import dts from 'rollup-plugin-dts'
import esbuild from 'rollup-plugin-esbuild'
import { injectCesiumBasePrelude } from './rollup-plugin-cesium-base.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fastxRoot = path.resolve(__dirname, '..')
const rootDir = path.resolve(__dirname, '../../..')

/** Cesium 运行时指向包内 lib（非 node_modules/cesium），内网/离线仅装 fastx-sdk 即可 */
const cesiumEsmPath = '../lib/Cesium/index.js'
const cesiumCjsPath = '../lib/Cesium/index.cjs'

/** 将 ../index.ts 对 components 的引用替换为 stubs（不打包 Vue 与 import.meta.glob） */
function stubFastXComponents() {
  return {
    name: 'stub-fastx-components',
    resolveId(source, importer) {
      if (!importer || !importer.replace(/\\/g, '/').includes('/FastX/index.')) return null
      if (source === './components' || source === './components/index.ts') {
        return path.join(__dirname, 'stubs/components-stub.ts')
      }
      if (source === './components/x-map.types' || source === './components/x-map.types.ts') {
        return path.join(__dirname, 'stubs/x-map.types-stub.ts')
      }
      return null
    },
  }
}

/** 忽略 .css 导入（样式由 default/index.css 提供） */
function ignoreCss() {
  return {
    name: 'ignore-css',
    resolveId(id) {
      if (id.endsWith('.css')) return '\0css-stub'
    },
    load(id) {
      if (id === '\0css-stub') return ''
    },
  }
}

const sharedPlugins = [
  stubFastXComponents(),
  alias({
    entries: [
      {
        find: path.join(fastxRoot, 'components/index.ts'),
        replacement: path.join(__dirname, 'stubs/components-stub.ts'),
      },
      {
        find: path.join(fastxRoot, 'components/x-map.types.ts'),
        replacement: path.join(__dirname, 'stubs/x-map.types-stub.ts'),
      },
    ],
  }),
  ignoreCss(),
  resolve({ extensions: ['.ts', '.js'] }),
  esbuild({
    include: /\.[jt]s$/,
    exclude: /node_modules/,
    target: 'es2020',
    tsconfig: path.join(__dirname, 'tsconfig.json'),
  }),
]

/** @type {import('rollup').RollupOptions} */
export default defineConfig([
  {
    input: path.join(__dirname, 'entry.ts'),
    external: ['cesium'],
    plugins: [...sharedPlugins, injectCesiumBasePrelude()],
    output: [
      {
        file: path.join(__dirname, 'dist/fastx.esm.js'),
        format: 'esm',
        sourcemap: true,
        paths: { cesium: cesiumEsmPath },
      },
      {
        file: path.join(__dirname, 'dist/fastx.cjs.cjs'),
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
        paths: { cesium: cesiumCjsPath },
      },
    ],
  },
  {
    input: path.join(__dirname, 'entry.ts'),
    external: [/\.css$/, 'cesium'],
    plugins: [
      stubFastXComponents(),
      alias({
        entries: [
          {
            find: path.join(fastxRoot, 'components/index.ts'),
            replacement: path.join(__dirname, 'stubs/components-stub.ts'),
          },
          {
            find: path.join(fastxRoot, 'components/x-map.types.ts'),
            replacement: path.join(__dirname, 'stubs/x-map.types-stub.ts'),
          },
        ],
      }),
      dts({ respectExternal: true }),
    ],
    output: {
      file: path.join(__dirname, 'dist/entry.d.ts'),
      format: 'es',
    },
  },
])
