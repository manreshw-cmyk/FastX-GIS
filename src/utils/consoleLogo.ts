/**
 * 在浏览器控制台输出 FastX GIS Logo
 */
export default function printConsoleLogo() {
  const buildTime = "2026年05月20日 00:00:00";

  const logo = `
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                            FastX GIS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    📦 开源人     : manreshw-cmyk
    📅 开源时间   : ${buildTime}
    🔗 项目地址   : https://github.com/manreshw-cmyk/FastX-GIS.git

    ✨ 开源不易，请珍惜！

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;

  console.log(
    `%c${logo}`,
    "color: #000; font-family: monospace; font-size: 10px; line-height: 1.5",
  );
}
