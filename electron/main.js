const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config(); // Load environment variables from .env file

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

const SYSTEM_PROMPT = `
You are a helpful media encyclopedia and curator. 
When searching or recommending, you must return a VALID JSON array of objects.
Do not wrap the JSON in markdown code blocks. Just return the raw JSON array.
Each object must have the following fields:
- title: string
- directorOrAuthor: string
- cast: string[] (max 5 main actors, empty for books if not applicable)
- description: string (approx 150 words, covering theme and background)
- releaseDate: string (YYYY-MM-DD preferred, or YYYY)
- type: one of ["Book", "Movie", "TV Series", "Comic", "Short Drama", "Other"]
- isOngoing: boolean
- latestUpdateInfo: string (empty if completed)
- rating: string (e.g. "8.5/10")

Ensure data is accurate.
`;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

  // Bing Search Function
  const performBingSearch = async (query, config) => {
    if (!config || !config.apiKey) {
      return "Error: Bing Search configuration missing (API Key)";
    }
    try {
      const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5`;
      const response = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': config.apiKey }
      });
      if (!response.ok) {
        return `Bing Search failed: ${response.statusText}`;
      }
      const data = await response.json();
      if (!data.webPages || !data.webPages.value || data.webPages.value.length === 0) {
        return "No Bing results found.";
      }
      return data.webPages.value.map(item => ({
        title: item.name,
        link: item.url,
        snippet: item.snippet,
        source: 'Bing',
        image: item.openGraphImage?.contentUrl || null
      }));
    } catch (error) {
      return `Bing Search error: ${error.message}`;
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
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        return `DuckDuckGo Search failed: ${response.statusText}`;
      }
      
      const html = await response.text();
      const results = [];
      
      // Regex to find results in the HTML structure
      // Structure: <div class="result ..."> ... <a class="result__a" href="...">Title</a> ... <a class="result__snippet" ...>Snippet</a> ... </div>
      
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
         return "No DuckDuckGo results found (parsing failed or no results).";
      }
      return results;

    } catch (error) {
      return `DuckDuckGo Search error: ${error.message}`;
    }
  };

  const performWebSearch = async (query, config) => {
      if (!config || !config.enabled) return "Search disabled";
      
      switch (config.provider) {
          case 'bing':
              return await performBingSearch(query, config);
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
             return retry.choices[0].message.content;
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
