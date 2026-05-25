const { app, BrowserWindow, dialog, net, protocol, session } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_SCHEME = 'sol';
const APP_HOST = 'game';
const distPath = path.resolve(__dirname, '..', 'dist');
const distIndexPath = path.join(distPath, 'index.html');
const devServerUrl = process.env.ELECTRON_DEV_SERVER_URL || '';

const productionCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
].join('; ');

const developmentCsp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:*",
  "media-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "worker-src 'self' blob:",
].join('; ');

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function resolveDistRequest(requestUrl) {
  const parsedUrl = new URL(requestUrl);
  const pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  const decodedPathname = decodeURIComponent(pathname);
  const requestedPath = path.normalize(path.join(distPath, decodedPathname));
  const relativePath = path.relative(distPath, requestedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return requestedPath;
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const requestedPath = resolveDistRequest(request.url);

    if (!requestedPath) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(requestedPath).toString());
  });
}

function isDevelopmentRequest(requestUrl) {
  return devServerUrl.length > 0 && requestUrl.startsWith(devServerUrl);
}

function registerElectronCsp() {
  session.defaultSession.webRequest.onHeadersReceived(
    {
      urls: [
        `${APP_SCHEME}://*/*`,
        'http://localhost:*/*',
        'http://127.0.0.1:*/*',
      ],
    },
    (details, callback) => {
      const responseHeaders = {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDevelopmentRequest(details.url) ? developmentCsp : productionCsp,
        ],
      };

      callback({ responseHeaders });
    }
  );
}

function showMissingBuildDialog() {
  dialog.showErrorBox(
    'SoL build not found',
    'dist/index.html was not found. Run npm run build first, or use run-desktop.bat from the repository root.'
  );
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#000011',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (!devServerUrl && !fs.existsSync(distIndexPath)) {
    showMissingBuildDialog();
    app.quit();
    return;
  }

  mainWindow.loadURL(devServerUrl || `${APP_SCHEME}://${APP_HOST}/index.html`);
}

app.whenReady().then(() => {
  registerElectronCsp();
  registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
