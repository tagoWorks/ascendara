const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');
require("dotenv").config()

const CURRENT_VERSION = "2.1.0";

axios.get('https://api.ascendara.app/public/json/current')
  .then(response => {
    const latest_version = response.data.version;
    if (latest_version !== CURRENT_VERSION) {
      dialog.showMessageBox({
        message: `There is a major update available that cannot be automatically installed. Please download from the Ascendara website.`,
        buttons: ['Update', 'Cancel'],
      }).then((result) => {
        if (result.response === 0) {
          shell.openExternal('https://ascendara.app/');
          app.quit();
        } else if (result.response === 1) {
          app.quit();
        }
      });
      console.log(`Update available! Current version: ${CURRENT_VERSION}, Latest version: ${latest_version}`);
    } else {
      console.log(`No update available. Current version: ${CURRENT_VERSION}`);
      createWindow(); // Create window if version matches
    }
  })
  .catch(error => {
    console.error(error);
  });

let electronDl;

(async () => {
  electronDl = await import('electron-dl');
})();
const downloadProcesses = new Map();
const runGameProcesses = new Map();
const appDirectory = path.join(path.dirname(app.getPath('exe')));
console.log(appDirectory)
ipcMain.handle('get-api-key', () => {
  return process.env.AUTHORIZATION;
});


// Add stop all button to UI later
ipcMain.handle('stop-all-downloads', async () => {
  console.log('Stopping all downloads');
  for (const [game, downloadProcess] of downloadProcesses) {
    const processName = 'AscendaraDownloader.exe';
    const killProcess = spawn('taskkill', ['/f', '/im', processName]);
    killProcess.on('close', (code) => {
      console.log(`Process ${processName} exited with code ${code}`);
      deleteGameDirectory(game);
    });
  }
  downloadProcesses.clear();
  runGameProcesses.clear();
});

ipcMain.handle('get-version', async () => {
  return CURRENT_VERSION;
});

ipcMain.handle('stop-download', async (event, game) => {
  console.log(`Stopping download: ${game}`);
  try {
    const downloadProcess = downloadProcesses.get(game);
    if (downloadProcess) {
      const processName = 'AscendaraDownloader.exe';
      const killProcess = spawn('taskkill', ['/f', '/im', processName]);
      killProcess.on('close', (code) => {
        console.log(`Process ${processName} exited with code ${code}`);
        deleteGameDirectory(game);
      });
    } else {
      console.log(`Download process for ${game} not found`);
      deleteGameDirectory(game);
    }
  } catch (error) {
    console.error('Error stopping download or deleting directory:', error);
    return false;
  }
});

const deleteGameDirectory = async (game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  const data = fs.readFileSync(filePath, 'utf8');
  const settings = JSON.parse(data);
  if (!settings.downloadDirectory) {
    console.error('Download directory not set');
    return;
  }
  const downloadDirectory = settings.downloadDirectory;
  const gameDirectory = path.join(downloadDirectory, game);
  try {
    await fs.promises.rm(gameDirectory, { recursive: true, force: true });
    console.log('Game directory and files deleted');
  } catch (error) {
    console.error('Error deleting the game directory:', error);
  }
};

// Download the file
ipcMain.handle('download-file', async (event, link, game, online, dlc, version) => {
  console.log(`Downloading file: ${link}, game: ${game}, online: ${online}, dlc: ${dlc}, version: ${version}`);
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  const data = fs.readFileSync(filePath, 'utf8');
  const settings = JSON.parse(data);
  if (!settings.downloadDirectory) {
    console.error('Download directory not set');
    return;
  }
  const gamesDirectory = settings.downloadDirectory;
  const executablePath = path.join(appDirectory, '/resources/AscendaraDownloader.exe');
  const downloadProcess = spawn(executablePath, ["download", link, game, online, dlc, version, gamesDirectory]);
  downloadProcesses.set(game, downloadProcess);
  downloadProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  downloadProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  downloadProcess.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
});



ipcMain.handle('retry-extract', async (event, game, online, dlc, version) => { 
  console.log(`Retrying extract: ${game}`);
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'openDirectory']
  });

  if (result.canceled) {
    return null;
  } else {
    console.log(`Selected paths: ${result.filePaths}`);
    const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const settings = JSON.parse(data);
      if (!settings.downloadDirectory) {
        console.error('Download directory not set');
        return;
      } 
      const downloadDirectory = settings.downloadDirectory;
      const gameDirectory = path.join(downloadDirectory, game);
      const selectedPaths = result.filePaths;
      
      selectedPaths.forEach((selectedPath) => {
        const itemName = path.basename(selectedPath);
        const executablePath = path.join(appDirectory, '/resources/AscendaraDownloader.exe');
        console.log(`Calling ${executablePath} with arguments: ${selectedPath}, ${game}, ${online}, ${dlc}, ${version}, ${gameDirectory}, ${itemName}`);
        const downloadProcess = spawn(executablePath, [
          "retryfolder", 
          game, 
          online, 
          dlc, 
          version, 
          gameDirectory, 
          itemName
        ]);

        downloadProcess.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });

        downloadProcess.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
        });

        downloadProcess.on('close', (code) => {
          console.log(`child process exited with code ${code}`);
        });
        
        // Store the download process
        downloadProcesses.set(game, downloadProcess);
      });

      return; // Return after setting the downloadProcess
    } catch (error) {
      console.error('Error reading the settings file:', error);
      return;
    }
  }
});

// Retry the game download
ipcMain.handle('retry-download', async (event, link, game, online, dlc, version) => {



})



// Read the settings JSON file and send it to the renderer process
ipcMain.handle('get-settings', () => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading the settings file:', error);
    console.log('Creating settings...')
    fs.writeFileSync(filePath, '{}');
    const data = fs.readFileSync(filePath, 'utf8');
    return {
      enableNotifications: false,
      splitTunneling: false,
      autoUpdate: false,
      downloadDirectory: '',
    };
  }
});

// Save the settings JSON file
ipcMain.handle('save-settings', (event, options, directory) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}');
  }
  const data = JSON.stringify({ ...options, downloadDirectory: directory });
  fs.writeFileSync(filePath, data);
});


ipcMain.handle('get-games', async () => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return [];
    }
    const downloadDirectory = settings.downloadDirectory;
    // Get all subdirectories in the download directory
    const subdirectories = await fs.promises.readdir(downloadDirectory, { withFileTypes: true });
    const gameDirectories = subdirectories.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

    // Read {game}.ascendara.json from each subdirectory
    const games = await Promise.all(
      gameDirectories.map(async (dir) => {
        const gameInfoPath = path.join(downloadDirectory, dir, `${dir}.ascendara.json`);
        try {
          const gameInfoData = await fs.promises.readFile(gameInfoPath, 'utf8');
          return JSON.parse(gameInfoData);
        } catch (error) {
          console.error(`Error reading game info file for ${dir}:`, error);
          return null;
        }
      })
    );
    return games.filter(game => game !== null);
  } catch (error) {
    console.error('Error reading the settings file:', error);
    return [];
  }
});

ipcMain.handle('open-directory-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});

ipcMain.handle('open-file-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile',],
    filters:[
      { name: 'Executable Files', extensions: ['exe'] }
    ]
  });

  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});


ipcMain.handle('get-download-directory', () => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    return settings.downloadDirectory;
  } catch (error) {
    console.error('Error reading the settings file:', error);
    return '';
  }
});

ipcMain.handle('open-game-directory', (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return;
    } 
    const downloadDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(downloadDirectory, game);
    shell.openPath(gameDirectory);
  } catch (error) {  
    console.error('Error reading the settings file:', error);
  }
});

ipcMain.handle('modify-game-executable', (event, game, executable) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) { 
      console.error('Download directory not set');
      return;
    }
    const downloadDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(downloadDirectory, game);
    const gameInfoPath = path.join(gameDirectory, `${game}.ascendara.json`);
    const gameInfoData = fs.readFileSync(gameInfoPath, 'utf8');
    const gameInfo = JSON.parse(gameInfoData);
    gameInfo.executable = executable;
    fs.writeFileSync(gameInfoPath, JSON.stringify(gameInfo, null, 2));
  } catch (error) {
    console.error('Error reading the settings file:', error);
  }});


ipcMain.handle('play-game', (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {  
      console.error('Download directory not set');
      return;
    }
    const downloadDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(downloadDirectory, game);
    const gameInfoPath = path.join(gameDirectory, `${game}.ascendara.json`);
    const gameInfoData = fs.readFileSync(gameInfoPath, 'utf8');
    const gameInfo = JSON.parse(gameInfoData);
    const executable = gameInfo.executable;
    const executablePath = path.join(appDirectory, '/resources/AscendaraGameHandler.exe');
    const runGame = spawn(executablePath, [executable]);
    runGameProcesses.set(game, runGame);

  runGame.on('close', (code) => {
    console.log(`Game process for ${game} exited with code ${code}`);
    runGameProcesses.delete(game);
    const gameInfoPath = path.join(gameDirectory, `${game}.ascendara.json`);
    try {
      const gameInfoData = fs.readFileSync(gameInfoPath, 'utf8');
      const gameInfo = JSON.parse(gameInfoData);
      if (gameInfo.runError) {
        setError(gameInfo.runError);
      }
    } catch (error) {
      console.error('Error reading the game info file:', error);
    }
  });

  } catch (error) {
    console.error('Error reading the settings file:', error);
  }
});

ipcMain.handle('is-game-running', async (event, game) => {
  const runGame = runGameProcesses.get(game);
  return runGame ? true : false;
});

ipcMain.handle('required-libraries', async (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {  
      console.error('Download directory not set');
      return;
    }
    const downloadDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(downloadDirectory, game);
    const gameLibsPath = path.join(gameDirectory, `_CommonRedist`);
    shell.openPath(gameLibsPath);
    } 
    catch (error) {
    console.error('Error reading the settings file:', error);
  }
});

ipcMain.handle('delete-game', async (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return;
    }
    const downloadDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(downloadDirectory, game);
    fs.rmSync(gameDirectory, { recursive: true, force: true });
  } catch (error) {
    console.error('Error reading the settings file:', error);
  } 
});

ipcMain.handle('download-finished', async (event, game) => {
    const meiFolders = await fs.readdir(gameDirectory);
    for (const folder of meiFolders) {
      if (folder.startsWith('_MEI')) {
        const meiFolderPath = path.join(gameDirectory, folder);
        await fs.remove(meiFolderPath);
      }
    }});

function createWindow() {
  const mainWindow = new BrowserWindow({
    title: 'Ascendara',
    icon: path.join(__dirname, 'icon.ico'),
    width: 1600,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
    }
  });
  mainWindow.loadURL('http://localhost:5173/')
  //mainWindow.loadURL('file://' + path.join(__dirname, 'index.html'));
  mainWindow.setMinimumSize(1600, 800);
}

// app.on('ready', createWindow); # Waits for update check now

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});