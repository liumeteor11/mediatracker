import OpenAI from "openai";
import { MediaType, MediaItem } from "../types/types";
import { v4 as uuidv4 } from 'uuid';
import { useAIStore } from "../store/useAIStore";
import i18n from '../i18n';

// Define Window interface to include Electron API
declare global {
  interface Window {
    electron?: {
      platform: string;
      aiChat: (messages: any[], temperature?: number, config?: any) => Promise<string>;
      webSearch: (query: string, config: any) => Promise<any[] | string>;
    };
  }
}

const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY;

// A curated list of placeholders to serve as "Posters" when real ones aren't found
const getPlaceholder = (type: string = 'Media') => {
  return `https://placehold.co/600x900/1a1a1a/FFF?text=${encodeURIComponent(type)}`;
};

const fetchPosterFromOMDB = async (title: string, year: string): Promise<string | undefined> => {
  if (!OMDB_API_KEY) return undefined;

  try {
    const cleanYear = year ? year.split('-')[0].trim() : '';
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&y=${cleanYear}&apikey=${OMDB_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.Response === "True" && data.Poster && data.Poster !== "N/A") {
      return data.Poster;
    }
  } catch (error) {
    console.warn(`Failed to fetch poster for ${title} from OMDB`, error);
  }
  return undefined;
};



// Helper for client-side search in Web Mode
const performClientSideSearch = async (query: string, force: boolean = false): Promise<string> => {
    const { 
        enableSearch, 
        searchProvider, 
        getDecryptedGoogleKey, 
        googleSearchCx,
        getDecryptedSerperKey,
        getDecryptedYandexKey,
        yandexSearchLogin
    } = useAIStore.getState();

    if (!enableSearch && !force) return "";

    const searchConfig = {
        enabled: true,
        provider: searchProvider,
        apiKey: searchProvider === 'google' ? getDecryptedGoogleKey() : 
                searchProvider === 'serper' ? getDecryptedSerperKey() :
                searchProvider === 'yandex' ? getDecryptedYandexKey() : undefined,
        cx: googleSearchCx,
        user: yandexSearchLogin
    };

    try {
        if (window.electron && window.electron.webSearch) {
            // Electron Mode
            const results = await window.electron.webSearch(query, searchConfig);
            if (Array.isArray(results)) {
                 return JSON.stringify(results.slice(0, 5));
            }
            return typeof results === 'string' ? results : "";
        } else {
             // Web Mode (Limited)
             // We can only reliably do Google Custom Search client-side if key is provided
             // Serper/Yandex usually require backend proxy to hide keys or CORS, but here we are client-only demo
             if (searchProvider === 'google') {
                 const apiKey = getDecryptedGoogleKey();
                 if (apiKey && googleSearchCx) {
                    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${googleSearchCx}&q=${encodeURIComponent(query)}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.items) {
                            return JSON.stringify(data.items.map((item: any) => ({
                                title: item.title,
                                snippet: item.snippet,
                                link: item.link
                            })).slice(0, 5));
                        }
                    }
                }
            }

            // Serper (Web Mode)
            if (searchProvider === 'serper') {
                const apiKey = getDecryptedSerperKey();
                if (apiKey) {
                    const response = await fetch('https://google.serper.dev/search', {
                        method: 'POST',
                        headers: {
                            'X-API-KEY': apiKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ q: query })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.organic) {
                                return JSON.stringify(data.organic.map((item: any) => ({
                                    title: item.title,
                                    snippet: item.snippet,
                                    link: item.link
                                })).slice(0, 5));
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Search failed", e);
    }
    return "";
};

const callAI = async (messages: any[], temperature: number = 0.7, options: { forceSearch?: boolean } = {}): Promise<string> => {
    const state = useAIStore.getState();
    const { 
        provider,
        baseUrl: baseURL, 
        model, 
        enableSearch,
        searchProvider,
        getDecryptedGoogleKey,
        googleSearchCx,
        getDecryptedSerperKey,
        getDecryptedYandexKey,
        yandexSearchLogin
    } = state;

    // Decrypt the API Key
    let apiKey = state.getDecryptedApiKey();

    // Fallback to env var if not set in store (Development convenience)
    if (!apiKey && process.env.MOONSHOT_API_KEY && process.env.MOONSHOT_API_KEY !== 'undefined') {
        apiKey = process.env.MOONSHOT_API_KEY;
    }

    // Electron Native AI
    if (window.electron && window.electron.aiChat) {
        try {
            const searchConfig = {
                enabled: options.forceSearch || enableSearch,
                provider: searchProvider,
                apiKey: searchProvider === 'google' ? getDecryptedGoogleKey() : 
                        searchProvider === 'serper' ? getDecryptedSerperKey() :
                        searchProvider === 'yandex' ? getDecryptedYandexKey() : undefined,
                cx: googleSearchCx,
                user: yandexSearchLogin
            };

            return await window.electron.aiChat(messages, temperature, {
                model,
                baseURL,
                apiKey,
                searchConfig // Pass the full config object
            });
        } catch (e) {
            console.error("Electron AI Chat failed:", e);
            return "";
        }
    }

    // Web Mode (Direct API Call)
    if (!apiKey) {
        // toast.error("API Key is missing");
        return "";
    }

    let finalBaseURL = baseURL || "https://api.moonshot.cn/v1";

    // Proxy handling for Web Mode to avoid CORS
    if (!window.electron && finalBaseURL.includes('api.moonshot.cn')) {
        finalBaseURL = `${window.location.origin}/api/moonshot/v1`;
    } else if (!window.electron && finalBaseURL.startsWith('/')) {
        finalBaseURL = `${window.location.origin}${finalBaseURL}`;
    }

    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: finalBaseURL,
        dangerouslyAllowBrowser: true
    });

    try {
        // Define tools based on provider
        let tools: any[] = [];
        const shouldSearch = enableSearch || options.forceSearch;

        if (shouldSearch) {
            // Unified Search Tool Strategy
            // We use a standard "web_search" tool definition for ALL providers (including Moonshot).
            // This allows us to:
            // 1. Avoid Moonshot's strict "$web_search" function name validation errors (400 Bad Request).
            // 2. Control the search source using our local 'performClientSideSearch' (Serper, Google, etc.).
            // 3. Ensure consistent behavior across providers.
            tools = [
                {
                    type: "function",
                    function: {
                        name: "web_search",
                        description: "Search the internet for real-time information. Use this to get the latest media releases, news, and updates.",
                        parameters: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "The search query"
                                }
                            },
                            required: ["query"]
                        }
                    }
                }
            ];
        }

        let currentMessages = [...messages];
        let turnCount = 0;
        const MAX_TURNS = 5;

        while (turnCount < MAX_TURNS) {
            let completion;
            try {
                // Standard OpenAI SDK call for ALL providers (including Moonshot)
                // Since we are using standard 'web_search' tool, we don't need the special fetch hack anymore.
                completion = await client.chat.completions.create({
                    model: model || (provider === 'moonshot' ? "kimi-latest" : "gpt-3.5-turbo"),
                    messages: currentMessages,
                    temperature: temperature,
                    tools: tools.length > 0 ? tools : undefined,
                    tool_choice: tools.length > 0 ? "auto" : undefined,
                });
            } catch (apiError: any) {
                console.error("AI Chat API failed", apiError);
                // Retry once if it's a 429
                if (apiError.status === 429) {
                    console.warn("Rate limit hit, waiting 2s and retrying...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                     try {
                        completion = await client.chat.completions.create({
                            model: model || (provider === 'moonshot' ? "kimi-latest" : "gpt-3.5-turbo"),
                            messages: currentMessages,
                            temperature: temperature,
                            tools: tools.length > 0 ? tools : undefined,
                            tool_choice: tools.length > 0 ? "auto" : undefined,
                        });
                     } catch (retryError) {
                         throw retryError;
                     }
                } else {
                    throw apiError;
                }
            }

            const message = completion.choices[0].message;

            // If the model wants to call a tool
            if (message.tool_calls && message.tool_calls.length > 0) {
                currentMessages.push(message); // Add assistant's tool call message

                // Execute tool calls
                for (const toolCall of message.tool_calls) {
                    if (toolCall.type === 'function' && toolCall.function.name === '$web_search') {
                        // For Kimi's $web_search, we simply echo the arguments back to the model
                        // The model will perform the search internally
                        currentMessages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: "$web_search",
                            content: toolCall.function.arguments 
                        });
                        continue;
                    }

                    // Standard Web Search Handling
                    if (toolCall.type === 'function' && toolCall.function.name === 'web_search') {
                        let query = "";
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            query = args.query;
                        } catch (parseError) {
                            console.warn("Failed to parse tool arguments", parseError);
                        }

                        if (query) {
                            const searchResult = await performClientSideSearch(query, options.forceSearch);
                            currentMessages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: searchResult || "No relevant results found."
                            });
                        } else {
                             currentMessages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: "Error: Missing query parameter."
                            });
                        }
                    }
                }
                turnCount++;
            } else {
                // No tool calls, return final response
                return message.content || "";
            }
        }
        
        return ""; // Exceeded max turns
    } catch (e) {
        console.error("Direct AI Chat failed:", e);
        return "";
    }
};

export const translateToEnglish = async (text: string): Promise<string> => {
  if (!text || !text.trim()) return "";
  const messages = [
    { role: "system", content: "You are a translator. Translate the following text to English. Return only the translated text, nothing else. If the text is already in English, return it as is." },
    { role: "user", content: text }
  ];
  // Use a low temperature for deterministic translation
  return await callAI(messages, 0.1);
};

export const searchMedia = async (query: string, type?: MediaType | 'All'): Promise<MediaItem[]> => {
  if (!query.trim()) return [];

  const today = new Date().toISOString().split('T')[0];
  const isChinese = i18n.language.startsWith('zh');

  let searchContext = "";
  try {
      // const injectedQuery = isChinese
      //   ? `${query} 最新 ${type && type !== 'All' ? type : '电影 电视剧 书籍 漫画 短剧'}`
      //   : `${query} latest ${type && type !== 'All' ? type : 'movies tv series books comics short dramas'}`;
      // const sc = await performClientSideSearch(injectedQuery, true);
      // if (sc) {
      //   searchContext = sc;
      //   // DIRECT SEARCH MODE: Bypass AI and return search results directly
      //   console.log("Direct Search Mode: Returning search results directly without AI processing.");
      //   return await createFallbackItemsFromContext(searchContext, 20);
      // } else {
      //    console.warn("Direct Search Mode: No results found via search provider.");
      //    return [];
      // }
  } catch (e) {
      console.error("Direct Search Mode failed", e);
      // return [];
  }

  // AI Processing RE-ENABLED
  
  const { systemPrompt, provider } = useAIStore.getState();
  
  let userPrompt = "";

  if (provider === 'moonshot') {
      // For Moonshot, we use our manual "web_search" tool, so we treat it like other providers
      // but with specific instructions to ensure it uses the tool.
      searchContext = ""; // Let the AI fetch context via tool
      if (isChinese) {
          userPrompt = `搜索符合以下查询的媒体作品: "${query}"。`;
          if (type && type !== 'All') {
              userPrompt += ` 严格限制结果类型为: "${type}"。`;
          } else {
              userPrompt += ` (包括书籍、电影、电视剧、漫画、短剧)`;
          }
          userPrompt += `\n[重要] 必须使用提供的联网搜索工具 (web_search) 来获取最新信息。请搜索关键词: "${query} 最新信息"。\n仅从搜索结果中选择并返回有效JSON数组。如果没有匹配项，请返回空数组。确保上映日期准确。`;
      } else {
          userPrompt = `Search for media works matching the query: "${query}".`;
          if (type && type !== 'All') {
              userPrompt += ` Strictly limit results to type: "${type}".`;
          } else {
              userPrompt += ` (books, movies, TV series, comics, short dramas)`;
          }
          userPrompt += `\n[IMPORTANT] You MUST use the provided web search tool (web_search) to get the latest information. Search query: "${query} latest info".\nReturn ONLY a valid JSON array. If nothing matches, return an empty array. Ensure release dates are accurate.`;
      }
  } else {
      // Standard prompt for other providers
      if (isChinese) {
          userPrompt = `搜索符合以下查询的媒体作品: "${query}"。`;
          if (type && type !== 'All') {
              userPrompt += ` 严格限制结果类型为: "${type}"。`;
          } else {
              userPrompt += ` (包括书籍、电影、电视剧、漫画、短剧)`;
          }
          userPrompt += `\n请利用你的联网搜索工具或参考以下搜索结果来获取准确信息：\n${searchContext}\n仅从搜索结果中选择并返回有效JSON数组。如果没有匹配项，请返回空数组。确保上映日期准确。`;
      } else {
          userPrompt = `Search for media works matching the query: "${query}".`;
          if (type && type !== 'All') {
              userPrompt += ` Strictly limit results to type: "${type}".`;
          } else {
              userPrompt += ` (books, movies, TV series, comics, short dramas)`;
          }
          userPrompt += `\nUse your web search tool or refer to the following search results to verify info:\n${searchContext}\nReturn ONLY a valid JSON array. If nothing matches, return an empty array. Ensure release dates are accurate.`;
      }
  }

  const messages = [
    { role: "system", content: systemPrompt + (isChinese ? " 请务必使用JSON格式返回。不要使用Markdown代码块。只返回JSON数组。" : " Please return strictly valid JSON. Do not use markdown code blocks. Return ONLY a JSON array.") },
    { role: "user", content: userPrompt }
  ];

  // Force search to allow the AI to verify dates if needed
  const text = await callAI(messages, 0.1, { forceSearch: true });
  if (!text) return [];

  // Improved JSON extraction
  let jsonStr = "";
  const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonArrayMatch) {
      jsonStr = jsonArrayMatch[0];
  } else {
      jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  let rawData: Omit<MediaItem, 'id' | 'posterUrl'>[] = [];

  // Quick check if it looks like JSON
  if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
      console.warn("AI returned non-JSON response:", text);
      return [];
  }

  try {
      rawData = JSON.parse(jsonStr);
  } catch (e) {
      console.error("Failed to parse JSON:", e);
      // Attempt to recover if it's a truncated JSON array
      const lastBracket = jsonStr.lastIndexOf('}');
      if (lastBracket > 0) {
        try {
          const recovered = jsonStr.substring(0, lastBracket + 1) + ']';
          rawData = JSON.parse(recovered);
        } catch (retryError) {
          console.error("Failed to recover JSON:", retryError);
          return [];
        }
      } else {
        return [];
      }
  }





  // Enhance with IDs and Posters
  const results = await Promise.all(rawData.map(async (item) => {
    const id = uuidv4();
    let posterUrl = await fetchPosterFromSearch(item.title, item.releaseDate ? item.releaseDate.split('-')[0] : '', item.type);
    
    if (!posterUrl) {
         posterUrl = await fetchPosterFromOMDB(item.title, item.releaseDate);
    }

    return {
      ...item,
      id,
      posterUrl: posterUrl || getPlaceholder(item.type || 'Media'),
      userRating: 0,
      status: 'To Watch',
      addedAt: new Date().toISOString()
    } as MediaItem;
  }));

  return results;
};

export const checkUpdates = async (items: MediaItem[]): Promise<{ id: string; latestUpdateInfo: string; isOngoing: boolean }[]> => {
  if (items.length === 0) return [];
  
  const today = new Date().toISOString().split('T')[0];
  // Create a mapping of title -> id to map results back
  const titleToId = new Map(items.map(i => [i.title.toLowerCase(), i.id]));
  
  const queryList = items.map(i => `"${i.title}" (${i.type})`).join(', ');
  const isChinese = i18n.language.startsWith('zh');
  let userPrompt = "";
  
  if (isChinese) {
      userPrompt = `请提供以下作品的最新更新状态: ${queryList}。
      请提供截至今天的最新一集/一章信息。
      返回一个包含以下对象的JSON数组:
      - title: 字符串 (完全匹配)
      - latestUpdateInfo: 字符串 (例如 "第4季 第8集" 或 "第1052章")
      - isOngoing: 布尔值 (如果仍在更新则为 true)
      `;
  } else {
      userPrompt = `Please check the latest status for: ${queryList}. 
      Provide the absolute latest episode/chapter as of today.
      Return a JSON array with objects containing:
      - title: string (exact match)
      - latestUpdateInfo: string (e.g. "Season 4 Episode 8" or "Chapter 1052")
      - isOngoing: boolean (true if still updating)
      `;
  }

  const messages = [
    { role: "system", content: isChinese ? "你是一个媒体更新追踪助手。仅返回原始JSON数组。不要使用Markdown。" : "You are a media update tracker. Return ONLY raw JSON array. No markdown." },
    { role: "user", content: userPrompt }
  ];

  const text = await callAI(messages, 0.1);
  if (!text) return [];

  // Improved JSON extraction
  let jsonStr = "";
  const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonArrayMatch) {
      jsonStr = jsonArrayMatch[0];
  } else {
      jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  let updates: any[] = [];

  if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
      console.warn("AI returned non-JSON response (updates):", text);
      return [];
  }

  try {
      updates = JSON.parse(jsonStr);
  } catch (e) {
      console.error("Failed to parse updates JSON", e);
      return [];
  }

  // Map back to IDs
  const results = updates.map(u => {
      const id = titleToId.get(u.title.toLowerCase());
      if (!id) return null;
      return {
          id,
          latestUpdateInfo: u.latestUpdateInfo,
          isOngoing: u.isOngoing
      };
  }).filter(Boolean) as { id: string; latestUpdateInfo: string; isOngoing: boolean }[];

  return results;
};



// New Helper: Fetch Poster from Search
export const fetchPosterFromSearch = async (title: string, year: string, type: string = 'movie'): Promise<string | undefined> => {
    const { 
        enableSearch, 
        searchProvider, 
        getDecryptedGoogleKey, 
        googleSearchCx, 
        getDecryptedSerperKey,
        getDecryptedYandexKey,
        yandexSearchLogin
    } = useAIStore.getState();

    if (!enableSearch) return undefined;
    
    // Yandex and DuckDuckGo do not support image fetching in this implementation
    if (searchProvider === 'yandex' || searchProvider === 'duckduckgo') {
        return undefined;
    }

    // Construct a more specific query
    const isChinese = i18n.language.startsWith('zh');
    let query = "";
    
    if (isChinese) {
        // Localized query for better results with Chinese titles
        let typeTerm = "官方海报 竖版 高清";
        switch(type.toLowerCase()) {
            case 'movie': case '电影': typeTerm = "电影海报 竖版"; break;
            case 'tv series': case '电视剧': typeTerm = "电视剧海报 竖版"; break;
            case 'book': case '书籍': typeTerm = "书封面"; break;
            case 'comic': case '漫画': typeTerm = "漫画封面"; break;
            case 'music': case '音乐': typeTerm = "专辑封面"; break;
            case 'short drama': case '短剧': typeTerm = "短剧海报 竖版"; break;
        }
        // Try without year first to avoid mismatch if year is wrong
        query = `${title} ${typeTerm}`; 
    } else {
        query = `"${title}" ${type} poster high resolution`;
    }
    
    const searchConfig = {
        enabled: true,
        provider: searchProvider,
        apiKey: searchProvider === 'google' ? getDecryptedGoogleKey() : 
                searchProvider === 'serper' ? getDecryptedSerperKey() :
                searchProvider === 'yandex' ? getDecryptedYandexKey() : undefined,
        cx: googleSearchCx,
        user: yandexSearchLogin
    };

    try {
        let results: any = [];

        if (window.electron && window.electron.webSearch) {
            results = await window.electron.webSearch(query, searchConfig);
        } else {
            // Web Mode
            if (searchProvider === 'google') {
                const apiKey = getDecryptedGoogleKey();
                if (apiKey && googleSearchCx) {
                    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${googleSearchCx}&q=${encodeURIComponent(query)}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.items) {
                            results = data.items.map((item: any) => ({
                                image: item.pagemap?.cse_image?.[0]?.src
                            }));
                        }
                    }
                }
            }
            
            // Serper (Web Mode)
            if (searchProvider === 'serper') {
                 const apiKey = getDecryptedSerperKey();
                 if (apiKey) {
                     try {
                        const response = await fetch('https://google.serper.dev/images', {
                            method: 'POST',
                            headers: {
                                'X-API-KEY': apiKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ q: query, num: 10 })
                        });
                        
                        if (response.status === 403) {
                             console.error("Serper API 403 Forbidden: Invalid API Key or Quota Exceeded.");
                        } else if (response.ok) {
                            const data = await response.json();
                            if (data.images) {
                                results = data.images.map((img: any) => ({ image: img.imageUrl }));
                            }
                        }
                     } catch (e) {
                         console.warn("Client-side Serper image search failed", e);
                     }
                 }
            }
        }

        if (Array.isArray(results)) {
             // Filter for valid image URLs and avoid known blocking domains
             const validImage = results.find((r: any) => {
                 if (!r.image) return false;
                 const url = r.image.toLowerCase();
                 // Filter out social media pages that are not direct images
                 if (url.includes('instagram.com') || url.includes('facebook.com') || url.includes('twitter.com') || url.includes('x.com')) {
                     return false;
                 }
                 // Allow Pinterest as it often has good posters, but try to prefer others if possible?
                 // For now, let's allow it as it's better than nothing.
                 return true;
             });
             if (validImage) return validImage.image;
        }

        // Fallback: If localized search failed, try generic English search
        if (isChinese) {
            console.log(`Localized poster search failed for "${title}", trying generic search...`);
            const genericQuery = `"${title}" ${type} poster high resolution`;
            
            if (window.electron && window.electron.webSearch) {
                 const fallbackResults = await window.electron.webSearch(genericQuery, searchConfig);
                 if (Array.isArray(fallbackResults)) {
                     const valid = fallbackResults.find((r: any) => {
                         if (!r.image) return false;
                         const url = r.image.toLowerCase();
                         return !url.includes('instagram.com') && 
                                !url.includes('facebook.com') && 
                                !url.includes('twitter.com') && 
                                !url.includes('x.com');
                     });
                     if (valid) return valid.image;
                 }
            } else if (searchProvider === 'serper' && getDecryptedSerperKey()) {
                 try {
                     const response = await fetch('https://google.serper.dev/images', {
                        method: 'POST',
                        headers: {
                            'X-API-KEY': getDecryptedSerperKey(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ q: genericQuery, num: 5 })
                    });
                    
                    if (response.status === 403) {
                         console.error("Serper API 403 Forbidden (Fallback): Invalid API Key or Quota Exceeded.");
                    } else if (response.ok) {
                        const data = await response.json();
                        if (data.images && data.images.length > 0) {
                            // Basic filter again
                            const valid = data.images.find((img: any) => !img.imageUrl.includes('pinterest') && !img.imageUrl.includes('pinimg'));
                            if (valid) return valid.imageUrl;
                        }
                    }
                 } catch (e) {
                     console.warn("Serper fallback search failed", e);
                 }
             }
        }

    } catch (e) {
        console.warn(`Failed to fetch poster from search for ${title}`, e);
    }

    // Final fallback: Try OMDB if available
    return await fetchPosterFromOMDB(title, year);
};

// Helper to clean title and extract year from search result
const processSearchResult = (title: string, snippet: string): { title: string, year: string, type: MediaType } => {
    let cleanTitle = title
        .replace(/ - .*$/, '')
        .replace(/ \| .*$/, '')
        .replace(/_.*$/, '') // Remove underscores common in file names or titles
        .replace(/\.\.\.$/, '') // Remove trailing dots
        .trim();

    // Extract year (prioritize title, then snippet)
    let year = new Date().getFullYear().toString();
    const yearMatch = title.match(/\b(202[3-6])\b/) || snippet.match(/\b(202[3-6])\b/);
    if (yearMatch) {
        year = yearMatch[1];
        // Remove year from title if present in parentheses to clean it up
        cleanTitle = cleanTitle.replace(new RegExp(`\\(${year}\\)`), '').trim();
    }

    // Infer type
    let type: MediaType = MediaType.MOVIE; // Default
    const lowerText = (title + " " + snippet).toLowerCase();
    if (lowerText.includes('season') || lowerText.includes('series') || lowerText.includes('episode') || lowerText.includes('tv show') || lowerText.includes('电视剧') || lowerText.includes('剧集')) {
        type = MediaType.TV_SERIES;
    } else if (lowerText.includes('game') || lowerText.includes('游戏')) {
        type = MediaType.OTHER; // Games might be "Other" or new type, but let's stick to existing types
    } else if (lowerText.includes('book') || lowerText.includes('novel') || lowerText.includes('书籍') || lowerText.includes('小说')) {
        type = MediaType.BOOK;
    }

    return { title: cleanTitle, year, type };
};

const createFallbackItemsFromContext = async (searchContext: string, limit: number = 10): Promise<MediaItem[]> => {
    try {
        const arr = JSON.parse(searchContext);
        if (!Array.isArray(arr) || arr.length === 0) return [];
        
        // Deduplicate by title roughly
        const uniqueMap = new Map();
        arr.forEach((item: any) => {
            const { title } = processSearchResult(item.title || '', '');
            if (!uniqueMap.has(title)) {
                uniqueMap.set(title, item);
            }
        });
        
        const pick = Array.from(uniqueMap.values()).slice(0, limit);
        
        return await Promise.all(pick.map(async (r: any) => {
            const { title, year, type } = processSearchResult(r.title || '', r.snippet || '');
            const id = uuidv4();
            const poster = await fetchPosterFromSearch(title, year, type);
            
            return {
                id,
                title,
                directorOrAuthor: '',
                cast: [],
                description: r.snippet || '',
                releaseDate: year,
                type,
                isOngoing: type === 'TV Series',
                latestUpdateInfo: '',
                rating: '',
                posterUrl: poster || getPlaceholder(type),
                userRating: 0,
                status: 'To Watch',
                addedAt: new Date().toISOString()
            } as MediaItem;
        }));
    } catch (e) {
        console.warn("Fallback creation failed", e);
        return [];
    }
};

export const getTrendingMedia = async (): Promise<MediaItem[]> => {
  const { systemPrompt, trendingPrompt, provider } = useAIStore.getState();
  const dateObj = new Date();
  const today = dateObj.toISOString().split('T')[0];
  const currentYear = dateObj.getFullYear();
  const currentMonth = dateObj.getMonth() + 1;
  const monthStr = `${currentYear}年${currentMonth}月`;
  
  const isChinese = i18n.language.startsWith('zh');
  
  let searchContext = "";

  // 1. Perform Manual Search First (ONLY if no custom prompt is set)
  // If a custom prompt is set, we rely on the AI to call the search tool with relevant keywords
  if (!trendingPrompt || !trendingPrompt.trim()) {
      // Use Year+Month for broader hits, and specific "latest" keywords
      const searchQueries = isChinese 
          ? [`最新上映电影电视剧排行榜 ${monthStr}`, `最近热门影视作品推荐 ${currentYear}`]
          : [`new movie releases ${monthStr} ${currentYear}`, `best new tv shows ${monthStr} ${currentYear}`];

      try {
          // Search for the first query
          const searchResult = await performClientSideSearch(searchQueries[0], true);
          if (searchResult) {
              searchContext = searchResult;
          } else {
               // Fallback to second query if first returns nothing
               const secondResult = await performClientSideSearch(searchQueries[1], true);
               if (secondResult) searchContext = secondResult;
          }
      } catch (e) {
          console.warn("Manual search in getTrendingMedia failed", e);
      }
  }

  // AI Processing RE-ENABLED
  try {
      if (searchContext) {
          const parsedSC = JSON.parse(searchContext);
          if (!Array.isArray(parsedSC) || parsedSC.length === 0) {
              searchContext = "";
          }
      }
  } catch {
      searchContext = "";
  }

  let userPrompt = "";

  if (trendingPrompt && trendingPrompt.trim()) {
      userPrompt = trendingPrompt;
      // Enforce tool usage for custom prompts
      userPrompt += isChinese 
        ? `\n\n[系统提示] 当前日期: ${today}。为了确保推荐内容的实时性和准确性，请务必使用提供的联网搜索工具 (web_search) 来获取最新信息，而不是仅依赖内部知识。`
        : `\n\n[System Note] Today's Date: ${today}. To ensure recommendations are real-time and accurate, you MUST use the provided 'web_search' tool to fetch the latest information, rather than relying solely on internal knowledge.`;
  } else if (provider === 'moonshot') {
     // For Moonshot, we use our manual "web_search" tool
     searchContext = "";
     if (isChinese) {
         userPrompt = `今天是 ${today}。请推荐4部在最近2个月内更新或上映的热门电影、电视剧或动漫。
         
         [重要] 必须使用提供的联网搜索工具 (web_search) 来获取最新信息。请搜索关键词: "最新热门电影电视剧 ${monthStr}"。
         
         要求：
         1. 必须是 **最近2个月内** (例如 ${monthStr} 或上个月) 有更新或上映的作品。
         2. **必须** 基于联网搜索结果进行推荐。
         3. 严禁推荐几年前的老片，除非它最近有新季度更新。
         4. releaseDate 字段必须准确。如果是电视剧，请填写 **最新一季** 的首播日期。
         5. 返回字段中的 latestUpdateInfo 必须准确（例如 "第2季 第5集" 或 "已完结"）。
         6. 确保上映日期真实准确，不要捏造未来的日期，除非确有官方定档信息。`;
     } else {
         userPrompt = `Today is ${today}. Recommend 4 trending movies, TV series, or dramas that have been updated or released within the last 2 months.
         
         [IMPORTANT] You MUST use the provided web search tool (web_search) to get the latest information. Search query: "trending movies tv series ${monthStr}".
         
         Requirements:
         1. Must be updated or released within the **last 2 months**.
         2. **MUST** prioritize selection from web search results.
         3. Do NOT recommend old content unless it has a very recent new season.
         4. releaseDate MUST be accurate. For TV Series, use the premiere date of the **LATEST SEASON**.
         5. Ensure latestUpdateInfo is accurate.
         6. Ensure release dates are factual.`;
     }
  } else if (isChinese) {
    userPrompt = `今天是 ${today}。请推荐4部在最近2个月内更新或上映的热门电影、电视剧或动漫。
    
    ${searchContext ? `[重要] 参考以下搜索结果进行推荐（这是实时的网络搜索结果）：
    ${searchContext}
    
    要求：
    1. 必须是 **最近2个月内** (例如 ${monthStr} 或上个月) 有更新或上映的作品。
    2. **必须** 从上述搜索结果中优先选择。如果搜索结果中有热门作品，直接使用。` : 
    `[重要] 请务必使用联网搜索工具 (web_search) 获取 "最新热门电影电视剧 ${monthStr}" 的信息。
    
    要求：
    1. 必须是 **最近2个月内** (例如 ${monthStr} 或上个月) 有更新或上映的作品。`}
    3. 如果搜索结果不足，请确保你推荐的作品确实是近期（2024-2025年）的高热度作品。
    4. 严禁推荐几年前的老片，除非它最近有新季度更新。
    5. releaseDate 字段必须准确。如果是电视剧，请填写 **最新一季** 的首播日期。
    6. 返回字段中的 latestUpdateInfo 必须准确（例如 "第2季 第5集" 或 "已完结"）。
    7. 确保上映日期真实准确，不要捏造未来的日期，除非确有官方定档信息。如果日期不确定，请留空或填写年份。`;
  } else {
    userPrompt = `Today is ${today}. Recommend 4 trending movies, TV series, or dramas that have been updated or released within the last 2 months.
    
    ${searchContext ? `[IMPORTANT] Refer to the following search results (Real-time data):
    ${searchContext}
    
    Requirements:
    1. Must be updated or released within the **last 2 months**.
    2. **MUST** prioritize selection from the search results above.` : 
    `[IMPORTANT] You MUST use the provided web search tool (web_search) to get the latest information. Search query: "trending movies tv series ${monthStr}".
    
    Requirements:
    1. Must be updated or released within the **last 2 months**.
    2. Use your knowledge to find the most trending recent releases.`}
    3. If search results are insufficient, ensure recommendations are genuinely recent (2024-2025) and trending.
    4. Do NOT recommend old content unless it has a very recent new season.
    5. releaseDate MUST be accurate. For TV Series, use the premiere date of the **LATEST SEASON**.
    6. Ensure latestUpdateInfo is accurate.
    7. Ensure release dates are factual. Do not invent future dates unless officially announced.`;
  }

  // Fallback instructions if search fails
  userPrompt += `\n\nIMPORTANT: ALWAYS return a valid JSON array, even if empty or with fewer items. Do NOT return markdown text or explanations outside the JSON.`;

  const messages = [
    { role: "system", content: systemPrompt + (isChinese ? " 请务必使用JSON格式返回。不要使用Markdown代码块。只返回JSON数组。" : " Please return strictly valid JSON. Do not use markdown code blocks. Return ONLY a JSON array.") },
    { role: "user", content: userPrompt }
  ];

  const text = await callAI(messages, 0.1, { forceSearch: true }); 
  if (!text) return [];

  // Improved JSON extraction
  let jsonStr = "";
  const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonArrayMatch) {
      jsonStr = jsonArrayMatch[0];
  } else {
      jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  let rawData: Omit<MediaItem, 'id' | 'posterUrl'>[] = [];

  // Quick check if it looks like JSON
  if (!jsonStr.startsWith('[') && !jsonStr.startsWith('{')) {
      const fb = await createFallbackItemsFromContext(searchContext);
      if (fb.length > 0) return fb;
      return [];
  }

  try {
      rawData = JSON.parse(jsonStr);
  } catch (e) {
      console.error("Failed to parse JSON:", e);
      // Attempt to recover if it's a truncated JSON array
      const lastBracket = jsonStr.lastIndexOf('}');
      if (lastBracket > 0) {
        try {
          const recovered = jsonStr.substring(0, lastBracket + 1) + ']';
          rawData = JSON.parse(recovered);
        } catch (retryError) {
          console.error("Failed to recover JSON:", retryError);
          return [];
        }
      } else {
        const fb = await createFallbackItemsFromContext(searchContext);
        if (fb.length > 0) return fb;
        return [];
      }
  }

  // Enhance with IDs and Posters
  const results = await Promise.all(rawData.map(async (item) => {
    const id = uuidv4();
    let posterUrl = await fetchPosterFromSearch(item.title, item.releaseDate ? item.releaseDate.split('-')[0] : '', item.type);
    
    if (!posterUrl) {
         posterUrl = await fetchPosterFromOMDB(item.title, item.releaseDate);
    }

    return {
      ...item,
      id,
      posterUrl: posterUrl || getPlaceholder(item.type || 'Media'),
      userRating: 0,
      status: 'To Watch',
      addedAt: new Date().toISOString()
    } as MediaItem;
  }));

  if (results.length === 0) {
      return await createFallbackItemsFromContext(searchContext);
  }
  return results;
  // */
};

export const getAIDate = async (): Promise<string> => {
    const today = new Date().toISOString().split('T')[0];
    const currentLang = i18n.language.split('-')[0]; // 'en' or 'zh'
    const cacheKeyDate = `media_tracker_ai_date_${currentLang}`;
    const cacheKeyContent = `media_tracker_ai_date_content_${currentLang}`;
    
    const cachedDate = localStorage.getItem(cacheKeyDate);
    const cachedContent = localStorage.getItem(cacheKeyContent);

    if (cachedDate === today && cachedContent) {
        console.log("[getAIDate] Using cached date:", cachedContent);
        return cachedContent;
    }

    const isChinese = currentLang === 'zh';
    const systemPrompt = isChinese ? "你是一个报时助手。" : "You are a time announcement assistant.";
    const userPrompt = isChinese 
        ? `今天是 ${today}。请告诉我今天的日期，并附带一句简短的关于电影或生活的美好寄语（20字以内）。格式：YYYY年MM月DD日 | 寄语`
        : `Today is ${today}. Please tell me today's date followed by a very short inspiring quote about movies or life (max 10 words). Format: YYYY-MM-DD | Quote`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    try {
        console.log("[getAIDate] Calling AI...");
        const text = await callAI(messages, 0.7);
        if (text) {
            const cleanText = text.replace(/"/g, '').trim();
            console.log("[getAIDate] Success:", cleanText);
            localStorage.setItem(cacheKeyDate, today);
            localStorage.setItem(cacheKeyContent, cleanText);
            return cleanText;
        }
    } catch (e) {
        console.warn("[getAIDate] Failed to get AI date", e);
    }
    
    return today;
};