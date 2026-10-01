const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

let mainWindow = null;
let daemonProcess = null;

// Release macOS PTP lock if running
function releaseApplePTPLock() {
  if (process.platform === 'darwin') {
    try {
      execSync('killall PTPCamera', { stdio: 'ignore' });
      console.log('[Electron] Released macOS PTPCamera process');
    } catch {
      // Ignored if PTPCamera wasn't running
    }
  }
}

// Check if daemon is already active on port 8000
function checkDaemonRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8000/', { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start companion hardware daemon
async function startHardwareDaemon() {
  releaseApplePTPLock();
  const isRunning = await checkDaemonRunning();
  if (isRunning) {
    console.log('[Electron] Hardware daemon already running on port 8000');
    return;
  }

  const daemonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'hardware-daemon')
    : path.join(__dirname, '../hardware-daemon');

  const appScript = path.join(daemonDir, 'app.py');

  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';

  try {
    daemonProcess = spawn(pythonBin, [appScript], {
      cwd: daemonDir,
      stdio: 'pipe',
      shell: process.platform === 'win32',
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    daemonProcess.stdout?.on('data', (data) => {
      console.log(`[Daemon STDOUT]: ${data}`);
    });

    daemonProcess.stderr?.on('data', (data) => {
      console.error(`[Daemon STDERR]: ${data}`);
    });

    daemonProcess.on('error', (err) => {
      console.warn('[Electron] Could not launch hardware daemon:', err.message);
    });
  } catch (err) {
    console.warn('[Electron] Failed to start daemon process:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'QuickPic Photobooth',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow local stream and cross-origin hardware api
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../out/index.html')}`;

  mainWindow.loadURL(startUrl).catch(() => {
    // If dev server takes a second, retry
    setTimeout(() => {
      mainWindow?.loadURL(startUrl);
    }, 2000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  await startHardwareDaemon();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (daemonProcess) {
    daemonProcess.kill('SIGTERM');
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('kill-ptp-camera', () => {
  releaseApplePTPLock();
  return true;
});
