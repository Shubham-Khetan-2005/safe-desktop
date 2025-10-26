// // preload.cjs - Secure bridge between Electron main and renderer
// const { contextBridge, shell } = require('electron');
// const crypto = require('crypto');

// // Expose safe APIs to renderer via window.desktop
// contextBridge.exposeInMainWorld('desktop', {
//   /**
//    * Health check for server availability
//    */
//   health: async () => {
//     try {
//       const response = await fetch('http://localhost:3000/health');
//       return response.ok;
//     } catch (err) {
//       console.error('Health check failed:', err);
//       return false;
//     }
//   },

//   /**
//    * Generate a secure pairing token (for future server-desktop auth)
//    */
//   pairingToken: () => {
//     try {
//       return crypto.randomBytes(32).toString('hex');
//     } catch {
//       // Fallback for development (NOT SECURE for production)
//       return Math.random().toString(36).substring(2) + Date.now().toString(36);
//     }
//   },

//   /**
//    * Open external URL in user's default browser
//    * Only allows localhost URLs for security
//    */
//   openExternal: (url) => {
//     // Security: whitelist only localhost URLs
//     if (url.startsWith('http://localhost:3000/')) {
//       shell.openExternal(url);
//       return true;
//     }
//     console.error('Blocked opening external URL:', url);
//     return false;
//   },

//   /**
//    * Get platform information
//    */
//   platform: process.platform,

//   /**
//    * Get versions
//    */
//   versions: {
//     node: process.versions.node,
//     chrome: process.versions.chrome,
//     electron: process.versions.electron
//   }
// });

// console.log('✅ Preload script loaded successfully');
// preload.cjs
const { contextBridge, shell, ipcRenderer } = require("electron");


console.log("📝 Preload script loading...");














try {
  contextBridge.exposeInMainWorld("desktop", {
     openExternal: (url) => ipcRenderer.invoke('open-external', url),



    updateContractAddress: (address) => ipcRenderer.send('update-contract-address', address),
    onUpdateSuccess: (callback) => ipcRenderer.on('update-success', (event, success) => callback(success)),






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