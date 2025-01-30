/**
 *       =====================================
 *                    Ascendara
 *    The best way to test games before you buy them.
 *       =====================================
 * 
 * This is the main process file for the Ascendara Game Launcher, built with Electron.
 * It handles core functionality including:
 * 
 * - Application lifecycle management
 * - Game installation and launching
 * - Discord Rich Presence integration
 * - Auto-updates and version management
 * - IPC (Inter-Process Communication) between main and renderer processes
 * - File system operations and game directory management
 * - Error handling and crash reporting
 * - Protocol handling for custom URL schemes
 * 
 *  Start development by first setting the isDev variable to true, then run `npm run start`.
 *  Build the app from source to an executable by setting isDev to false and running `npm run dist`.
 *  Note: This will run the execute.py script to build the the index files, then build the app.
 * 
 *  Learn more about developing Ascendara at https://ascendara.app/docs/developer/overview
 * 
 **/


let isDev = false;






const CURRENT_VERSION = "7.6.2";
const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require('electron');
const { Client } = require('discord-rpc');
const disk = require('diskusage');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const fs = require('fs-extra');
const os = require('os')
const { spawn } = require('child_process');
require("dotenv").config()

let has_launched = false;
let is_latest = true;
let updateDownloaded = false;
let notificationShown = false;
let updateDownloadInProgress = false;
let rpc;
let config;

try {
    config = require('./config.prod.js');
} catch (e) {
    config = {};
}
const APIKEY = process.env.AUTHORIZATION || config.AUTHORIZATION;
const analyticsAPI = process.env.ASCENDARA_API_KEY || config.ASCENDARA_API_KEY;
const imageKey = process.env.IMAGE_KEY || config.IMAGE_KEY;
const clientId = process.env.DISCKEY || config.DISCKEY;

// Initialize Discord RPC
rpc = new Client({ transport: 'ipc' });

rpc.on('ready', () => {
  rpc.setActivity({
    state: 'Browsing Menus...',
    largeImageKey: 'ascendara',
    largeImageText: 'Ascendara'
  });

  console.log('Discord RPC is ready');
});

rpc.login({ clientId }).catch(console.error);

// Handle app ready event
app.whenReady().then(() => {
  console.log('App ready, creating window');
  createWindow();

  // Check for protocol URL in argv
  const protocolUrl = process.argv.find(arg => {
    console.log('Checking arg:', arg);
    return arg.startsWith('ascendara://');
  });
  
  if (protocolUrl) {
    console.log('Found protocol URL in argv:', protocolUrl);
    handleProtocolUrl(protocolUrl);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

async function checkVersionAndUpdate() {

  try {
    const response = await axios.get('https://api.ascendara.app/');
    const latest_version = response.data.appVer;
    
    is_latest = latest_version === CURRENT_VERSION;
    console.log(`Version check: Current=${CURRENT_VERSION}, Latest=${latest_version}, Is Latest=${is_latest}`);
    
    if (!is_latest) {
      const settings = await getSettings();
      if (settings.autoUpdate && !updateDownloadInProgress) {
        // Start background download
        downloadUpdatePromise = downloadUpdateInBackground();
      } else if (!settings.autoUpdate && !notificationShown) {
        // Show update available notification
        notificationShown = true; // Ensure notification is only shown once
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('update-available');
        });
      }
    }
    
    return is_latest;
  } catch (error) {
    console.error('Error checking version:', error);
    return true;
  }
}

async function downloadUpdateInBackground() {
  if (updateDownloadInProgress) return;
  updateDownloadInProgress = true;

  try {
    // Set downloadingUpdate to true in timestamp
    const timestampPath = path.join(os.homedir(), 'timestamp.ascendara.json');
    let timestamp = {};
    if (fs.existsSync(timestampPath)) {
      timestamp = JSON.parse(fs.readFileSync(timestampPath, 'utf8'));
    }
    timestamp.downloadingUpdate = true;
    fs.writeFileSync(timestampPath, JSON.stringify(timestamp, null, 2));

    // Custom headers for app identification
    const headers = {
      'X-Ascendara-Client': 'app',
      'X-Ascendara-Version': CURRENT_VERSION
    };


    const updateUrl = `https://lfs.ascendara.app/download?update`;
    const tempDir = path.join(os.tmpdir(), 'ascendarainstaller');
    const installerPath = path.join(tempDir, 'AscendaraInstaller.exe');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const mainWindow = BrowserWindow.getAllWindows()[0];
    const response = await axios({
      url: updateUrl,
      method: 'GET',
      responseType: 'arraybuffer',
      headers,
      onDownloadProgress: (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        mainWindow.webContents.send('update-download-progress', progress);
      }
    });

    fs.writeFileSync(installerPath, Buffer.from(response.data));
    
    updateDownloaded = true;
    updateDownloadInProgress = false;

    // Set downloadingUpdate to false in timestamp
    timestamp.downloadingUpdate = false;
    fs.writeFileSync(timestampPath, JSON.stringify(timestamp, null, 2));

    // Notify that update is ready
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-ready');
    });
  } catch (error) {
    console.error('Error downloading update:', error);
    updateDownloadInProgress = false;
    
    // Notify about the error
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('update-error', error.message);
    });
  }
}



let electronDl;
const TIMESTAMP_FILE = path.join(os.homedir(), 'timestamp.ascendara.json');

(async () => {
  electronDl = await import('electron-dl');
})();
const downloadProcesses = new Map();
const goFileProcesses = new Map();
const retryDownloadProcesses = new Map();
const runGameProcesses = new Map();
const appDirectory = path.join(path.dirname(app.getPath('exe')));
console.log(appDirectory)

let apiKeyOverride = null;

ipcMain.handle('override-api-key', (event, newApiKey) => {
  apiKeyOverride = newApiKey;
  console.log('API Key overridden:', apiKeyOverride);
});

ipcMain.handle('get-api-key', () => {
  return apiKeyOverride || APIKEY;
});

// Handle external urls
ipcMain.handle('open-url', async (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-version', () => CURRENT_VERSION);

// Check if any game is downloading
ipcMain.handle('is-downloader-running', async () => {
  try {
    // Get settings to find download directory
    const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) return false;

    // Read games data
    const gamesFilePath = path.join(settings.downloadDirectory, 'games.json');
    const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf8'));
    
    // Simply check if any game has downloadingData key
    return Object.values(gamesData).some(game => game.downloadingData);
  } catch (error) {
    console.error('Error checking downloader status:', error);
    return false;
  }
});

ipcMain.handle('delete-game-directory', async (event, game) => {
  try {
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
      try {
        // First ensure all file handles are closed by attempting to read the directory
        const files = await fs.promises.readdir(gameDirectory, { withFileTypes: true });
        
        // Delete all contents first
        for (const file of files) {
          const fullPath = path.join(gameDirectory, file.name);
          await fs.promises.rm(fullPath, { recursive: true, force: true });
        }
        
        // Then remove the empty directory itself
        await fs.promises.rmdir(gameDirectory);
        console.log('Game directory and files deleted successfully');
      } catch (error) {
        console.error('Error deleting the game directory:', error);
        throw error; // Propagate the error to handle it in the caller
      }
    } catch (error) {
      console.error('Error reading the settings file:', error);
    }
  } catch (error) {
    console.error('Error deleting the game directory:', error);
  }
});   

ipcMain.handle('stop-download', async (event, game) => {
  try {
    // Kill any running downloader processes for this game
    const processNames = ['AscendaraDownloader.exe', 'AscendaraGofileHelper.exe'];
    
    for (const processName of processNames) {
      const killProcess = spawn('taskkill', ['/f', '/im', processName]);
      await new Promise((resolve) => killProcess.on('close', resolve));
    }

    // Wait for processes to fully terminate and release file handles
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to delete directory multiple times in case file handles are still being released
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        await deleteGameDirectory(game.game);
        return true;
      } catch (deleteError) {
        attempts++;
        if (attempts === maxAttempts) {
          throw deleteError;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error('Error stopping download:', error);
    return false;
  }
});

const deleteGameDirectory = async (game) => {
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
    try {
      // First ensure all file handles are closed by attempting to read the directory
      const files = await fs.promises.readdir(gameDirectory, { withFileTypes: true });
      
      // Delete all contents first
      for (const file of files) {
        const fullPath = path.join(gameDirectory, file.name);
        await fs.promises.rm(fullPath, { recursive: true, force: true });
      }
      
      // Then remove the empty directory itself
      await fs.promises.rmdir(gameDirectory);
      console.log('Game directory and files deleted successfully');
    } catch (error) {
      console.error('Error deleting the game directory:', error);
      throw error; // Propagate the error to handle it in the caller
    }
  } catch (error) {
    console.error('Error reading the settings file:', error);
  }
};

ipcMain.handle('get-game-image', async (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return null;
    }
    const downloadDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(downloadDirectory, game);

    if (!fs.existsSync(gameDirectory)) {
      fs.mkdirSync(gameDirectory, { recursive: true });
    }
    const imageFiles = fs.readdirSync(gameDirectory);

    for (const file of imageFiles) {
      if (file === 'header.ascendara.jpg' || file === 'header.ascendara.png' || file === 'header.jpeg') {
        const imagePath = path.join(gameDirectory, file);
        const imageBuffer = fs.readFileSync(imagePath);
        return imageBuffer.toString('base64');
      }
    }

    return null;
  } catch (error) {
    console.error('Error reading the settings file:', error);
    return null;
  }
});

ipcMain.handle('can-create-files', async (event, directory) => {
  try {
    const filePath = path.join(directory, 'test.txt');
    fs.writeFileSync(filePath, 'test');
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    return false;
  }
});

// Download the file
ipcMain.handle('download-file', async (event, link, game, online, dlc, version, imgID, size) => {
  console.log(`Downloading file: ${link}, game: ${game}, online: ${online}, dlc: ${dlc}, version: ${version}, size: ${size}`);
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return;
    }
    const gamesDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(gamesDirectory, game);
    
    if (!fs.existsSync(gameDirectory)) {
      fs.mkdirSync(gameDirectory, { recursive: true });
    }

    const imageLink = `https://api.ascendara.app/v2/image/${imgID}`;
    axios({
      url: imageLink,
      method: 'GET',
      responseType: 'arraybuffer'
    }).then(response => {
      const imageBuffer = Buffer.from(response.data);
      const mimeType = response.headers['content-type'];
      const extension = getExtensionFromMimeType(mimeType);
      const downloadPath = path.join(gameDirectory, `header.ascendara${extension}`);
      const writer = fs.createWriteStream(downloadPath);

      writer.write(imageBuffer);
      writer.end();

      writer.on('finish', () => {
        console.log('Image downloaded successfully');
        let executablePath;
        let spawnCommand;

        if (link.includes('gofile.io')) {
          executablePath = isDev 
            ? path.join('./binaries/AscendaraDownloader/dist/AscendaraGofileHelper.exe')
            : path.join(appDirectory, '/resources/AscendaraGofileHelper.exe');
          spawnCommand = ["https://" + link, game, online, dlc, version, size, gamesDirectory];
        } else {
          executablePath = isDev
            ? path.join('./binaries/AscendaraDownloader/dist/AscendaraDownloader.exe')
            : path.join(appDirectory, '/resources/AscendaraDownloader.exe');
          spawnCommand = [link, game, online, dlc, version, size, gamesDirectory];
          console.log(spawnCommand)
        }

        spawn(executablePath, spawnCommand, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        }).unref();

        // Send download stats
        axios.post('https://api.ascendara.app/stats/download', {
          game: game,
        })
        .then(response => {
          console.log('Download counter incremented successfully');
        })
        .catch(error => {
          console.error('Error incrementing download counter:', error);
        });
      });

      writer.on('error', (err) => {
        console.error('Error downloading the image:', err);
      });
    }).catch(error => {
      console.error('Error during image download request:', error);
    });

  } catch (error) {
    console.error('Error reading the settings file:', error);
  }
});

function getExtensionFromMimeType(mimeType) {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    default:
      return '';
  }
}


ipcMain.handle('check-retry-extract', async (event, game) => {
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
    const files = await fs.promises.readdir(gameDirectory);
    const jsonFile = `${game}.ascendara.json`;
    if (files.length === 1 && files[0] === jsonFile) {
      return false;
    }
    return files.length > 1;
  } catch (error) {
    console.error('Error reading the settings file:', error);
    return;
  }
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
        const executablePath = isDev
          ? path.join('./binaries/AscendaraDownloader/dist/AscendaraDownloader.exe')
          : path.join(appDirectory, '/resources/AscendaraDownloader.exe');
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

// Return dev status
ipcMain.handle('is-dev', () => {
  return isDev;
});


// Retry the game download
ipcMain.handle('retry-download', async (event, link, game, online, dlc, version) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return;
    }
    const gamesDirectory = settings.downloadDirectory;
    const gameDirectory = path.join(gamesDirectory, game);

    let executablePath;
    let spawnCommand;

    if (link.includes('gofile.io')) {
      executablePath = isDev 
        ? path.join(appDirectory, '/binaries/AscendaraGofileHelper/dist/AscendaraGofileHelper.exe')
        : path.join(appDirectory, '/resources/AscendaraGofileHelper.exe');
      spawnCommand = ["https://" + link, game, online, dlc, version, '0', gamesDirectory];
    } else {
      executablePath = isDev
        ? path.join(appDirectory, '/binaries/AscendaraDownloader/dist/AscendaraDownloader.exe')
        : path.join(appDirectory, '/resources/AscendaraDownloader.exe');
      spawnCommand = [link, game, online, dlc, version, '0', gamesDirectory];
    }

    const downloadProcess = spawn(executablePath, spawnCommand);
    retryDownloadProcesses.set(game, downloadProcess);

    downloadProcess.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    downloadProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    downloadProcess.on('close', (code) => {
      console.log(`Download process exited with code ${code}`);
      retryDownloadProcesses.delete(game);
    });

    return true;
  } catch (error) {
    console.error('Error retrying download:', error);
    return false;
  }
});

// Download game cover
ipcMain.handle('download-game-cover', async (event, { imgID, gameName }) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      throw new Error('Download directory not set');
    }

    const gameDirectory = path.join(settings.downloadDirectory, gameName);
    if (!fs.existsSync(gameDirectory)) {
      fs.mkdirSync(gameDirectory, { recursive: true });
    }

    const imageUrl = `https://api.ascendara.app/v2/image/${imgID}`;
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'arraybuffer'
    });

    const imagePath = path.join(gameDirectory, 'header.ascendara.jpg');
    fs.writeFileSync(imagePath, Buffer.from(response.data));

    // Update games.json with the new image path
    const gamesJsonPath = path.join(settings.downloadDirectory, 'games.json');
    let gamesData = { games: [] };
    
    try {
      const existingData = fs.readFileSync(gamesJsonPath, 'utf8');
      gamesData = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist or is invalid, use default empty object
    }
    
    // Update the image path if the game exists
    const gameIndex = gamesData.games.findIndex(g => g.game === gameName);
    if (gameIndex >= 0) {
      gamesData.games[gameIndex].imgPath = imagePath;
      fs.writeFileSync(gamesJsonPath, JSON.stringify(gamesData, null, 2));
    }

    // Return the image as base64 for preview
    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    console.error('Error downloading game cover:', error);
    throw error;
  }
});

ipcMain.handle('is-new', () => {
  const filePath = TIMESTAMP_FILE;
  try {
    fs.accessSync(filePath);
    return false; // File exists, not new
  } catch (error) {
    return true; // File does not exist, is new
  }
});

ipcMain.handle('is-v7', () => {
  try {
    const data = fs.readFileSync(TIMESTAMP_FILE, 'utf8');
    const timestamp = JSON.parse(data);
    return timestamp.hasOwnProperty('v7') && timestamp.v7 === true;
  } catch (error) {
    return false; // If there's an error, assume not v7
  }
});

ipcMain.handle('set-v7', () => {
  const filePath = path.join(os.homedir(), 'timestamp.ascendara.json');
  try {
    let timestamp = {
      timestamp: Date.now(),
      v7: true
    };

    // If file exists, update it while preserving the original timestamp
    if (fs.existsSync(filePath)) {
      const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      timestamp.timestamp = existingData.timestamp;
    }

    fs.writeFileSync(filePath, JSON.stringify(timestamp, null, 2));
    return true;
  } catch (error) {
    console.error('Error setting v7:', error);
    return false;
  }
});

ipcMain.handle('create-timestamp', () => {
  const filePath = path.join(os.homedir(), 'timestamp.ascendara.json');
  const timestamp = {
    timestamp: Date.now(),
    v7: true
  };
  console.log(timestamp)
  fs.writeFileSync(filePath, JSON.stringify(timestamp, null, 2));
});


ipcMain.handle('has-launched', () => {
  const result = has_launched;
  if (!has_launched) {
    has_launched = true;
  }
  return result;
});

ipcMain.handle('update-launch-count', () => {
  try {
    const timestampPath = path.join(os.homedir(), 'timestamp.ascendara.json');
    let timestamp = {};
    
    if (fs.existsSync(timestampPath)) {
      timestamp = JSON.parse(fs.readFileSync(timestampPath, 'utf8'));
    }
    
    timestamp.launchCount = (timestamp.launchCount || 0) + 1;
    fs.writeFileSync(timestampPath, JSON.stringify(timestamp, null, 2));
    
    return timestamp.launchCount;
  } catch (error) {
    console.error('Error updating launch count:', error);
    return 1;
  }
});

ipcMain.handle('delete-installer', () => {
    // check ascnedarainstaller tempfile and delete if exists
    const filePath = path.join(app.getPath('temp'), 'ascendarainstaller.exe');
    try {
      fs.unlinkSync(filePath);
    }
    catch (error) {
      console.error(error);
    }
});

ipcMain.handle('get-analytics-key', () => {
    return analyticsAPI;
});

ipcMain.handle('get-image-key', () => {
    return imageKey;
});

ipcMain.handle('set-timestamp-value', async (event, key, value) => {
  const filePath = TIMESTAMP_FILE;
  try {
    let timestamp = {};
    if (fs.existsSync(filePath)) {
      timestamp = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    timestamp[key] = value;
    fs.writeFileSync(filePath, JSON.stringify(timestamp, null, 2));
  } catch (error) {
    console.error('Error setting timestamp value:', error);
  }
});

ipcMain.handle('get-timestamp-value', async (event, key) => {
  const filePath = TIMESTAMP_FILE;
  try {
    let timestamp = {};
    if (fs.existsSync(filePath)) {
      timestamp = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return timestamp[key];
  } catch (error) {
    console.error('Error getting timestamp value:', error);
    return null;
  }
});

// Read the settings JSON file and send it to the renderer process
ipcMain.handle('get-settings', () => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    let settings = {};
    
    // Try to read existing settings
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      settings = JSON.parse(data);
    }
    
    // Define default settings
    const defaultSettings = {
      downloadDirectory: settings.downloadDirectory || '',
      viewOldDownloadLinks: false,
      seeInappropriateContent: false,
      autoCreateShortcuts: true,
      sendAnalytics: true,
      autoUpdate: true,
      language: 'en',
      theme: 'purple',
      threadCount: 4,
    };

    // Merge existing settings with defaults, preserving existing values
    const mergedSettings = {
      ...defaultSettings,
      ...settings,
      enabledSources: {
        ...defaultSettings.enabledSources,
        ...(settings.enabledSources || {})
      },
      // Ensure download directory is preserved from existing settings
      downloadDirectory: settings.downloadDirectory || defaultSettings.downloadDirectory
    };

    // Save merged settings only if file doesn't exist
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2));
    }

    return mergedSettings;
  } catch (error) {
    console.error('Error reading settings:', error);
    // Return default settings if there's an error
    const defaultSettings = {
      downloadDirectory: '',
      viewOldDownloadLinks: false,
      seeInappropriateContent: false,
      autoCreateShortcuts: true,
      sendAnalytics: true,
      autoUpdate: true,
      language: 'en',
      theme: 'purple',
      threadCount: 4,
    };
    return defaultSettings;
  }
});

// Save the settings JSON file
ipcMain.handle('save-settings', async (event, options, directory) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    let settings = {};
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      settings = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, use empty settings object
    }

    // Ensure language is saved as a string
    if (options && typeof options.language === 'object') {
      options.language = String(options.language);
    }
    
    // If directory is provided, update the download directory
    if (directory) {
      options.downloadDirectory = directory;
    }

    fs.writeFileSync(filePath, JSON.stringify(options, null, 2));
    event.sender.send('settings-changed', options);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});

let isInstalling = false;

ipcMain.handle('install-dependencies', async (event) => {
    if (isInstalling) {
        return { success: false, message: 'Installation already in progress' };
    }

    isInstalling = true;

    try {
        const tempDir = path.join(os.tmpdir(), 'ascendaradependencies');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const zipUrl = 'https://cdn.ascendara.app/files/deps.zip';
        const zipPath = path.join(tempDir, 'deps.zip');
        const res = await fetch(zipUrl);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(zipPath, buffer);

        await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: tempDir }))
            .promise();

        const files = fs.readdirSync(tempDir);
        const executables = files.filter(file => path.extname(file) === '.exe');
        const msis = files.filter(file => path.extname(file) === '.msi');

        for (const executable of executables) {
            const exePath = path.join(tempDir, executable);
            
            // Notify the renderer that installation has started
            event.sender.send('dependency-installation-status', { name: executable, status: 'starting' });

            // Check if the file is executable
            fs.chmodSync(exePath, '755');

            // Run the executable with elevated privileges
            await new Promise((resolve, reject) => {
                console.log(`Starting installation of: ${executable}`);
                const process = spawn('powershell.exe', ['-Command', `Start-Process -FilePath "${exePath}" -Verb RunAs -Wait`], { shell: true });
                process.on('error', (error) => {
                    reject(error);
                });
                process.on('exit', (code) => {
                    if (code === 0) {
                        console.log(`Finished installing: ${executable}`);
                        // Notify the renderer that installation has finished
                        event.sender.send('dependency-installation-status', { name: executable, status: 'finished' });
                        resolve();
                    } else {
                        console.error(`Failed to install: ${executable}`);
                        // Notify the renderer that installation has failed
                        event.sender.send('dependency-installation-status', { name: executable, status: 'failed' });
                        reject(new Error(`Process exited with code ${code}`));
                    }
                });
            });
        }

        // Handle .msi files
        for (const msi of msis) {
            const msiPath = path.join(tempDir, msi);
            // Notify the renderer that installation has started
            event.sender.send('dependency-installation-status', { name: msi, status: 'starting' });

            await new Promise((resolve, reject) => {
                console.log(`Starting installation of: ${msi}`);
                const process = spawn(msiPath, [], { 
                    detached: true, 
                    shell: true, 
                    stdio: 'ignore', // Ignore stdio to prevent output
                    windowsHide: true // Hide the command prompt window
                });
                process.on('error', (error) => {
                    reject(error);
                });
                process.on('exit', (code) => {
                    if (code === 0) {
                        console.log(`Finished installing: ${msi}`);
                        // Notify the renderer that installation has finished
                        event.sender.send('dependency-installation-status', { name: msi, status: 'finished' });
                        resolve();
                    } else {
                        console.error(`Failed to install: ${msi}`);
                        // Notify the renderer that installation has failed
                        event.sender.send('dependency-installation-status', { name: msi, status: 'failed' });
                        reject(new Error(`Process exited with code ${code}`));
                    }
                });
            });
        }

        // Clean up
        fs.rm(tempDir, { recursive: true, force: true }, (err) => {
            if (err) {
                console.error('Error removing temp directory:', err);
            } else {
                console.log('Temp directory removed successfully');
            }
        });

        console.log('All installations complete');
        return { success: true, message: 'All dependencies installed successfully' };
    } catch (error) {
        console.error('An error occurred:', error);
        return { success: false, message: error.message };
    } finally {
        isInstalling = false;
    }
});

/**
 * Check if a file exists using PowerShell
 * @param {string} filePath - The file path to check
 * @returns {Promise<boolean>} - Whether the file exists
 */
async function checkFileExists(filePath) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const command = `powershell -Command "Test-Path '${filePath}'"`;
    
    exec(command, (error, stdout) => {
      if (error) {
        console.error('Error checking file:', error);
        resolve(false);
        return;
      }
      resolve(stdout.trim().toLowerCase() === 'true');
    });
  });
}


/**
 * Check if a dependency is installed by looking up its registry key
 * @param {string} registryKey - The registry key to check
 * @param {string} valueName - The value name to look for
 * @returns {Promise<boolean>} - Whether the dependency is installed
 */
async function checkRegistryKey(registryKey, valueName) {
  return new Promise((resolve) => {
    try {
      const Registry = require('winreg');
      const regKey = new Registry({
        hive: Registry.HKLM,
        key: registryKey.replace('HKLM\\', '\\')
      });

      regKey.valueExists(valueName, (err, exists) => {
        if (err || !exists) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    } catch (error) {
      console.error('Error checking registry:', error);
      resolve(false);
    }
  });
}

// Registry paths for dependencies
const DEPENDENCY_REGISTRY_PATHS = {
  'dotNetFx40_Full_x86_x64.exe': {
    key: 'HKLM\\SOFTWARE\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full',
    value: 'Install',
    name: '.NET Framework 4.0',
    checkType: 'registry'
  },
  'dxwebsetup.exe': {
    key: 'HKLM\\SOFTWARE\\Microsoft\\DirectX',
    value: 'Version',
    name: 'DirectX',
    checkType: 'registry'
  },
  'oalinst.exe': {
    filePath: 'C:\\Windows\\System32\\OpenAL32.dll',
    name: 'OpenAL',
    checkType: 'file'
  },
  'VC_redist.x64.exe': {
    key: 'HKLM\\SOFTWARE\\Microsoft\\DevDiv\\VC\\Servicing\\14.0\\RuntimeMinimum',
    value: 'Install',
    name: 'Visual C++ Redistributable',
    checkType: 'registry'
  },
  'xnafx40_redist.msi': {
    key: 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\XNA\\Framework\\v4.0',
    value: 'Installed',
    name: 'XNA Framework',
    checkType: 'registry'
  }
};

/**
 * Check if a dependency is installed
 * @param {Object} depInfo - Dependency information
 * @returns {Promise<boolean>} - Whether the dependency is installed
 */
async function checkDependencyInstalled(depInfo) {
  let isInstalled;
  if (depInfo.checkType === 'file') {
    isInstalled = await checkFileExists(depInfo.filePath);
    console.log(`File check for ${depInfo.name}: ${isInstalled ? 'Found' : 'Not found'} at ${depInfo.filePath}`);
  } else {
    isInstalled = await checkRegistryKey(depInfo.key, depInfo.value);
    console.log(`Registry check for ${depInfo.name}: ${isInstalled ? 'Found' : 'Not found'} at ${depInfo.key}`);
  }
  return isInstalled;
}

/**
 * Check the installation status of all game dependencies
 * @returns {Promise<Array>} Array of dependency status objects
 */
async function checkGameDependencies() {
  const results = [];
  
  for (const [file, info] of Object.entries(DEPENDENCY_REGISTRY_PATHS)) {
    const isInstalled = await checkDependencyInstalled(info);
    results.push({
      name: info.name,
      file: file,
      installed: isInstalled
    });
  }
  
  return results;
}

// Handle IPC call to check dependencies
ipcMain.handle('check-game-dependencies', async () => {
  return await checkGameDependencies();
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
          const errorKey = `${dir}_${error.code}`;
          if (shouldLogError(errorKey)) {
            console.error(`Error reading game info file for ${dir}:`, error);
          }
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

async function getSettings() {
  try {
    const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
    console.log('Reading settings from:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('Settings file does not exist');
      return { autoUpdate: true };
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    console.log('Raw settings data:', data);
    
    const settings = JSON.parse(data);
    console.log('Parsed settings:', settings);
    return settings;
  } catch (error) {
    console.error('Error reading settings:', error);
    return { autoUpdate: true }; // Default settings if there's an error
  }
}

ipcMain.handle('update-ascendara', async () => {
  if (is_latest) return;
  
  if (!updateDownloaded) {
    try {
      if (downloadUpdatePromise) {
        await downloadUpdatePromise;
      } else {
        await downloadUpdateInBackground();
      }
    } catch (error) {
      console.error('Error during update download:', error);
      return;
    }
  }
  
  if (updateDownloaded) {
    const tempDir = path.join(os.tmpdir(), 'ascendarainstaller');
    const installerPath = path.join(tempDir, 'AscendaraInstaller.exe');
    
    if (!fs.existsSync(installerPath)) {
      console.error('Installer not found at:', installerPath);
      return;
    }
    
    const installerProcess = spawn(installerPath, [], { 
      detached: true, 
      stdio: 'ignore',
      shell: true 
    });

    installerProcess.unref();
    app.quit();
  }
});

ipcMain.handle('check-for-updates', async () => {
  if (isDev) return true;
  try {
    return await checkVersionAndUpdate();
  } catch (error) {
    console.error('Error checking for updates:', error);
    return true;
  }
});

ipcMain.handle('uninstall-ascendara', async () => {
  const executablePath = process.execPath;
  const executableDir = path.dirname(executablePath);
  const uninstallerPath = path.join(executableDir + "\\Uninstall Ascendara.exe");
  const timestampFilePath = path.join(app.getPath('home'), 'timestamp.ascendara.json');
  try {
    fs.unlinkSync(timestampFilePath);
  } catch (error) {
    console.error('Error deleting timestamp file:', error);
  }
  const settingsFilePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    fs.unlinkSync(settingsFilePath);
  } catch (error) {
    console.error('Error deleting settings file:', error);
  }
  shell.openExternal("https://ascendara.app/uninstall");
  const process = spawn('powershell.exe', ['-Command', `Start-Process -FilePath "${uninstallerPath}" -Verb RunAs -Wait`], { shell: true });
  process.on('error', (error) => {
    reject(error);
  });
});

// Save the custom game
ipcMain.handle('save-custom-game', async (event, game, online, dlc, version, executable, imgID) => {
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
    const gameDirectory = path.join(downloadDirectory, game);

    // Create game directory if it doesn't exist
    if (!fs.existsSync(gameDirectory)) {
      fs.mkdirSync(gameDirectory, { recursive: true });
    }

    // Download and save the cover image if imgID is provided
    if (imgID) {
      const imageLink = `https://api.ascendara.app/v2/image/${imgID}`;
      try {
        const response = await axios({
          url: imageLink,
          method: 'GET',
          responseType: 'arraybuffer'
        });
        const imageBuffer = Buffer.from(response.data);
        const mimeType = response.headers['content-type'];
        const extension = getExtensionFromMimeType(mimeType);
        const downloadPath = path.join(gameDirectory, `header.ascendara${extension}`);
        await fs.promises.writeFile(downloadPath, imageBuffer);
        console.log('Cover image downloaded successfully');
      } catch (error) {
        console.error('Error downloading cover image:', error);
      }
    }

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
    try {
      const gamesData = JSON.parse(fs.readFileSync(gamesFilePath, 'utf8'));
      return gamesData.games;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      } else {
        throw error;
      }
    }
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

// Open the file dialog
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

// Get the download directory
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
  if (game === "local") {
    const executablePath = process.execPath;
    const executableDir = path.dirname(executablePath);
    shell.openPath(executableDir);
  } else {
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
  }}
});

// Modify the game executable
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
  }
});

ipcMain.handle('play-game', async (event, game, isCustom = false) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    
    if (!settings.downloadDirectory) {
      throw new Error('Download directory not set');
    }

    let executable;
    let gameDirectory;

    if (!isCustom) {
      gameDirectory = path.join(settings.downloadDirectory, game);
      const gameInfoPath = path.join(gameDirectory, `${game}.ascendara.json`);
      
      if (!fs.existsSync(gameInfoPath)) {
        throw new Error(`Game info file not found: ${gameInfoPath}`);
      }

      const gameInfoData = fs.readFileSync(gameInfoPath, 'utf8');
      const gameInfo = JSON.parse(gameInfoData);

      
      if (!gameInfo.executable) {
        throw new Error('Executable path not found in game info');
      }
      
      // Check if the executable path is already absolute
      if (path.isAbsolute(gameInfo.executable)) {
        executable = gameInfo.executable;
      } else {
        executable = path.join(gameDirectory, gameInfo.executable);
      }
    } else {
      const gamesPath = path.join(settings.downloadDirectory, 'games.json');
      if (!fs.existsSync(gamesPath)) {
        throw new Error('Custom games file not found');
      }

      const gamesData = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
      const gameInfo = gamesData.games.find((g) => g.game === game);

      if (!gameInfo || !gameInfo.executable) {
        throw new Error(`Game not found in games.json: ${game}`);
      }

      executable = gameInfo.executable; // Custom games should already have absolute paths
      gameDirectory = path.dirname(executable);
    }

    // Validate paths
    if (!fs.existsSync(executable)) {
      throw new Error(`Game executable not found: ${executable}`);
    }

    // Check if game is already running
    if (runGameProcesses.has(game)) {
      throw new Error('Game is already running');
    }

  
    const handlerPath = path.join(appDirectory, '/resources/AscendaraGameHandler.exe')

    if (!fs.existsSync(handlerPath)) {
      throw new Error('Game handler not found');
    };

    console.log('Launching game:', {
      handlerPath,
      executable,
      isCustom: isCustom.toString(),
      gameDirectory
    });

    const runGame = spawn(handlerPath, [executable, isCustom.toString()], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: gameDirectory
    });

    // Log any output for debugging
    runGame.stdout.on('data', (data) => {
      console.log(`Game handler output: ${data}`);
    });

    runGame.stderr.on('data', (data) => {
      console.error(`Game handler error: ${data}`);
    });

    runGameProcesses.set(game, runGame);

    // Update game status to running in JSON files
    try {
      // Update settings.json
      if (!settings.runningGames) settings.runningGames = {};
      settings.runningGames[game] = true;
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));

      // Update games.json
      const gamesPath = path.join(settings.downloadDirectory, 'games.json');
      if (fs.existsSync(gamesPath)) {
        const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
        if (games[game]) {
          games[game].running = true;
          fs.writeFileSync(gamesPath, JSON.stringify(games, null, 2));
        }
      }
    } catch (error) {
      console.error('Error updating game running status:', error);
    }

    // Set up error handler
    runGame.on('error', (error) => {
      console.error(`Failed to start game ${game}:`, error);
      event.sender.send('game-launch-error', { game, error: error.message });
      runGameProcesses.delete(game);
      showWindow();
    });

    // Wait a short moment to catch immediate launch errors
    await new Promise(resolve => setTimeout(resolve, 500));

    // If no immediate errors, consider it a success
    event.sender.send('game-launch-success', { game });
    hideWindow();

    // Create shortcut and mark game as launched if it's the first time
    if (!isCustom) {
      const gameInfoPath = path.join(gameDirectory, `${game}.ascendara.json`);
      const gameInfo = JSON.parse(fs.readFileSync(gameInfoPath, 'utf8'));
      if (!gameInfo.hasBeenLaunched && settings.autoCreateShortcuts) {
        await createGameShortcut({
          game: game,
          name: game,
          executable: executable,
          custom: false
        });
        gameInfo.hasBeenLaunched = true;
        fs.writeFileSync(gameInfoPath, JSON.stringify(gameInfo, null, 2));
      }
    }

    // Update Discord Rich Presence
    rpc.setActivity({
      details: 'Playing a Game',
      state: `${game}`,
      startTimestamp: new Date(),
      largeImageKey: 'ascendara',
      largeImageText: 'Ascendara',
      buttons: [
        {
          label: 'Play on Ascendara',
          url: 'https://ascendara.app/'
        }
      ]
    });

    runGame.on('exit', (code) => {
      console.log(`Game ${game} exited with code ${code}`);
      
      // Update game status to not running in JSON files
      try {
        // Update settings.json
        const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (settings.runningGames) {
          delete settings.runningGames[game];
          fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
        }

        // Update games.json
        const gamesPath = path.join(settings.downloadDirectory, 'games.json');
        if (fs.existsSync(gamesPath)) {
          const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
          if (games[game]) {
            games[game].running = false;
            fs.writeFileSync(gamesPath, JSON.stringify(games, null, 2));
          }
        }
      } catch (error) {
        console.error('Error updating game running status:', error);
      }

      runGameProcesses.delete(game);
      showWindow();
      
      // Update Discord RPC
      rpc.setActivity({
        state: 'Browsing Menus...',
        largeImageKey: 'ascendara',
        largeImageText: 'Ascendara'
      });
    });

    return true;
  } catch (error) {
    console.error('Error launching game:', error);
    event.sender.send('game-launch-error', { game, error: error.message });
    return false;
  }
});

// Stop the game
ipcMain.handle('stop-game', (event, game) => {
  const runGame = runGameProcesses.get(game);
  if (runGame) {
    runGame.kill();
   
    rpc.setActivity({
      state: 'Browsing Menus...',
      largeImageKey: 'ascendara',
      largeImageText: 'Ascendara'
    });

  }
});

// Check if the game is running
ipcMain.handle('is-game-running', async (event, game) => {
  const runGame = runGameProcesses.get(game);
  return runGame ? true : false;
});

// Get the required libraries
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

// Delete the game
ipcMain.handle('delete-game', async (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    if (game === "local") {
      const timestampFilePath = path.join(app.getPath('home'), 'timestamp.ascendara.json');
      fs.unlinkSync(timestampFilePath);
      return;
    }

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

// Remove the game
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

// Download finished
ipcMain.handle('download-finished', async (event, game) => {
    const meiFolders = await fs.readdir(gameDirectory);
    for (const folder of meiFolders) {
      if (folder.startsWith('_MEI')) {
        const meiFolderPath = path.join(gameDirectory, folder);
        await fs.remove(meiFolderPath);
      }
    }});

// Minimize the window
ipcMain.handle('minimize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

// Maximize the window
ipcMain.handle('maximize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

// Close the window
ipcMain.handle('close-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

const ERROR_COUNTS_FILE = path.join(app.getPath('userData'), 'error-counts.json');

function getErrorCounts() {
  try {
    if (fs.existsSync(ERROR_COUNTS_FILE)) {
      const data = fs.readFileSync(ERROR_COUNTS_FILE, 'utf8');
      return new Map(Object.entries(JSON.parse(data)));
    }
  } catch (error) {
    console.error('Error reading error counts:', error);
  }
  return new Map();
}

function saveErrorCounts(counts) {
  try {
    fs.writeFileSync(ERROR_COUNTS_FILE, JSON.stringify(Object.fromEntries(counts)), 'utf8');
  } catch (error) {
    console.error('Error saving error counts:', error);
  }
}

function shouldLogError(errorKey) {
  const MAX_ERROR_LOGS = 2;
  const counts = getErrorCounts();
  const count = counts.get(errorKey) || 0;
  if (count < MAX_ERROR_LOGS) {
    counts.set(errorKey, count + 1);
    saveErrorCounts(counts);
    return true;
  }
  return false;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    title: 'Ascendara',
    icon: path.join(__dirname, 'icon.ico'),
    width: 1600,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.setMinimumSize(1600, 800);
}

// Window visibility control functions
let isHandlingProtocolUrl = false;

function hideWindow() {
  // Don't hide window if handling protocol URL
  if (isHandlingProtocolUrl) {
    console.log('Skipping window hide during protocol URL handling');
    return;
  }
  BrowserWindow.getAllWindows().forEach(window => {
    window.hide();
  });
}

function showWindow() {
  BrowserWindow.getAllWindows().forEach(window => {
    window.show();
  });
}

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

ipcMain.handle('welcome-complete', (event) => {
  // Notify all windows
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('welcome-complete');
  });
});

ipcMain.handle('check-v7-welcome', async () => {
  try {
    const v7Path = path.join(app.getPath('userData'), 'v7.json');
    return !fs.existsSync(v7Path);
  } catch (error) {
    console.error('Error checking v7 welcome:', error);
    return false;
  }
});

ipcMain.handle('get-asset-path', (event, filename) => {
  let assetPath;
  if (!app.isPackaged) {
    // In development
    assetPath = path.join(__dirname, '..', 'public', filename);
  } else {
    // In production
    assetPath = path.join(process.resourcesPath, 'public', filename);
  }
  
  if (!fs.existsSync(assetPath)) {
    console.error(`Asset not found: ${assetPath}`);
    return null;
  }

  // Return the raw file data as base64
  const imageBuffer = fs.readFileSync(assetPath);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
});

ipcMain.handle('clear-cache', async () => {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      // Clear all browser data including cache, cookies, storage etc.
      await mainWindow.webContents.session.clearStorageData({
        storages: [
          'appcache',
          'cookies',
          'filesystem',
          'indexdb',
          'localstorage',
          'shadercache',
          'websql',
          'serviceworkers',
          'cachestorage'
        ]
      });
      
      // Clear HTTP cache specifically
      await mainWindow.webContents.session.clearCache();
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
});

ipcMain.handle('get-drive-space', async (event, directory) => {
    try {
        const { available } = await disk.check(directory);
        console.log(`Available space on ${directory}: ${available} bytes`);
        return { freeSpace: available };
    } catch (error) {
        console.error('Error getting drive space:', error);
        return { freeSpace: 0 };
    }
});

ipcMain.handle('get-platform', () => process.platform);

ipcMain.on('settings-changed', () => {
    BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('settings-updated')
    })
})

ipcMain.handle('is-update-downloaded', () => {
  return updateDownloaded;
});

ipcMain.handle('save-game-image', async (event, gameName, imageBase64) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    if (!settings.downloadDirectory) {
      console.error('Download directory not set');
      return false;
    }

    const gameDirectory = path.join(settings.downloadDirectory, gameName);
    if (!fs.existsSync(gameDirectory)) {
      fs.mkdirSync(gameDirectory, { recursive: true });
    }
    const imagePath = path.join(gameDirectory, 'header.ascendara.jpg');
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    fs.writeFileSync(imagePath, imageBuffer);
    
    return true;
  } catch (error) {
    console.error('Error saving game image:', error);
    return false;
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('launch-game', async (event, game) => {
  const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    const gameData = settings.games[game];

    // Validate executable before attempting to launch
    await validateGameExecutable(gameData);

    const gameProcess = spawn(gameData.executable, [], {
      cwd: path.dirname(gameData.executable)
    });

    let hasError = false;
    
    gameProcess.on('error', async (error) => {
      hasError = true;
      await showErrorDialog('Game Launch Error', `Failed to launch game: ${error.message}`);
      console.error('Game process error:', error);
    });

    // Wait a short moment to catch immediate launch errors
    await new Promise(resolve => setTimeout(resolve, 500));

    // Only hide if no immediate errors occurred
    if (!hasError) {
      hideWindow();
      
      gameProcess.on('close', (code) => {
        showWindow();
        if (code !== 0) {
          console.log(`Game process exited with code ${code}`);
        }
      });
    }

    return true;
  } catch (error) {
    await showErrorDialog('Game Launch Error', `Failed to launch game: ${error.message}`);
    console.error('Error launching game:', error);
    return false;
  }
});

async function showErrorDialog(title, message) {
  const window = BrowserWindow.getFocusedWindow();
  if (window) {
    await dialog.showMessageBox(window, {
      type: 'error',
      title: title,
      message: message,
      buttons: ['OK']
    });
  }
}

async function validateGameExecutable(gameData) {
  if (!gameData || !gameData.executable) {
    throw new Error('Game executable not found');
  }
  
  if (!fs.existsSync(gameData.executable)) {
    throw new Error('Game executable file does not exist');
  }
  
  const stats = await fs.promises.stat(gameData.executable);
  if (!stats.isFile()) {
    throw new Error('Game executable path is not a file');
  }
}

// Create game shortcut
async function createGameShortcut(game) {
  try {
    console.log('Creating shortcut for game:', game);
    const shortcutPath = path.join(os.homedir(), 'Desktop', `${game.game || game.name}.lnk`);
    
    // Get game executable path
    const exePath = game.executable;
    const gameName = game.game || game.name;
    const isCustom = !!game.custom;
    
    if (!exePath || !fs.existsSync(exePath)) {
      throw new Error(`Game executable not found: ${exePath}`);
    }
    
    // Get game handler path
    const handlerPath = path.join(appDirectory, '/resources/AscendaraGameHandler.exe');
    console.log('Handler path:', handlerPath);
    
    if (!fs.existsSync(handlerPath)) {
      throw new Error(`Game handler not found at: ${handlerPath}`);
    }
    
    // PowerShell script to create shortcut
    const psScript = `
      $WScriptShell = New-Object -ComObject WScript.Shell
      $Shortcut = $WScriptShell.CreateShortcut("${shortcutPath}")
      $Shortcut.TargetPath = "${handlerPath}"
      $Shortcut.Arguments = '"${exePath}" ${isCustom ? 1 : 0} "--shortcut"'
      $Shortcut.WorkingDirectory = "${path.dirname(handlerPath)}"
      $Shortcut.IconLocation = "${exePath},0"
      $Shortcut.Save()
    `;
    
    // Save PowerShell script to temp file
    const psPath = path.join(os.tmpdir(), 'createShortcut.ps1');
    fs.writeFileSync(psPath, psScript);
    
    // Execute PowerShell script
    await new Promise((resolve, reject) => {
      const process = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', psPath], { windowsHide: true });
      
      process.on('error', (error) => {
        reject(error);
      });
      process.on('exit', (code) => {
        fs.unlinkSync(psPath); // Clean up temp file
        if (code === 0) resolve();
        else reject(new Error(`Process exited with code ${code}`));
      });
    });
    
    return true;
  } catch (error) {
    console.error('Error creating shortcut:', error);
    return false;
  }
}

// Handle shortcut creation request
ipcMain.handle('create-game-shortcut', async (event, game) => {
  return await createGameShortcut(game);
});

ipcMain.handle('check-file-exists', async (event, execPath) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'ascendarasettings.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const settings = JSON.parse(data);
    
    if (!settings.downloadDirectory) {
      return false;
    }

    let executable;
    if (path.isAbsolute(execPath)) {
      executable = execPath;
    } else {
      executable = path.join(settings.downloadDirectory, execPath);
    }

    return fs.existsSync(executable);
  } catch (error) {
    console.error('Error checking executable:', error);
    return false;
  }
});

function launchCrashReporter(errorCode, errorMessage) {
  try {
    const crashReporterPath = path.join('.', 'AscendaraCrashReporter.exe');
    if (fs.existsSync(crashReporterPath)) {
      spawn(
        crashReporterPath,
        ["mainapp", errorCode.toString(), errorMessage],
        { detached: true, stdio: 'ignore' }
      ).unref();
    } else {
      console.error(`Crash reporter not found at: ${crashReporterPath}`);
    }
  } catch (error) {
    console.error('Failed to launch crash reporter:', error);
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  launchCrashReporter(1000, error.message || 'Unknown error occurred');
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  launchCrashReporter(1002, reason?.message || 'Unhandled promise rejection');
  app.quit();
});

// Handle the protocol URL
let lastHandledUrl = null;
let lastHandleTime = 0;
let pendingUrls = new Set();
const URL_DEBOUNCE_TIME = 2000; // 2 seconds

function handleProtocolUrl(url) {
  if (!url) return;
  
  // Ensure proper URL format
  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith('ascendara://')) return;

  // Get the main window
  const mainWindow = BrowserWindow.getAllWindows()[0];
  
  // If no window exists, store URL and create window
  if (!mainWindow) {
    pendingUrls.add(cleanUrl);
    createWindow();
    return;
  }

  // Show and focus window
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();

  try {
    // Set flag to prevent window hiding
    isHandlingProtocolUrl = true;

    // Only send if it's a new URL or enough time has passed
    const currentTime = Date.now();
    if (cleanUrl !== lastHandledUrl || (currentTime - lastHandleTime) > URL_DEBOUNCE_TIME) {
      lastHandledUrl = cleanUrl;
      lastHandleTime = currentTime;
      
      // Check if this is a game URL
      if (cleanUrl.includes('game')) {
        try {
          // Extract the ID, removing any query parameters
          const imageId = cleanUrl.split('?').pop().replace('/', '');
          if (imageId) {
            console.log('Sending game URL to renderer with imageId:', imageId);
            mainWindow.webContents.send('protocol-game-url', { imageId });
          }
        } catch (error) {
          console.error('Error parsing game URL:', error);
        }
      } else {
        // Handle existing download protocol
        console.log('Sending download URL to renderer:', cleanUrl);
        mainWindow.webContents.send('protocol-download-url', cleanUrl);
      }
    }

    // Reset flag after a delay
    setTimeout(() => {
      isHandlingProtocolUrl = false;
    }, 1000);
  } catch (error) {
    console.error('Error handling protocol URL:', error);
    isHandlingProtocolUrl = false;
  }
  
  // Clear pending URLs since we've handled this one
  pendingUrls.clear();
}

// Register IPC handler for renderer to request pending URLs
ipcMain.handle('get-pending-urls', () => {
  const urls = Array.from(pendingUrls);
  pendingUrls.clear();
  return urls;
});

// Single instance lock check
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is running, quitting this instance');
  app.quit();
} else {
  // Register protocol handler
  if (process.defaultApp || isDev) {
    app.setAsDefaultProtocolClient('ascendara', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('ascendara');
  }

  // Handle second instance
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Second instance detected with args:', commandLine);
    
    // Check for protocol URL
    const protocolUrl = commandLine.find(arg => arg.startsWith('ascendara://'));
    
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl);
    } else {
      // Focus existing window for normal launch
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });

  // Handle protocol URLs
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  // Setup on app ready
  app.whenReady().then(() => {
    // Register protocol handler
    protocol.registerHttpProtocol('ascendara', (request, callback) => {
      handleProtocolUrl(request.url);
    });

    // Check first instance protocol URL
    const protocolUrl = process.argv.find(arg => arg.startsWith('ascendara://'));
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl);
    }
  });

  // Cleanup on app quit
  app.on('window-all-closed', () => {
    pendingUrls.clear();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Handle activation
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

ipcMain.handle('get-launch-count', () => {
  try {
    const timestampPath = path.join(os.homedir(), 'timestamp.ascendara.json');
    if (fs.existsSync(timestampPath)) {
      const timestamp = JSON.parse(fs.readFileSync(timestampPath, 'utf8'));
      return timestamp.launchCount || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error reading launch count:', error);
    return 0;
  }
});
