import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import url from 'url'

const isDev = process.env.NODE_ENV !== 'production'

ipcMain.handle('open-external', async (event, urlToOpen) => {
  try {
    await shell.openExternal(urlToOpen);
    return true;
  } catch (err) {
    console.error('Failed to open URL:', err);
    return false;
  }
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: true
    }
  })

  if (isDev) {
    const devUrl = 'http://localhost:5173'
    win.loadURL(devUrl)
    win.webContents.openDevTools()
  } else {
    win.loadURL(
      url.pathToFileURL(path.join(process.cwd(), 'dist/renderer/index.html')).toString()
    )
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
