const { contextBridge, ipcRenderer } = require('electron');
const { link } = require('original-fs');

contextBridge.exposeInMainWorld('electron', {
  // Settings and Configuration
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (options, directory) => ipcRenderer.invoke('save-settings', options, directory),
  getAPIKey: () => ipcRenderer.invoke('get-api-key'),
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Game Management
  getGames: () => ipcRenderer.invoke('get-games'),
  getCustomGames: () => ipcRenderer.invoke('get-custom-games'),
  addGame: (game, online, dlc, version, executable) => ipcRenderer.invoke('save-custom-game', game, online, dlc, version, executable),
  removeCustomGame: (game) => ipcRenderer.invoke('remove-game', game),
  deleteGame: (game) => ipcRenderer.invoke('delete-game', game),

  // Game Execution
  playGame: (game, isCustom) => ipcRenderer.invoke('play-game', game, isCustom),
  isGameRunning: (game) => ipcRenderer.invoke('is-game-running', game),

  // File and Directory Management
  openGameDirectory: (game, isCustom) => ipcRenderer.invoke('open-game-directory', game, isCustom),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  getDownloadDirectory: () => ipcRenderer.invoke('get-download-directory'),

  // Download and Installation
  installDependencies: () => ipcRenderer.invoke('install-dependencies'),
  killDownload: (game) => ipcRenderer.invoke('stop-download', game),
  killAllDownloads: () => ipcRenderer.invoke('stop-all-downloads'),
  retryDownload: (link, game, online, dlc, version) => ipcRenderer.invoke('retry-download', link, game, online, dlc, version),
  downloadFile: (link, game, online, dlc, version) => ipcRenderer.invoke('download-file', link, game, online, dlc, version),
  checkRetryExtract: (game) => ipcRenderer.invoke('check-retry-extract', game),
  retryExtract: (game, online, dlc, version) => ipcRenderer.invoke('retry-extract', game, online, dlc, version),

  // Background and UI
  getBackgrounds: () => ipcRenderer.invoke('get-backgrounds'),
  setBackground: (color, gradient) => ipcRenderer.invoke('set-background', color, gradient),

  // Miscellaneous
  isNew: () => ipcRenderer.invoke('is-new'),
  openReqPath: (game) => ipcRenderer.invoke('required-libraries', game),
  modifyGameExecutable: (game, executable) => ipcRenderer.invoke('modify-game-executable', game, executable)
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