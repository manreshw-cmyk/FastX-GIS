const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("fastxDesktop", {
  platform: process.platform,
  isDesktop: true,
});
