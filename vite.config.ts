import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type PluginOption } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";
import progress from "vite-plugin-progress";
import { compression } from "vite-plugin-compression2";
import importvueDevTools from "vite-plugin-vue-devtools";
import colors from "picocolors";

const OUT_DIR = "FastXDist";
const GITHUB_PAGES_BASE = "/FastX-GIS/";
const IS_ELECTRON_BUILD =
  process.env.FASTX_ELECTRON_BUILD === "true" ||
  process.env.VITE_FASTX_ELECTRON === "true";
const VENDOR_DIR = path.resolve("src/FastX/build/vendor");
const CESIUM_BUILD_DIR = path.resolve("node_modules/cesium/Build/Cesium");

/** 开发态托管 vendor；生产构建复制到 FastXDist/vendor */
function fastxVendorPlugin(): Plugin {
  return {
    name: "fastx-vendor-static",
    configureServer(server) {
      server.middlewares.use("/vendor", (req, res, next) => {
        const rel = (req.url ?? "/").split("?")[0]!.replace(/^\//, "");
        const file = path.join(VENDOR_DIR, rel);
        if (
          !file.startsWith(VENDOR_DIR) ||
          !fs.existsSync(file) ||
          fs.statSync(file).isDirectory()
        ) {
          next();
          return;
        }
        const ext = path.extname(file).toLowerCase();
        const type =
          ext === ".css"
            ? "text/css"
            : ext === ".js"
              ? "application/javascript"
              : "application/octet-stream";
        res.setHeader("Content-Type", type);
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const dest = path.resolve(OUT_DIR, "vendor");
      if (!fs.existsSync(VENDOR_DIR)) return;
      if (fs.existsSync(dest))
        fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(VENDOR_DIR, dest, { recursive: true });
    },
  };
}

/**
 * vite-plugin-cesium 会把文件复制到 outDir + base + cesium（FastXDist/FastX-GIS/cesium），
 * 禁用其 build 复制，改由 copyCesiumToDistRoot 写入 FastXDist/cesium。
 */
function disableCesiumNestedCopy(): Plugin {
  return {
    name: "disable-cesium-nested-copy",
    apply: "build",
    configResolved(config) {
      const plugin = config.plugins.find(
        (p) => p.name === "vite-plugin-cesium",
      );
      if (plugin) {
        plugin.closeBundle = async () => {};
      }
    },
  };
}

/** 构建时直接将 Cesium 静态资源复制到 FastXDist/cesium */
function copyCesiumToDistRoot(): Plugin {
  return {
    name: "copy-cesium-to-dist-root",
    apply: "build",
    closeBundle() {
      const targetCesium = path.resolve(OUT_DIR, "cesium");
      const nestedRoot = path.resolve(OUT_DIR, "FastX-GIS");
      if (!fs.existsSync(CESIUM_BUILD_DIR)) return;

      // 清理历史构建遗留的嵌套目录
      if (fs.existsSync(nestedRoot)) {
        fs.rmSync(nestedRoot, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      }

      if (fs.existsSync(targetCesium)) {
        fs.rmSync(targetCesium, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      }
      fs.cpSync(CESIUM_BUILD_DIR, targetCesium, { recursive: true });
    },
  };
}

/**
 * vite-plugin-cesium 生产模式把 `cesium` 映射为全局 Cesium，但部分异步 chunk 会残留
 * `import "cesium";`，浏览器原生 ESM 无法解析该裸 specifier。这里在输出前移除纯副作用导入。
 */
function stripCesiumBareSideEffectImports(): Plugin {
  const bareCesiumImportRE = /(?:^|;)\s*import\s*["']cesium["'];?/g;
  return {
    name: "strip-cesium-bare-side-effect-imports",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== "chunk") continue;
        item.code = item.code.replace(bareCesiumImportRE, ";");
      }
    },
  };
}

/** 打包完成后输出绿色大字提示 */
function fastxBuildSuccessBanner(): Plugin {
  return {
    name: "fastx-build-success-banner",
    apply: "build",
    closeBundle() {
      // FastXDist - 细线风格 ASCII 艺术字
      const logo = `
  ███████╗ █████╗ ███████╗████████╗██╗  ██╗      ██████╗ ██╗███████╗████████╗
  ██╔════╝██╔══██╗██╔════╝╚══██╔══╝╚██╗██╔╝      ██╔══██╗██║██╔════╝╚══██╔══╝
  █████╗  ███████║███████╗   ██║    ╚███╔╝ █████╗██║  ██║██║███████╗   ██║
  ██╔══╝  ██╔══██║╚════██║   ██║    ██╔██╗ ╚════╝██║  ██║██║╚════██║   ██║
  ██║     ██║  ██║███████║   ██║   ██╔╝ ██╗      ██████╔╝██║███████║   ██║
  ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝      ╚═════╝ ╚═╝╚══════╝   ╚═╝
      `;

      // 固定的开源时间
      const buildTime = `2026年05月20日 00:00:00`;

      console.log(
        colors.green(logo) +
          `\n${colors.green("✓")} ${colors.bold("FastXDist 构建完成")}\n` +
          `\n  ${colors.dim("📁 输出目录:")} ${colors.cyan(OUT_DIR)}` +
          `\n  ${colors.dim("📦 打包格式:")} ${colors.yellow("ESM + UMD + CJS")}` +
          `\n` +
          `\n  ${colors.dim("开源人:")} ${colors.white("manreshw-cmyk")}` +
          `\n  ${colors.dim("开源时间:")} ${colors.white(buildTime)}` +
          `\n  ${colors.dim("项目地址:")} ${colors.underline("https://github.com/manreshw-cmyk/FastX-GIS.git")}` +
          `\n` +
          `\n  ${colors.green("✨ 开源不易，请珍惜!")}\n`,
      );
    },
  };
}

/** 仅 `vite build` / `npm run build` 时启用：进度条 + 压缩 + 成功横幅 */
function buildOnlyPlugins(): PluginOption[] {
  return [
    progress({
      width: 52,
      complete: colors.green("█"),
      incomplete: colors.gray("░"),
      clear: true,
      format: `${colors.cyan(colors.bold("FastXDist"))} ${colors.yellow("[:bar]")} ${colors.green(":percent")} | ${colors.dim(":current")}/${colors.dim(":total")} ${colors.blue(":eta")}s ${colors.magenta(":rate")}/s`,
      callback() {
        // 进度条结束后留一行，最终成功信息由 closeBundle 横幅输出
        console.log(colors.dim("  正在压缩静态资源…"));
      },
    }),
    compression({
      include:
        /\.(html|xml|css|json|js|mjs|svg|wasm|txt|ico|woff2?|ttf|eot|png|jpe?g|gif|webp)$/i,
      threshold: 1024,
      deleteOriginalAssets: false,
      algorithms: ["gzip", "brotliCompress"],
    }),
    fastxBuildSuccessBanner(),
  ];
}

// https://vitejs.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    vue(),
    cesium(),
    importvueDevTools(),
    fastxVendorPlugin(),
    ...(command === "build"
      ? [
          disableCesiumNestedCopy(),
          stripCesiumBareSideEffectImports(),
          copyCesiumToDistRoot(),
          ...buildOnlyPlugins(),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  /** 普通生产包使用 GitHub Pages 子路径；Electron 本地 file:// 包使用相对路径。 */
  base: IS_ELECTRON_BUILD
    ? "./"
    : command === "build" || isPreview
      ? GITHUB_PAGES_BASE
      : "/",
  server: {
    port: 5678,
    strictPort: true,
  },
  preview: {
    port: 5678,
    strictPort: true,
  },
  build: {
    outDir: OUT_DIR,
    minify: "esbuild",
    cssMinify: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
}));
