const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let settingsWindow;
let sentencesCache = [];
let currentBackgroundColor = 'rgba(255, 255, 255, 0)'; // 默认透明背景

// 从 1 到 25 的 JSON 文件中预加载数据
function preloadSentences() {
  sentencesCache = [];
  for (let i = 1; i <= 25; i++) {
    const filePath = path.join(__dirname, 'HitokotoOfficial', `${i}.json`);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      sentencesCache.push(...data.filter(item => item.id >= 1 && item.id <= 400));
    } catch (error) {
      console.error(`无法读取或解析文件 ${filePath}:`, error);
    }
  }
}

// 从缓存中随机选择一个句子
function getRandomSentence() {
  if (sentencesCache.length === 0) {
    return { hitokoto: '没有句子可用', from: '系统', from_who: '' };
  }
  return sentencesCache[Math.floor(Math.random() * sentencesCache.length)];
}

// 创建设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  settingsWindow.loadFile('settings.html');
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

app.on('ready', () => {
  preloadSentences(); // 预加载句子数据

  mainWindow = new BrowserWindow({
    width: 800,
    height: 300,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  

  mainWindow.loadFile('index.html');
  mainWindow.setSkipTaskbar(true);
  //mainWindow.webContents.openDevTools();

  // 初次加载时发送一个随机句子
  mainWindow.webContents.once('did-finish-load', () => {
    const sentence = getRandomSentence();
    mainWindow.webContents.send('new-sentence', sentence);
    adjustWindowSize();
  });

  // 每隔 30 分钟自动更新句子
  setInterval(() => {
    const sentence = getRandomSentence();
    mainWindow.webContents.send('new-sentence', sentence);
    adjustWindowSize();
  }, 30 * 60 * 1000); // 30分钟

  // 监听手动更新请求
  ipcMain.on('manual-update', () => {
    console.log('手动更新请求收到'); // 调试输出
    const sentence = getRandomSentence();
    mainWindow.webContents.send('new-sentence', sentence);
    adjustWindowSize();
  });

  // 监听打开设置窗口的请求
  ipcMain.on('open-settings-window', () => {
    createSettingsWindow();
  });

  // 监听设置窗口关闭请求
  ipcMain.on('close-settings-window', () => {
    if (settingsWindow) {
      settingsWindow.close();
    }
  });

  // 监听背景颜色和透明度更改请求
  ipcMain.on('change-background-color', (event, color, opacity) => {
    currentBackgroundColor = color;
    const rgbaColor = `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
    mainWindow.webContents.send('update-background-color', rgbaColor);
  });

  // 监听关闭窗口的请求
  ipcMain.on('close-window', () => {
    mainWindow.close();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 调整窗口大小以适应内容
function adjustWindowSize() {
  mainWindow.webContents.executeJavaScript(`
    document.body.scrollWidth;
    document.body.scrollHeight;
  `).then(size => {
    const [width, height] = size;
    mainWindow.setSize(width, height, true);
  });
}
