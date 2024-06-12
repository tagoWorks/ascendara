const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs-extra');
const { spawn } = require('child_process');
require("dotenv").config()

const CURRENT_VERSION = "3.0.0";

axios.get('https://api.ascendara.app/')
  .then(response => {
    const latest_version = response.data.appVer;
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
    dialog.showMessageBox({
      message: `Ascendara couldn't automatically check for an update.`,
      buttons: ['View Status Page']
    }).then((result) => {
      if (result.response === 0) {
        shell.openExternal('https://status.ascendara.app/');
        app.quit();
      }
    });
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

// Get all backgrounds from backgrounds folder
ipcMain.handle('get-backgrounds', async () => {
  const backgroundsDirectory = path.join(app.getPath('userData'), '/backgrounds');
  const files = await fs.readdir(backgroundsDirectory);

  const backgrounds = await Promise.all(files.map(async (file) => {
    const filePath = path.join(backgroundsDirectory, file);
    const fileBuffer = await fs.readFile(filePath);
    const fileBase64 = fileBuffer.toString('base64');

    return {
      name: file,
      preview: `data:image/png;base64,${fileBase64}`,
    };
  }));

  return backgrounds;
});


ipcMain.handle('set-background', async (event, color, gradient) => {
  console.log(color, gradient);
  const backgroundsDirectory = path.join(app.getPath('userData'), '/backgrounds');
  const files = await fs.readdir(backgroundsDirectory);

  const backgroundFile = files.find(file => {
    const name = file.replace(/\.(png|jpg|jpeg)$/i, '');
    const isGradient = name.includes('(Gradient)');
    const isSolid = name.includes('(Solid)');
    const isMatch = isGradient ? gradient : isSolid ? !gradient : false;
    const colorMatch = name.replace(/\s*\([^)]*\)\s*/g, '').toLowerCase() === color.toLowerCase();
    return isMatch && colorMatch;
  });

  if (backgroundFile) {
    const backgroundPath = path.join(backgroundsDirectory, backgroundFile);
    const backgroundBuffer = await fs.readFile(backgroundPath);
    const backgroundBase64 = backgroundBuffer.toString('base64');
    console.log(backgroundPath)

    const mainWindow = BrowserWindow.getFocusedWindow();
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        document.body.style.background-image = 'url(data:image/png;base64,${backgroundBase64})';
      `);
    }
  }
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

ipcMain.handle('save-custom-game', async (event, game, online, dlc, version, executable) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return;
    }
    const downloadDirectory = settings.downloadDirectory;
    const gamesFilePath = path.join(downloadDirectory, 'games.json');
    try {
      await fs.promises.access(gamesFilePath, fs.constants.F_OK);
    } catch (error) {
      await fs.promises.mkdir(downloadDirectory, { recursive: true });
      await fs.promises.writeFile(gamesFilePath, JSON.stringify({ games: [] }, null, 2));
    }
    const gamesData = JSON.parse(await fs.promises.readFile(gamesFilePath, 'utf8'));
    const newGame = {
      game: game,
      online: online,
      dlc: dlc,
      version: version,
      executable: executable,
      isRunning: false
    };
    gamesData.games.push(newGame);
    await fs.promises.writeFile(gamesFilePath, JSON.stringify(gamesData, null, 2));
  } catch (error) {
    console.error('Error reading the settings file:', error);
  }
});

ipcMain.handle('get-custom-games', () => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return [];
    }
    const downloadDirectory = settings.downloadDirectory;
    const gamesFilePath = path.join(downloadDirectory, 'games.json');
    const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf8'));
    return gamesData.games;
  }
  catch (error) {
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

ipcMain.handle('open-game-directory', (event, game, isCustom) => {
  if (!isCustom) {
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
  } else {
    const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const settings = JSON.parse(data);
      if (!settings.downloadDirectory) {
        console.error('Download directory not set');
        return;
      }
      const downloadDirectory = settings.downloadDirectory;
      const gamesFilePath = path.join(downloadDirectory, 'games.json');
      const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf8'));
      const gameInfo = gamesData.games.find((g) => g.game === game);
      if (gameInfo) {
        const executablePath = gameInfo.executable;
        const executableDir = path.dirname(executablePath);
        shell.openPath(executableDir);
      } else {
        console.error(`Game not found in games.json: ${game}`);
      }
    } catch (error) {
      console.error('Error reading the settings file:', error);
    }
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

  ipcMain.handle('play-game', (event, game, isCustom) => {
    const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const settings = JSON.parse(data);
      if (!settings.downloadDirectory) {
        console.error('Download directory not set');
        return;
      }
      const downloadDirectory = settings.downloadDirectory;
      let executable;
      let gameDirectory;
      if (!isCustom) {
        gameDirectory = path.join(downloadDirectory, game);
        const gameInfoPath = path.join(gameDirectory, `${game}.ascendara.json`);
        const gameInfoData = fs.readFileSync(gameInfoPath, 'utf8');
        const gameInfo = JSON.parse(gameInfoData);
        executable = gameInfo.executable;
      } else {
        const gamesFilePath = path.join(downloadDirectory, 'games.json');
        const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf8'));
        const gameInfo = gamesData.games.find((g) => g.game === game);
        if (gameInfo) {
          executable = gameInfo.executable;
          gameDirectory = path.dirname(executable);
        } else {
          console.error(`Game not found in games.json: ${game}`);
          return;
        }
      }
      const executablePath = path.join(appDirectory, '/resources/AscendaraGameHandler.exe');
      const runGame = spawn(executablePath, [executable, isCustom]);
      runGameProcesses.set(game, runGame);
  
      runGame.on('close', (code) => {
        console.log(`Game process for ${game} exited with code ${code}`);
        runGameProcesses.delete(game);
        if (!isCustom) {
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

ipcMain.handle('remove-game', async (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return;
    }
    const downloadDirectory = settings.downloadDirectory;
    const gamesFilePath = path.join(downloadDirectory, 'games.json');
    const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf8'));
    const gameIndex = gamesData.games.findIndex((g) => g.game === game);
    if (gameIndex !== -1) {
      gamesData.games.splice(gameIndex, 1);
      fs.writeFileSync(gamesFilePath, JSON.stringify(gamesData, null, 2));
    }
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

//app.on('ready', createWindow); # Waits for update check now

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