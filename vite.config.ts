import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type PluginOption } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";
import progress from "vite-plugin-progress";
import { compression } from "vite-plugin-compression2";
import colors from "picocolors";

const OUT_DIR = "FastXDist";
const GITHUB_PAGES_BASE = "/FastX-GIS/";

const CESIUM_BUILD_DIR = path.resolve("node_modules/cesium/Build/Cesium");

/**
 * vite-plugin-cesium 会把文件复制到 outDir + base + cesium（FastXDist/FastX-GIS/cesium），
 * 禁用其 build 复制，改由 copyCesiumToDistRoot 写入 FastXDist/cesium。
 */
function disableCesiumNestedCopy(): Plugin {
  return {
    name: "disable-cesium-nested-copy",
    apply: "build",
    configResolved(config) {
      const plugin = config.plugins.find((p) => p.name === "vite-plugin-cesium");
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
        fs.rmSync(nestedRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
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
    ...(command === "build"
      ? [disableCesiumNestedCopy(), copyCesiumToDistRoot(), ...buildOnlyPlugins()]
      : []),
  ],
  /** build 与 preview 均使用 GitHub Pages 子路径，与产物内资源引用一致 */
  base: command === "build" || isPreview ? GITHUB_PAGES_BASE : "/",
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
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
