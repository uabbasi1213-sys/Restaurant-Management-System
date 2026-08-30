const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

function startServer() {
  return new Promise((resolve) => {
    const userDataPath = app.getPath('userData');
    const resourcesPath = process.resourcesPath;

    // Ensure writable directories exist
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
    const uploadsDir = path.join(userDataPath, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    let serverScript, serverCwd, clientDistPath;

    if (isDev) {
      serverScript   = path.join(__dirname, '..', 'server', 'server.js');
      serverCwd      = path.join(__dirname, '..', 'server');
      clientDistPath = path.join(__dirname, '..', 'client', 'dist');
    } else {
      serverScript   = path.join(resourcesPath, 'server.bundle.mjs');
      serverCwd      = resourcesPath;
      clientDistPath = path.join(resourcesPath, 'client-dist');
    }

    const env = {
      ...process.env,
      PORT: '5000',
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_APP: 'true',
      USER_DATA_PATH: userDataPath,
      CLIENT_DIST_PATH: clientDistPath,
      JWT_SECRET: process.env.JWT_SECRET || 'restaurant_mgmt_secret_key_2024',
    };

    console.log('[Main] Server:', serverScript);
    console.log('[Main] CWD:', serverCwd);
    console.log('[Main] clientDist:', clientDistPath);
    console.log('[Main] userData:', userDataPath);

    const nodeExe = process.execPath;
    serverProcess = spawn(nodeExe, [serverScript], {
      env,
      cwd: serverCwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[Server]', msg.trim());
      if (msg.includes('Server running')) resolve();
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString().trim());
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      resolve();
    });

    serverProcess.on('exit', (code) => {
      console.log('[Server] Exited with code:', code);
    });

    // Wait up to 15 seconds for server to start
    setTimeout(resolve, 15000);
  });
}

function waitForServer(retries = 0) {
  return new Promise((resolve) => {
    const tryConnect = (attempt) => {
      http.get('http://localhost:5000/api/health', (res) => {
        console.log('[Main] Server ready! Status:', res.statusCode);
        resolve();
      }).on('error', () => {
        if (attempt < 60) {
          setTimeout(() => tryConnect(attempt + 1), 500);
        } else {
          console.log('[Main] Server timeout — loading anyway');
          resolve();
        }
      });
    };
    tryConnect(retries);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Restaurant Management System',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false, // Don't show until ready
  });

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools(); // DevTools in dev mode only
  } else {
    // Production: wait for server then load
    waitForServer().then(() => {
      mainWindow.loadURL('http://localhost:5000');
      // DevTools CLOSED in production — no debug window for clients
    });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  if (!isDev) {
    await startServer();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGKILL');
    }, 3000);
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill('SIGTERM');
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
