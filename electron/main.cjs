const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config(); // Load environment variables from .env file

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}



function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset', // Native-like titlebar on macOS
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
  });
}

ipcMain.handle('web-search', async (event, { query, config }) => {
  return await performWebSearch(query, config);
});

// IPC Handler for AI Chat
ipcMain.handle('ai-chat', async (event, { messages, temperature = 0.3, apiKey: providedKey, baseURL: providedBaseURL, model: providedModel, searchConfig }) => {
  const apiKey = providedKey || process.env.MOONSHOT_API_KEY || process.env.API_KEY;
  const baseURL = providedBaseURL || "https://api.moonshot.cn/v1";
  const model = providedModel || "moonshot-v1-8k";
  
  if (!apiKey) {
    console.error('API Key is missing in Main Process');
    throw new Error('API Key is missing');
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  // Google Search Function
  const performGoogleSearch = async (query, config) => {
    if (!config || !config.apiKey || !config.cx) {
      return "Error: Google Search configuration missing (API Key or CX)";
    }
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${config.apiKey}&cx=${config.cx}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      if (!response.ok) {
        return `Google Search failed: ${response.statusText}`;
      }
      const data = await response.json();
      if (!data.items || data.items.length === 0) {
        return "No Google results found.";
      }
      return data.items.slice(0, 5).map(item => {
        const image = item.pagemap?.cse_image?.[0]?.src || null;
        // Basic filtering for non-image URLs often returned by search
        const isSocialMedia = image && (image.includes('instagram.com') || image.includes('facebook.com') || image.includes('twitter.com') || image.includes('x.com'));
        return {
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          source: 'Google',
          image: isSocialMedia ? null : image
        };
      });
    } catch (error) {
      return `Google Search error: ${error.message}`;
    }
  };

  // Serper Search Function
  const performSerperSearch = async (query, config) => {
    if (!config || !config.apiKey) {
      return "Error: Serper Search configuration missing (API Key)";
    }
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': config.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query })
      });

      if (!response.ok) {
        return `Serper Search failed: ${response.statusText}`;
      }

      const data = await response.json();
      
      if (!data.organic || data.organic.length === 0) {
        return "No Serper results found.";
      }

      return data.organic.slice(0, 5).map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        source: 'Serper',
        image: item.imageUrl || null
      }));
    } catch (error) {
      return `Serper Search error: ${error.message}`;
    }
  };

  // Yandex Search Function (XML)
  const performYandexSearch = async (query, config) => {
    if (!config || !config.apiKey || !config.user) {
      return "Error: Yandex Search configuration missing (User or Key)";
    }
    try {
      const url = `https://yandex.com/search/xml?user=${config.user}&key=${config.apiKey}&query=${encodeURIComponent(query)}&l10n=en&sortby=rlv&filter=none`;
      const response = await fetch(url);
      if (!response.ok) {
        return `Yandex Search failed: ${response.statusText}`;
      }
      const xmlText = await response.text();
      
      // Simple Regex Parsing for XML (Since we don't have a heavy XML parser)
      const results = [];
      const docRegex = /<doc>([\s\S]*?)<\/doc>/g;
      const titleRegex = /<title>([\s\S]*?)<\/title>/;
      const urlRegex = /<url>([\s\S]*?)<\/url>/;
      const snippetRegex = /<headline>([\s\S]*?)<\/headline>|<passages>([\s\S]*?)<\/passages>/; // Yandex XML structure varies, usually 'headline' or 'passages'

      let match;
      let count = 0;
      while ((match = docRegex.exec(xmlText)) !== null && count < 5) {
        const docContent = match[1];
        const titleMatch = titleRegex.exec(docContent);
        const urlMatch = urlRegex.exec(docContent);
        // Clean up XML tags from title/snippet
        const cleanText = (text) => text ? text.replace(/<[^>]+>/g, '') : '';
        
        if (titleMatch && urlMatch) {
            results.push({
                title: cleanText(titleMatch[1]),
                link: urlMatch[1],
                snippet: "Click to view content", // Yandex XML snippet parsing is complex with regex, simplified here
                source: 'Yandex'
            });
            count++;
        }
      }

      if (results.length === 0) {
        // Check for error in XML
        if (xmlText.includes('<error')) {
            const errorMatch = /<error[^>]*>([\s\S]*?)<\/error>/.exec(xmlText);
            return `Yandex API Error: ${errorMatch ? errorMatch[1] : 'Unknown error'}`;
        }
        return "No Yandex results found.";
      }
      return results;
    } catch (error) {
      return `Yandex Search error: ${error.message}`;
    }
  };

  // DuckDuckGo Search Function (HTML Scraping fallback)
  const performDuckDuckGoSearch = async (query) => {
    try {
      // Using html.duckduckgo.com which is lighter and easier to parse than the main site
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      
      if (!response.ok) {
        console.error(`DuckDuckGo Search failed: ${response.status} ${response.statusText}`);
        return `DuckDuckGo Search failed: ${response.statusText}`;
      }
      
      const html = await response.text();
      const results = [];
      
      // Improved Regex/Parsing logic
      // We'll split by "result__body" to isolate result blocks
      const blocks = html.split('class="result__body"');
      
      for (let i = 1; i < blocks.length && results.length < 5; i++) {
        const block = blocks[i];
        
        const linkMatch = /href="(.*?)"/.exec(block);
        const titleMatch = />(.*?)(?=<\/a>)/.exec(block.split('class="result__a"')[1] || '');
        const snippetMatch = />(.*?)(?=<\/a>)/.exec(block.split('class="result__snippet"')[1] || '');
        
        if (linkMatch && titleMatch) {
            // Decode HTML entities (basic)
            const decode = (str) => str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            
            results.push({
                title: decode(titleMatch[1]),
                link: linkMatch[1],
                snippet: snippetMatch ? decode(snippetMatch[1]) : '',
                source: 'DuckDuckGo'
            });
        }
      }

      if (results.length === 0) {
         console.warn("DuckDuckGo parsing found 0 results. HTML might have changed.");
         return "No DuckDuckGo results found (parsing failed or no results).";
      }
      return results;

    } catch (error) {
      console.error("DuckDuckGo Search error:", error);
      return `DuckDuckGo Search error: ${error.message}`;
    }
  };

  const performWebSearch = async (query, config) => {
      if (!config || !config.enabled) return "Search disabled";
      
      switch (config.provider) {
          case 'serper':
              return await performSerperSearch(query, config);
          case 'yandex':
              return await performYandexSearch(query, config);
          case 'duckduckgo':
              return await performDuckDuckGoSearch(query);
          case 'google':
          default:
              return await performGoogleSearch(query, config);
      }
  };

  const tools = [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for real-time information. Use this tool when you need current events, news, or specific data.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query."
            }
          },
          required: ["query"]
        }
      }
    }
  ];

  try {
    const isSearchEnabled = searchConfig && searchConfig.enabled;
    const currentTools = isSearchEnabled ? tools : undefined;
    
    // First call to LLM
    const runner = await client.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      tools: currentTools,
      tool_choice: isSearchEnabled ? "auto" : undefined,
    });

    const message = runner.choices[0].message;

    // Handle Tool Calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      const newMessages = [...messages, message];

      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'web_search' || toolCall.function.name === 'google_search') {
          const args = JSON.parse(toolCall.function.arguments);
          const searchResults = await performWebSearch(args.query, searchConfig);
          
          newMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolCall.function.name,
            content: JSON.stringify(searchResults)
          });
        }
      }

      // Second call to LLM with search results
      const finalResponse = await client.chat.completions.create({
        model: model,
        messages: newMessages,
        temperature: temperature,
      });

      return finalResponse.choices[0].message.content;
    }

    return message.content;
  } catch (error) {
    console.error('AI Chat Error:', error);
    // Fallback: If tool use fails (e.g. model doesn't support it), try without tools
    if (error.status === 400 && error.error?.message?.includes('tools')) {
         console.warn("Model does not support tools, retrying without tools...");
         try {
             const retry = await client.chat.completions.create({
                model: model,
                messages: messages,
                temperature: temperature
             });
             return `[System Warning: The model '${model}' does not support web search. Responding without search.]\n\n` + retry.choices[0].message.content;
         } catch (retryError) {
             throw retryError;
         }
    }
    throw error;
  }
});

app.whenReady().then(() => {
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
