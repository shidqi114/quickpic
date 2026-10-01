const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let daemonProcess = null;

// Catch unexpected exceptions to prevent crash/force-close
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled Rejection:', reason);
});

// Config file management
function getConfigPath() {
  return path.join(app.getPath('userData'), 'quickpic-config.json');
}

function getSavedAppUrl() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.appUrl && typeof data.appUrl === 'string') {
        return data.appUrl.trim();
      }
    }
  } catch (e) {
    console.error('[Electron] Error reading config:', e);
  }
  return null;
}

function saveAppUrl(url) {
  try {
    const configPath = getConfigPath();
    let trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = 'https://' + trimmed;
    }
    fs.writeFileSync(configPath, JSON.stringify({ appUrl: trimmed }, null, 2), 'utf8');
    return trimmed;
  } catch (e) {
    console.error('[Electron] Error saving config:', e);
    return null;
  }
}

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

// Check if a local HTTP endpoint is running
function checkUrlRunning(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? require('https') : require('http');
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

// Start companion hardware daemon (non-blocking, crash-guarded)
async function startHardwareDaemon() {
  try {
    releaseApplePTPLock();
    const isRunning = await checkUrlRunning('http://127.0.0.1:8000/', 1000);
    if (isRunning) {
      console.log('[Electron] Hardware daemon already running on port 8000');
      return;
    }

    const daemonDir = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'hardware-daemon')
      : path.join(__dirname, '../hardware-daemon');

    const appScript = path.join(daemonDir, 'app.py');
    if (!fs.existsSync(appScript)) {
      console.warn('[Electron] Hardware daemon script not found at:', appScript);
      return;
    }

    const pythonBin = process.platform === 'win32' ? 'python' : 'python3';

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
      // Benign fallback if Python is not installed on client machine
      console.warn('[Electron] Python companion not available on this machine (running in standard web mode):', err.message);
    });
  } catch (err) {
    console.warn('[Electron] Hardware daemon initialization skipped:', err.message);
  }
}

// Render connection setup page if no URL is set or site cannot be reached
function renderSetupPage(errorMessage = null) {
  const savedUrl = getSavedAppUrl() || 'https://quickpic-olive.vercel.app';
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>QuickPic Photobooth Setup</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: #09090b;
          color: #f4f4f5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .card {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 20px;
          padding: 40px;
          max-width: 520px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
          text-align: center;
        }
        .logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          border-radius: 16px;
          margin-bottom: 24px;
          box-shadow: 0 10px 25px -5px rgba(236,72,153,0.5);
        }
        .logo svg {
          width: 32px;
          height: 32px;
          color: white;
        }
        h1 {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
        }
        p {
          color: #a1a1aa;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .input-group {
          margin-bottom: 20px;
          text-align: left;
        }
        label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #d4d4d8;
          margin-bottom: 8px;
        }
        input {
          width: 100%;
          padding: 14px 16px;
          background: #09090b;
          border: 1px solid #3f3f46;
          border-radius: 12px;
          color: #fafafa;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus {
          border-color: #ec4899;
        }
        .error {
          background: rgba(244,63,94,0.1);
          border: 1px solid rgba(244,63,94,0.3);
          color: #fb7185;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          margin-bottom: 18px;
          text-align: left;
        }
        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #ec4899, #db2777);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
        }
        button:hover { opacity: 0.95; }
        button:active { transform: scale(0.99); }
        .hint {
          font-size: 12px;
          color: #71717a;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h1>QuickPic Photobooth</h1>
        <p>Connect this desktop kiosk to your QuickPic production site to start capturing photos.</p>
        
        ${errorMessage ? `<div class="error">${errorMessage}</div>` : ''}

        <div class="input-group">
          <label>QuickPic Vercel / Web URL</label>
          <input id="urlInput" type="text" placeholder="https://quickpic-olive.vercel.app" value="${savedUrl}" />
        </div>

        <button id="connectBtn" onclick="handleConnect()">Launch Photobooth</button>

        <p class="hint">Canon DSLR companion daemon runs locally on port 8000 when Python is installed.</p>
      </div>

      <script>
        async function handleConnect() {
          const input = document.getElementById('urlInput');
          const btn = document.getElementById('connectBtn');
          const rawUrl = input.value.trim();
          if (!rawUrl) {
            alert('Please enter your QuickPic Vercel or website URL.');
            return;
          }
          btn.innerText = 'Connecting...';
          btn.disabled = true;
          if (window.electronAPI && window.electronAPI.saveAppUrl) {
            await window.electronAPI.saveAppUrl(rawUrl);
          }
        }
        document.getElementById('urlInput').addEventListener('keydown', (e) => {
          if (e.key === 'Enter') handleConnect();
        });
      </script>
    </body>
    </html>
  `;
}

async function loadPhotobooth() {
  if (!mainWindow) return;

  // 1. Check if local development server is running
  const isLocalDevRunning = await checkUrlRunning('http://localhost:3000');
  if (isLocalDevRunning) {
    console.log('[Electron] Loading local Next.js dev server on http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
    return;
  }

  // 2. Default to production Vercel URL
  const DEFAULT_PRODUCTION_URL = 'https://quickpic-olive.vercel.app';
  const targetUrl = process.env.APP_URL || getSavedAppUrl() || DEFAULT_PRODUCTION_URL;

  console.log(`[Electron] Loading photobooth at ${targetUrl}`);
  mainWindow.loadURL(targetUrl).catch((err) => {
    console.warn(`[Electron] Failed to load ${targetUrl}:`, err);
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
      renderSetupPage(`Could not connect to <b>${targetUrl}</b>. Please check your internet connection or update the URL.`)
    )}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'QuickPic Photobooth',
    backgroundColor: '#09090b',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow cross-origin communication with localhost:8000 daemon
    }
  });

  loadPhotobooth();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupApplicationMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: 'QuickPic',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Change Photobooth URL...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderSetupPage())}`);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Change Photobooth URL...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderSetupPage())}`);
            }
          }
        },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
  setupApplicationMenu();
  createWindow(); // Create window IMMEDIATELY to prevent Windows closing on launch
  startHardwareDaemon().catch((err) => {
    console.warn('[Electron] Background daemon launch error:', err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (daemonProcess) {
    try {
      daemonProcess.kill('SIGTERM');
    } catch {}
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-url', () => getSavedAppUrl());
ipcMain.handle('save-app-url', (event, url) => {
  const saved = saveAppUrl(url);
  if (saved && mainWindow) {
    loadPhotobooth();
  }
  return saved;
});
ipcMain.handle('reset-app-url', () => {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  } catch {}
  if (mainWindow) {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderSetupPage())}`);
  }
});
ipcMain.handle('kill-ptp-camera', () => {
  releaseApplePTPLock();
  return true;
});
