// preload.cjs
const { contextBridge, shell, ipcRenderer } = require("electron");

console.log("📝 Preload script loading...");

try {
  contextBridge.exposeInMainWorld("desktop", {
     openExternal: (url) => ipcRenderer.invoke('open-external', url),

    health: async () => {
      try {
        const response = await fetch("http://localhost:3000/health");
        return response.ok;
      } catch (err) {
        return false;
      }
    },

    pairingToken: () => {
      const crypto = require("crypto");
      try {
        return crypto.randomBytes(32).toString("hex");
      } catch {
        return (
          Math.random().toString(36).substring(2) + Date.now().toString(36)
        );
      }
    },

    platform: process.platform,

    versions: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
    },
  });

  console.log("✅ Preload script loaded - window.desktop exposed");
} catch (error) {
  console.error("❌ Preload error:", error);
}
