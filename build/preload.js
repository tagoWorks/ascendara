//=============================================================================
// Ascendara Preload Script
//=============================================================================
// This script acts as a secure bridge between Electron's main and renderer processes.
// It exposes specific main process functionality to the renderer process through
// contextBridge, ensuring safe IPC (Inter-Process Communication).
//
// Note: This file is crucial for security as it controls what main process
// functionality is available to the frontend.
//
// Learn more about Developing Ascendara at https://ascendara.app/docs/developer/overview










const { contextBridge, ipcRenderer } = require('electron');
const https = require('https');

// Create a map to store callbacks
const callbacks = new Map();

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
    off: (channel, func) => ipcRenderer.off(channel, func),
    removeListener: (channel, func) => ipcRenderer.removeListener(channel, func),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    saveGameImage: (gameName, imageBase64) => ipcRenderer.invoke('save-game-image', gameName, imageBase64),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
    downloadGameCover: (imgID, gameName) => ipcRenderer.invoke('download-game-cover', { imgID, gameName }),
  },

  // Settings and Configuration
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (options, directory) => ipcRenderer.invoke('save-settings', options, directory),
  getAnalyticsKey: () => ipcRenderer.invoke('get-analytics-key'),
  getImageKey: () => ipcRenderer.invoke('get-image-key'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  hasLaunched: () => ipcRenderer.invoke('has-launched'),
  imageSecret: () => ipcRenderer.invoke('get-image-key'),

  // Game Management
  getGames: () => ipcRenderer.invoke('get-games'),
  getCustomGames: () => ipcRenderer.invoke('get-custom-games'),
  addGame: (game, online, dlc, version, executable, imgID) => ipcRenderer.invoke('save-custom-game', game, online, dlc, version, executable, imgID),
  removeCustomGame: (game) => ipcRenderer.invoke('remove-game', game),
  deleteGame: (game) => ipcRenderer.invoke('delete-game', game),
  deleteGameDirectory: (game) => ipcRenderer.invoke('delete-game-directory', game),
  getInstalledGames: () => ipcRenderer.invoke('get-installed-games'),

  // Download Status
  onDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
  onDownloadComplete: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('download-complete', listener);
    return () => ipcRenderer.removeListener('download-complete', listener);
  },

  // Game Execution
  playGame: (game, isCustom) => ipcRenderer.invoke('play-game', game, isCustom),
  isGameRunning: (game) => ipcRenderer.invoke('is-game-running', game),

  // File and Directory Management
  openGameDirectory: (game, isCustom) => ipcRenderer.invoke('open-game-directory', game, isCustom),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  canCreateFiles: (directory) => ipcRenderer.invoke('can-create-files', directory),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  getDownloadDirectory: () => ipcRenderer.invoke('get-download-directory'),
  getDriveSpace: (directory) => ipcRenderer.invoke('get-drive-space', directory),

  // Download and Installation
  installDependencies: () => ipcRenderer.invoke('install-dependencies'),
  stopDownload: (game) => ipcRenderer.invoke('stop-download', game),
  retryDownload: (link, game, online, dlc, version) => ipcRenderer.invoke('retry-download', link, game, online, dlc, version),
  downloadFile: (link, game, online, dlc, version, imgID, size) => ipcRenderer.invoke('download-file', link, game, online, dlc, version, imgID, size),
  checkRetryExtract: (game) => ipcRenderer.invoke('check-retry-extract', game),
  retryExtract: (game, online, dlc, version) => ipcRenderer.invoke('retry-extract', game, online, dlc, version),

  // Background and UI
  getBackgrounds: () => ipcRenderer.invoke('get-backgrounds'),
  setBackground: (color, gradient) => ipcRenderer.invoke('set-background', color, gradient),
  getGameImage: (game) => ipcRenderer.invoke('get-game-image', game),

  // Miscellaneous
  createTimestamp: () => ipcRenderer.invoke('create-timestamp'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  updateLaunchCount: () => ipcRenderer.invoke('update-launch-count'),
  getLaunchCount: () => ipcRenderer.invoke('get-launch-count'),
  checkGameDependencies: () => ipcRenderer.invoke('check-game-dependencies'),
  isDownloaderRunning: () => ipcRenderer.invoke('is-downloader-running'),
  deleteInstaller: () => ipcRenderer.invoke('delete-installer'),
  updateAscendara: () => ipcRenderer.invoke('update-ascendara'),
  uninstallAscendara: () => ipcRenderer.invoke('uninstall-ascendara'),
  openURL: (url) => ipcRenderer.invoke('open-url', url),
  getAPIKey: () => ipcRenderer.invoke('get-api-key'),
  openReqPath: (game) => ipcRenderer.invoke('required-libraries', game),
  modifyGameExecutable: (game, executable) => ipcRenderer.invoke('modify-game-executable', game, executable),
  getAssetPath: (filename) => ipcRenderer.invoke('get-asset-path', filename),
  getAnalyticsKey: () => ipcRenderer.invoke('get-analytics-key'),
  isDev: () => ipcRenderer.invoke('is-dev'),
  checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),

  // Welcome flow functions
  isNew: () => ipcRenderer.invoke('is-new'),
  isV7: () => ipcRenderer.invoke('is-v7'),
  hasLaunched: () => ipcRenderer.invoke('has-launched'),

  // Callback handling
  onWelcomeComplete: (callback) => {
    ipcRenderer.on('welcome-complete', () => callback());
  },
  triggerWelcomeComplete: () => {
    ipcRenderer.invoke('welcome-complete');
  },
  checkV7Welcome: () => ipcRenderer.invoke('check-v7-welcome'),
  setV7: () => ipcRenderer.invoke('set-v7'),
  setTimestampValue: (key, value) => ipcRenderer.invoke('set-timestamp-value', key, value),
  getTimestampValue: (key) => ipcRenderer.invoke('get-timestamp-value', key),
  getAssetPath: (filename) => ipcRenderer.invoke('get-asset-path', filename),

  // Window management
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-changed', (_, maximized) => callback(maximized));
  },
  clearCache: () => ipcRenderer.invoke('clear-cache'),

  request: (url, options) => {
    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: options.method,
        headers: options.headers,
        timeout: options.timeout
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.end();
    });
  },
  
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', callback);
  },
  
  onUpdateReady: (callback) => {
    ipcRenderer.on('update-ready', callback);
  },
  
  removeUpdateAvailableListener: (callback) => {
    ipcRenderer.removeListener('update-available', callback);
  },
  
  removeUpdateReadyListener: (callback) => {
    ipcRenderer.removeListener('update-ready', callback);
  },
  
  updateAscendara: () => ipcRenderer.invoke('update-ascendara'),
  isUpdateDownloaded: () => ipcRenderer.invoke('is-update-downloaded'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  platform: ipcRenderer.invoke('get-platform'),
  getPlatform: () => process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-version'),
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings-updated', callback);
    return () => {
      ipcRenderer.removeListener('settings-updated', callback);
    }
  },
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };
  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type]);
  }
});