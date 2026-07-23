const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

function getAppPath() {
  if (isDev) {
    return path.join(__dirname, '..');
  }
  return path.join(process.resourcesPath, 'app');
}

function startServer() {
  return new Promise((resolve) => {
    const appPath = getAppPath();
    const serverScript = path.join(appPath, 'server', 'server.js');

    // Use Electron's bundled Node to run the server
    const nodeExe = process.execPath;
    const args = isDev ? [serverScript] : ['--experimental-modules', serverScript];

    const env = {
      ...process.env,
      PORT: '5000',
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_APP: 'true',
      USER_DATA_PATH: app.getPath('userData')
    };

    serverProcess = spawn(nodeExe, [serverScript], {
      env,
      cwd: path.join(appPath, 'server'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log('[Server]', msg);
      if (msg.includes('Server running')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      resolve(); // Don't block app startup
    });

    // Fallback: resolve after 5 seconds if no message received
    setTimeout(resolve, 5000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Restaurant Management System',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Wait for server to be ready, then load
    const tryLoad = (retries = 0) => {
      const http = require('http');
      http.get('http://localhost:5000/api/health', (res) => {
        mainWindow.loadURL('http://localhost:5000');
      }).on('error', () => {
        if (retries < 20) {
          setTimeout(() => tryLoad(retries + 1), 500);
        } else {
          mainWindow.loadURL('http://localhost:5000');
        }
      });
    };
    tryLoad();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    await startServer();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
