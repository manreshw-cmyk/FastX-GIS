import path from 'node:path'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const archAliases = {
  64: 'x64',
  x64: 'x64',
  amd64: 'x64',
  x86_64: 'x64',
  32: 'ia32',
  x32: 'ia32',
  x86: 'ia32',
  ia32: 'ia32',
  i386: 'ia32',
  arm64: 'arm64',
  aarch64: 'arm64',
  arm32: 'armv7l',
  armv7l: 'armv7l',
}
const archFlags = {
  x64: '--x64',
  ia32: '--ia32',
  arm64: '--arm64',
  armv7l: '--armv7l',
}
const windowsArches = ['x64', 'ia32']
const linuxTargets = {
  deb: ['x64', 'ia32', 'arm64', 'armv7l'],
  rpm: ['x64', 'ia32', 'arm64'],
}
const buildOptions = parseBuildOptions(process.argv.slice(2))
const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'
const builderCmd = isWindows ? 'electron-builder.cmd' : 'electron-builder'
const rootDir = process.cwd()
const cacheRoot = path.join(rootDir, '.tmp', 'electron')
const tempRoot = path.join(cacheRoot, 'temp')
const electronConfigPath = path.join(rootDir, 'electron', 'config.js')
const distConfigPath = path.join(rootDir, 'FastXDist', 'config.js')
const electronDistPath = path.join(rootDir, 'ElectronDist')

fs.mkdirSync(tempRoot, { recursive: true })

function normalizeArch(arch) {
  const key = String(arch).replace(/^--?/, '').toLowerCase()
  const normalized = archAliases[key]
  if (!normalized) throw new Error(`[electron-build] unsupported arch: ${arch}`)
  return normalized
}

function addListItems(target, value, normalizer = (item) => item) {
  for (const item of String(value).split(',')) {
    const normalizedItem = item.trim()
    if (!normalizedItem) continue
    target.add(normalizer(normalizedItem))
  }
}

function readOptionValue(args, index, flag, inlineValue) {
  if (inlineValue) return [inlineValue, index]

  const nextValue = args[index + 1]
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`[electron-build] ${flag} requires a value`)
  }

  return [nextValue, index + 1]
}

function parseBuildOptions(args) {
  const platforms = new Set()
  const targets = new Set()
  const arches = new Set()
  let isAll = args.length === 0

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const [rawFlag, inlineValue] = arg.split('=')
    const flag = rawFlag.toLowerCase()

    if (flag === '--all') {
      isAll = true
      continue
    }

    if (flag === '--win' || flag === '--windows') {
      platforms.add('win')
      continue
    }

    if (flag === '--linux') {
      platforms.add('linux')
      continue
    }

    if (flag === '--deb' || flag === '--rpm') {
      platforms.add('linux')
      targets.add(flag.slice(2))
      continue
    }

    if (flag === '--target') {
      const [value, nextIndex] = readOptionValue(args, index, flag, inlineValue)
      index = nextIndex
      addListItems(targets, value, (target) => {
        const normalizedTarget = target.toLowerCase()
        if (!linuxTargets[normalizedTarget]) {
          throw new Error(`[electron-build] unsupported linux target: ${target}`)
        }
        return normalizedTarget
      })
      platforms.add('linux')
      continue
    }

    if (flag === '--arch') {
      const [value, nextIndex] = readOptionValue(args, index, flag, inlineValue)
      index = nextIndex
      addListItems(arches, value, normalizeArch)
      continue
    }

    if (flag in archAliases || flag.replace(/^--/, '') in archAliases) {
      arches.add(normalizeArch(flag))
      continue
    }

    throw new Error(`[electron-build] unknown option: ${arg}`)
  }

  if (isAll || platforms.size === 0) {
    platforms.add('win')
    platforms.add('linux')
  }

  return { platforms, targets, arches }
}

function resolveArches(requestedArches, supportedArches) {
  if (requestedArches.size === 0) return supportedArches
  return supportedArches.filter((arch) => requestedArches.has(arch))
}

function createBuildCommands(options) {
  const commands = []

  if (options.platforms.has('win')) {
    const selectedArches = resolveArches(options.arches, windowsArches)
    if (selectedArches.length > 0) {
      commands.push(['--win', 'nsis', ...selectedArches.map((arch) => archFlags[arch])])
    }
  }

  if (options.platforms.has('linux')) {
    const selectedTargets = options.targets.size > 0 ? [...options.targets] : Object.keys(linuxTargets)

    for (const target of selectedTargets) {
      const selectedArches = resolveArches(options.arches, linuxTargets[target])
      if (selectedArches.length === 0) continue
      commands.push(['--linux', target, ...selectedArches.map((arch) => archFlags[arch])])
    }
  }

  if (commands.length === 0) {
    throw new Error('[electron-build] no compatible build target found for current options')
  }

  return commands
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: isWindows,
      ...options,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function copyDirectory(source, target) {
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  fs.cpSync(source, target, { recursive: true, force: true })
}

function repairNsisCache() {
  if (!isWindows) return false

  const nsisCacheDir = path.join(cacheRoot, 'builder-cache', 'nsis')
  if (!fs.existsSync(nsisCacheDir)) return false

  const nsisTargetDir = path.join(nsisCacheDir, 'nsis-3.0.4.1')
  const resourcesTargetDir = path.join(nsisCacheDir, 'nsis-resources-3.4.1')
  const hasNsis = fs.existsSync(path.join(nsisTargetDir, 'Bin', 'makensis.exe'))
  const hasResources = fs.existsSync(path.join(resourcesTargetDir, 'plugins', 'x86-unicode', 'UAC.dll'))
  let repaired = false

  for (const entry of fs.readdirSync(nsisCacheDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('nsis-')) continue

    const sourceDir = path.join(nsisCacheDir, entry.name)
    const makensisPath = path.join(sourceDir, 'Bin', 'makensis.exe')
    const resourceUacPath = path.join(sourceDir, 'plugins', 'x86-unicode', 'UAC.dll')

    if (!hasResources && fs.existsSync(resourceUacPath)) {
      copyDirectory(sourceDir, resourcesTargetDir)
      repaired = true
      continue
    }

    if (!hasNsis && fs.existsSync(makensisPath)) {
      copyDirectory(sourceDir, nsisTargetDir)
      repaired = true
    }
  }

  return repaired
}

function repairWinCodeSignCache() {
  if (!isWindows) return false

  const winCodeSignCacheDir = path.join(cacheRoot, 'builder-cache', 'winCodeSign')
  if (!fs.existsSync(winCodeSignCacheDir)) return false

  const targetDir = path.join(winCodeSignCacheDir, 'winCodeSign-2.6.0')
  if (fs.existsSync(path.join(targetDir, 'rcedit-x64.exe'))) return false

  for (const entry of fs.readdirSync(winCodeSignCacheDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('winCodeSign-')) continue

    const sourceDir = path.join(winCodeSignCacheDir, entry.name)
    if (!fs.existsSync(path.join(sourceDir, 'rcedit-x64.exe'))) continue

    copyDirectory(sourceDir, targetDir)
    return true
  }

  return false
}

function createElectronConfig() {
  const distConfig = fs.readFileSync(distConfigPath, 'utf8')
  const runtimeBase = [
    'const fastxElectronConfigBaseUrl = (() => {',
    '  const currentScript = document.currentScript',
    '  if (currentScript instanceof HTMLScriptElement && currentScript.src) {',
    "    return new URL('./', currentScript.src).href",
    '  }',
    "  return new URL('./', window.location.href).href",
    '})()',
  ].join('\n')
  const withRuntimeBase = distConfig.replace(
    /window\.apiConfig\s*=/,
    `${runtimeBase}\n\nwindow.apiConfig =`,
  )
  const config = withRuntimeBase
    .replace(
      /^(\s*)imageryProvider:\s*['"`][^'"`]+['"`]/m,
      (_match, indent) => `${indent}imageryProvider: \`\${fastxElectronConfigBaseUrl}map/tianditu_Image/{z}/{x}/{y}.png\``,
    )
    .replace(
      /^(\s*)terrainProvider:\s*['"`][^'"`]*['"`]/m,
      (_match, indent) => `${indent}terrainProvider: ''`,
    )

  fs.writeFileSync(electronConfigPath, config)
  return config
}

async function runElectronBuilder(args) {
  try {
    await run(builderCmd, args, { env: electronEnv })
  } catch (error) {
    const didRepair = repairNsisCache() || repairWinCodeSignCache()
    if (!didRepair) throw error

    console.warn('[electron-build] repaired electron-builder cache, retrying electron-builder...')
    await run(builderCmd, args, { env: electronEnv })
  }
}

function normalizeElectronArtifactNames() {
  if (!fs.existsSync(electronDistPath)) return

  const version = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version
  const cleanupRules = [
    /^latest.*\.yml$/i,
    /^FastX GIS_Setup_V.+\.exe\.blockmap$/i,
    /^FastX GIS Setup .+\.exe\.blockmap$/i,
    /^FastX GIS_Setup_V[^-]+\.exe$/i,
    /^FastX GIS Setup [^-]+\.exe$/i,
  ]
  const renameRules = [
    [/^FastX GIS Setup .+-ia32\.exe$/i, `FastX GIS_Setup_V${version}-x32.exe`],
    [/^FastX GIS Setup .+-ia32\.exe\.blockmap$/i, `FastX GIS_Setup_V${version}-x32.exe.blockmap`],
    [/^FastX GIS_Setup_V.+-ia32\.exe$/i, `FastX GIS_Setup_V${version}-x32.exe`],
    [/^FastX GIS_Setup_V.+-ia32\.exe\.blockmap$/i, `FastX GIS_Setup_V${version}-x32.exe.blockmap`],
    [/^FastX GIS[-_ ].*amd64\.deb$/i, `FastX GIS_Setup_V${version}-x86_64.deb`],
    [/^FastX GIS[-_ ].*x64\.deb$/i, `FastX GIS_Setup_V${version}-x86_64.deb`],
    [/^FastX GIS[-_ ].*i386\.deb$/i, `FastX GIS_Setup_V${version}-i386.deb`],
    [/^FastX GIS[-_ ].*ia32\.deb$/i, `FastX GIS_Setup_V${version}-i386.deb`],
    [/^FastX GIS[-_ ].*arm64\.deb$/i, `FastX GIS_Setup_V${version}-arm64.deb`],
    [/^FastX GIS[-_ ].*armv7l\.deb$/i, `FastX GIS_Setup_V${version}-arm32.deb`],
    [/^FastX GIS[-_ ].*x86_64\.rpm$/i, `FastX GIS_Setup_V${version}-x86_64.rpm`],
    [/^FastX GIS[-_ ].*x64\.rpm$/i, `FastX GIS_Setup_V${version}-x86_64.rpm`],
    [/^FastX GIS[-_ ].*i686\.rpm$/i, `FastX GIS_Setup_V${version}-x32.rpm`],
    [/^FastX GIS[-_ ].*ia32\.rpm$/i, `FastX GIS_Setup_V${version}-x32.rpm`],
    [/^FastX GIS[-_ ].*aarch64\.rpm$/i, `FastX GIS_Setup_V${version}-arm64.rpm`],
    [/^FastX GIS[-_ ].*arm64\.rpm$/i, `FastX GIS_Setup_V${version}-arm64.rpm`],
  ]

  for (const entry of fs.readdirSync(electronDistPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const sourcePath = path.join(electronDistPath, entry.name)

    if (cleanupRules.some((pattern) => pattern.test(entry.name))) {
      fs.rmSync(sourcePath, { force: true })
      continue
    }

    const rule = renameRules.find(([pattern]) => pattern.test(entry.name))
    if (!rule) continue

    const targetName = rule[1]
    if (entry.name === targetName) continue

    const targetPath = path.join(electronDistPath, targetName)
    fs.rmSync(targetPath, { force: true })
    fs.renameSync(sourcePath, targetPath)
  }
}

const electronEnv = {
  ...process.env,
  FASTX_ELECTRON_BUILD: 'true',
  VITE_FASTX_ELECTRON: 'true',
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  ELECTRON_CACHE: path.join(cacheRoot, 'electron-cache'),
  ELECTRON_BUILDER_CACHE: path.join(cacheRoot, 'builder-cache'),
  TEMP: tempRoot,
  TMP: tempRoot,
  TMPDIR: tempRoot,
}

delete electronEnv.ELECTRON_RUN_AS_NODE

await run(npmCmd, ['run', 'build'], { env: electronEnv })

const webConfig = fs.readFileSync(distConfigPath, 'utf8')
try {
  fs.writeFileSync(distConfigPath, createElectronConfig())

  for (const args of createBuildCommands(buildOptions)) {
    await runElectronBuilder(args)
    normalizeElectronArtifactNames()
  }
} finally {
  fs.writeFileSync(distConfigPath, webConfig)
}
