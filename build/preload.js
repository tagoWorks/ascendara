const { contextBridge, ipcRenderer } = require('electron');
const { link } = require('original-fs');

contextBridge.exposeInMainWorld('electron', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  killDownload: (game) => ipcRenderer.invoke('stop-download', game),
  killAllDownloads: () => ipcRenderer.invoke('stop-all-downloads'),
  openGameDirectory: (game, isCustom) => ipcRenderer.invoke('open-game-directory', game, isCustom),
  playGame: (game, isCustom) => ipcRenderer.invoke('play-game', game, isCustom),
  addGame: (game, online, dlc, version, executable) => ipcRenderer.invoke('save-custom-game',  game, online, dlc, version, executable),
  getCustomGames: () => ipcRenderer.invoke('get-custom-games'),
  removeCustomGame: (game) => ipcRenderer.invoke('remove-game', game),
  openReqPath: (game) => ipcRenderer.invoke('required-libraries', game),
  deleteGame: (game) => ipcRenderer.invoke('delete-game', game),
  isGameRunning: (game) => ipcRenderer.invoke('is-game-running', game),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  modifyGameExecutable: (game, executable) => ipcRenderer.invoke('modify-game-executable', game, executable),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  retryDownload: (link, game, online, dlc, version) => ipcRenderer.invoke('retry-download', link, game, online, dlc, version),
  saveSettings: (options, directory) => ipcRenderer.invoke('save-settings', options, directory),
  downloadFile: (link, game, online, dlc, version) => ipcRenderer.invoke('download-file', link, game, online, dlc, version),
  retryExtract: (game, online, dlc, version) => ipcRenderer.invoke('retry-extract', game, online, dlc, version),
  getDownloadDirectory: () => ipcRenderer.invoke('get-download-directory'),
  getAPIKey: () => ipcRenderer.invoke('get-api-key'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getBackgrounds: () => ipcRenderer.invoke('get-backgrounds'),
  setBackground: (color, gradient) => ipcRenderer.invoke('set-background', color, gradient),
  getGames: () => ipcRenderer.invoke('get-games')
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