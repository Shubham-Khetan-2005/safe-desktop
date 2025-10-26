import { app, BrowserWindow,ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import url from 'url'

const isDev = process.env.NODE_ENV !== 'production'

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    // renderer dev server
    const devUrl = 'http://localhost:5173'
    win.loadURL(devUrl)
    win.webContents.openDevTools()
  } else {
    win.loadURL(
      url.pathToFileURL(path.join(process.cwd(), 'dist/renderer/index.html')).toString()
    )
  }
}

ipcMain.handle('save-safe-address', async (event, address) => {
  try {
    const filePath = path.join(process.cwd(), 'safeAddress.txt');
    fs.writeFileSync(filePath, address, 'utf8');
    console.log('✅ Safe address saved to:', filePath);
    return { success: true, filePath };
  } catch (err) {
    console.error('❌ Error writing safe address file:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-contract-address', async (event, address) => {
  try {
    const configPath = path.join(process.cwd(), 'indexer', 'config.yaml');
    let config = fs.readFileSync(configPath, 'utf8');

    // Replace any existing address line in the config
    config = config.replace(
      /address:\s*\[([^\]]*)\]/,
      `address:\n    - ${address}`
    );

    fs.writeFileSync(configPath, config, 'utf8');
    console.log('✅ Contract address updated in config.yaml:', address);
    return { success: true };
  }
  catch (err) {
    console.error('❌ Error updating config.yaml:', err);
    return { success: false, error: err.message };
  }
});
app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
