const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Expose specific capabilities to the renderer
  platform: process.platform,
  aiChat: (messages, temperature, config = {}) => ipcRenderer.invoke('ai-chat', { messages, temperature, ...config }),
  webSearch: (query, config) => ipcRenderer.invoke('web-search', { query, config }),
});
