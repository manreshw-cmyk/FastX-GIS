import { defineConfig, type Plugin, type PluginOption } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";
import progress from "vite-plugin-progress";
import { compression } from "vite-plugin-compression2";
import colors from "picocolors";

const OUT_DIR = "FastX GIS";

/** 打包完成后输出绿色大字提示 */
function fastxBuildSuccessBanner(): Plugin {
  return {
    name: "fastx-build-success-banner",
    apply: "build",
    closeBundle() {
      // FastX GIS - 细线风格 ASCII 艺术字
      const logo = `
   ███████╗ █████╗ ███████╗████████╗██╗  ██╗     ██████╗ ██╗███████╗
   ██╔════╝██╔══██╗██╔════╝╚══██╔══╝╚██╗██╔╝     ██╔══██╗██║██╔════╝
   █████╗  ███████║███████╗   ██║    ╚███╔╝█████╗██████╔╝██║███████╗
   ██╔══╝  ██╔══██║╚════██║   ██║    ██╔██╗╚════╝██╔══██╗██║╚════██║
   ██║     ██║  ██║███████║   ██║   ██╔╝ ██╗     ██████╔╝██║███████║
   ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝     ╚═════╝ ╚═╝╚══════╝
      `;

      // 固定的开源时间
      const buildTime = `2026年05月20日 00:00:00`;

      console.log(
        colors.green(logo) +
          `\n${colors.green("✓")} ${colors.bold("FastX GIS SDK 构建完成")}\n` +
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
      format: `${colors.cyan(colors.bold("FastX GIS"))} ${colors.yellow("[:bar]")} ${colors.green(":percent")} | ${colors.dim(":current")}/${colors.dim(":total")} ${colors.blue(":eta")}s ${colors.magenta(":rate")}/s`,
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
export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    cesium(),
    ...(command === "build" ? buildOnlyPlugins() : []),
  ],
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
