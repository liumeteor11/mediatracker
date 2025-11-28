import OpenAI from "openai";
import { MediaType, MediaItem } from "../types/types";
import { v4 as uuidv4 } from 'uuid';
import { useAIStore } from "../store/useAIStore";

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

const OMDB_API_KEY = process.env.VITE_OMDB_API_KEY;

// A curated list of placeholders to serve as "Posters" when real ones aren't found
const CINEMATIC_IMAGES = [
  "https://placehold.co/600x900/1a1a1a/FFF?text=Cinema", 
  "https://placehold.co/600x900/2b2b2b/FFF?text=Sci-Fi", 
  "https://placehold.co/600x900/3c3c3c/FFF?text=Story", 
  "https://placehold.co/600x900/4d4d4d/FFF?text=Abstract", 
  "https://placehold.co/600x900/5e5e5e/FFF?text=Light", 
  "https://placehold.co/600x900/6f6f6f/FFF?text=Retro", 
  "https://placehold.co/600x900/808080/FFF?text=Gradient", 
  "https://placehold.co/600x900/919191/FFF?text=Liquid", 
  "https://placehold.co/600x900/a2a2a2/FFF?text=Shelf", 
  "https://placehold.co/600x900/b3b3b3/FFF?text=Making", 
];

const getRandomPoster = (id: string) => {
  const index = id.charCodeAt(0) % CINEMATIC_IMAGES.length;
  return CINEMATIC_IMAGES[index];
};

const fetchPosterFromOMDB = async (title: string, year: string, id: string): Promise<string> => {
  if (!OMDB_API_KEY) return getRandomPoster(id);

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
  return getRandomPoster(id);
};

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
- type: one of ["Book", "Movie", "TV Series", "Comic", "Short Drama", "Music", "Other"]
- isOngoing: boolean
- latestUpdateInfo: string (empty if completed)
- rating: string (e.g. "8.5/10")

Ensure data is accurate.
`;

const callAI = async (messages: any[], temperature: number = 0.3): Promise<string> => {
  const { 
    getDecryptedApiKey, 
    baseUrl, 
    model,
    enableSearch,
    searchProvider,
    getDecryptedGoogleKey,
    googleSearchCx,
    getDecryptedBingKey,
    getDecryptedYandexKey,
    yandexSearchLogin
  } = useAIStore.getState();
  
  const apiKey = getDecryptedApiKey();

  if (window.electron && window.electron.aiChat) {
    try {
      const searchConfig = enableSearch ? {
          enabled: true,
          provider: searchProvider,
          apiKey: searchProvider === 'google' ? getDecryptedGoogleKey() : 
                  searchProvider === 'bing' ? getDecryptedBingKey() :
                  searchProvider === 'yandex' ? getDecryptedYandexKey() : undefined,
          cx: googleSearchCx,
          user: yandexSearchLogin
      } : undefined;

      return await window.electron.aiChat(messages, temperature, {
        apiKey,
        baseURL: baseUrl,
        model,
        searchConfig
      });
    } catch (error) {
      console.error("Electron AI Chat failed:", error);
      return "";
    }
  } else {
    // Web Mode / Fallback
    // Determine the base URL. If it's the default Moonshot URL and we are in dev, try to use proxy if needed.
    // However, to respect the config store, we generally use what is provided.
    // If apiKey is missing in store, fallback to env var.
    const effectiveApiKey = apiKey || process.env.MOONSHOT_API_KEY || process.env.API_KEY;
    
    // For web dev mode proxy handling:
    let effectiveBaseUrl = baseUrl;
    if (!effectiveBaseUrl || effectiveBaseUrl === "https://api.moonshot.cn/v1") {
        if (import.meta.env.DEV) { // Vite way to check dev mode
             effectiveBaseUrl = "/api/moonshot";
        } else {
             effectiveBaseUrl = "https://api.moonshot.cn/v1";
        }
    }

    // Fix for OpenAI SDK requiring absolute URL
    if (effectiveBaseUrl && effectiveBaseUrl.startsWith('/') && typeof window !== 'undefined') {
        effectiveBaseUrl = `${window.location.origin}${effectiveBaseUrl}`;
    }

    if (!effectiveApiKey) {
        console.error("AI Chat aborted: Missing API Key");
        return "";
    }

    try {
        const client = new OpenAI({
          apiKey: effectiveApiKey,
          baseURL: effectiveBaseUrl,
          dangerouslyAllowBrowser: true
        });
    
        const completion = await client.chat.completions.create({
            model: model || "moonshot-v1-8k",
            messages: messages,
            temperature: temperature,
        });
        return completion.choices[0].message.content || "";
    } catch (e) {
        console.error("Direct AI Chat failed:", e);
        return "";
    }
  }
};

export const searchMedia = async (query: string, type?: MediaType | 'All'): Promise<MediaItem[]> => {
  if (!query.trim()) return [];

  let userPrompt = `Search for media works matching the query: "${query}".`;
  if (type && type !== 'All') {
      userPrompt += ` Strictly limit results to type: "${type}".`;
  } else {
      userPrompt += ` (books, movies, TV series, comics, short dramas)`;
  }
  userPrompt += ` Perform a fuzzy search to find the most relevant results. Do not limit the number of results, return as many as possible.`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];

  const text = await callAI(messages, 0.3);
  if (!text) return [];

  let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  let rawData: Omit<MediaItem, 'id' | 'posterUrl'>[] = [];

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
    const posterUrl = await fetchPosterFromOMDB(item.title, item.releaseDate, id);
    return {
      ...item,
      id,
      posterUrl,
      userRating: 0,
      status: 'To Watch',
      addedAt: new Date().toISOString()
    } as MediaItem;
  }));

  return results;
};

export const checkUpdates = async (items: MediaItem[]): Promise<{ id: string; latestUpdateInfo: string; isOngoing: boolean }[]> => {
  if (items.length === 0) return [];
  
  // Create a mapping of title -> id to map results back
  const titleToId = new Map(items.map(i => [i.title.toLowerCase(), i.id]));
  
  const queryList = items.map(i => `"${i.title}" (${i.type})`).join(', ');
  const userPrompt = `Provide the latest update information (latest episode, chapter, etc.) for the following titles: ${queryList}. 
  Return a JSON array with objects containing:
  - title: string (exact match)
  - latestUpdateInfo: string (e.g. "Season 4 Episode 8" or "Chapter 1052")
  - isOngoing: boolean (true if still updating)
  `;

  const messages = [
    { role: "system", content: "You are a media update tracker. Return ONLY raw JSON array. No markdown." },
    { role: "user", content: userPrompt }
  ];

  const text = await callAI(messages, 0.1);
  if (!text) return [];

  const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  let updates: any[] = [];
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

// Helper for client-side search in Web Mode
const performClientSideSearch = async (query: string): Promise<string> => {
    const { enableSearch, searchProvider, getDecryptedGoogleKey, googleSearchCx } = useAIStore.getState();
    if (!enableSearch) return "";

    // DuckDuckGo via Proxy
    if (searchProvider === 'duckduckgo') {
        try {
             // Use the proxy configured in vite.config.ts
             // Note: We use /html/ endpoint for easier parsing
             const response = await fetch(`/api/ddg/html/?q=${encodeURIComponent(query)}`, {
                 headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                 }
             });
             if (!response.ok) {
                 console.warn(`Client-side DDG search failed: ${response.status} ${response.statusText}`);
             } else {
                 const html = await response.text();
                 
                 // Simple parsing similar to electron main.js
                 const results = [];
                 const blocks = html.split('class="result__body"');
                 for (let i = 1; i < blocks.length && results.length < 5; i++) {
                     const block = blocks[i];
                     const linkMatch = /href="(.*?)"/.exec(block);
                     const titleMatch = />(.*?)(?=<\/a>)/.exec(block.split('class="result__a"')[1] || '');
                     const snippetMatch = />(.*?)(?=<\/a>)/.exec(block.split('class="result__snippet"')[1] || '');
                     
                     if (linkMatch && titleMatch) {
                          const decode = (str: string) => str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                          results.push({
                              title: decode(titleMatch[1]),
                              link: linkMatch[1],
                              snippet: snippetMatch ? decode(snippetMatch[1]) : ''
                          });
                     }
                 }
                 if (results.length > 0) return JSON.stringify(results);
             }
        } catch (e) {
            console.warn("Client-side DDG search failed (network/parsing)", e);
        }
    }

    // Bing Search via Proxy
    if (searchProvider === 'bing') {
        const { getDecryptedBingKey } = useAIStore.getState();
        const apiKey = getDecryptedBingKey();
        if (apiKey) {
            try {
                const response = await fetch(`/api/bing/v7.0/search?q=${encodeURIComponent(query)}&count=5`, {
                    headers: { 'Ocp-Apim-Subscription-Key': apiKey }
                });
                if (!response.ok) {
                    console.warn(`Client-side Bing search failed: ${response.status}`);
                } else {
                    const data = await response.json();
                    if (data.webPages && data.webPages.value) {
                         const results = data.webPages.value.map((item: any) => ({
                             title: item.name,
                             link: item.url,
                             snippet: item.snippet
                         }));
                         return JSON.stringify(results);
                    }
                }
            } catch (e) {
                console.warn("Client-side Bing search failed", e);
            }
        }
    }

    // Google Custom Search
    if (searchProvider === 'google') {
        const apiKey = getDecryptedGoogleKey();
        if (!apiKey || !googleSearchCx) return "";
        try {
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${googleSearchCx}&q=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (!response.ok) return "";
            const data = await response.json();
            if (data.items) {
                return JSON.stringify(data.items.slice(0, 5).map((item: any) => ({
                    title: item.title,
                    snippet: item.snippet,
                    link: item.link
                })));
            }
        } catch (e) {
            console.warn("Client-side Google search failed", e);
        }
    }

    return "";
};

// New Helper: Fetch Poster from Search
export const fetchPosterFromSearch = async (title: string, year: string, type: string = 'movie'): Promise<string | undefined> => {
    const { 
        enableSearch, 
        searchProvider, 
        getDecryptedGoogleKey, 
        googleSearchCx, 
        getDecryptedBingKey,
        getDecryptedYandexKey,
        yandexSearchLogin
    } = useAIStore.getState();

    if (!enableSearch) return undefined;

    const query = `${type} ${title} ${year} poster cover`;
    const searchConfig = {
        enabled: true,
        provider: searchProvider,
        apiKey: searchProvider === 'google' ? getDecryptedGoogleKey() : 
                searchProvider === 'bing' ? getDecryptedBingKey() :
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
            } else if (searchProvider === 'bing') {
                const apiKey = getDecryptedBingKey();
                if (apiKey) {
                    const url = `/api/bing/v7.0/search?q=${encodeURIComponent(query)}&count=5`;
                    const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': apiKey } });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.webPages && data.webPages.value) {
                            results = data.webPages.value.map((item: any) => ({
                                image: item.openGraphImage?.contentUrl
                            }));
                        }
                    }
                }
            }
            // DuckDuckGo doesn't support easy image extraction in web mode
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
                 // Optional: Check for common image extensions if strictly required, 
                 // but many CDNs don't use them. The domain filter is more critical for ORB errors.
                 return true;
             });
             if (validImage) return validImage.image;
        }
    } catch (e) {
        console.warn(`Failed to fetch poster from search for ${title}`, e);
    }
    return undefined;
};

export const getTrendingMedia = async (): Promise<MediaItem[]> => {
  let searchContext = "";
  
  // If in Web Mode (no electron), try client-side search
  if (!window.electron && useAIStore.getState().enableSearch) {
      searchContext = await performClientSideSearch("trending movies TV series dramas last 2 months high popularity");
  }

  let userPrompt = `Recommend 4 currently trending movies, TV series, or dramas that have been updated or released within the last 2 months. Focus on the highest popularity/heat. Ensure the results are strictly from the recent 60 days.`;
  
  if (searchContext) {
      userPrompt += `\n\nHere are some web search results to help you find real-time information:\n${searchContext}\n\nUse these results to ensure accuracy.`;
  } else if (!window.electron) {
      // Fallback for web mode without search
      userPrompt += `\n\n(Note: If you cannot access real-time data, please recommend the most widely discussed and anticipated titles from late 2024 to early 2025.)`;
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ];

  const text = await callAI(messages, 0.5);
  if (!text) return [];

  const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
  let rawData: Omit<MediaItem, 'id' | 'posterUrl'>[] = [];
  
  try {
    rawData = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse trending JSON:", e);
    return [];
  }
  
  // Process in parallel to fetch posters
  const items = await Promise.all(rawData.map(async (item) => {
    const id = uuidv4();
    let posterUrl = await fetchPosterFromSearch(item.title, item.releaseDate ? item.releaseDate.split('-')[0] : '');
    
    if (!posterUrl) {
        // Fallback to OMDB if search failed
        posterUrl = await fetchPosterFromOMDB(item.title, item.releaseDate, id);
    }
    
    // If fetchPosterFromOMDB returned random (because of missing key or no result), it might be a placeholder.
    // But fetchPosterFromOMDB already handles fallback to random.
    // We prefer search result if available.
    
    // Note: fetchPosterFromOMDB returns random if it fails. 
    // If fetchPosterFromSearch returned undefined, we try OMDB.
    
    return {
      ...item,
      id,
      posterUrl: posterUrl || getRandomPoster(id)
    } as MediaItem;
  }));

  return items;
};
