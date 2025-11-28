import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import CryptoJS from 'crypto-js';

// Simple encryption key (In a real app, this should not be hardcoded or should be user-provided)
// For this requirement, we use a static key to satisfy "encrypted storage" vs plain text in localStorage
const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'media-tracker-ai-config-secret';


export type AIProvider = 'moonshot' | 'openai' | 'deepseek' | 'qwen' | 'google' | 'mistral' | 'custom';
export type SearchProvider = 'google' | 'bing' | 'duckduckgo' | 'yandex';

interface AIConfigState {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  // Search Configuration
  enableSearch: boolean;
  searchProvider: SearchProvider;
  googleSearchApiKey: string;
  googleSearchCx: string;
  bingSearchApiKey: string;
  yandexSearchApiKey: string;
  yandexSearchLogin: string;
  
  setProvider: (provider: AIProvider) => void;
  setConfig: (config: Partial<Omit<AIConfigState, 'setProvider' | 'setConfig' | 'getDecryptedApiKey' | 'getDecryptedGoogleKey' | 'getDecryptedBingKey' | 'getDecryptedYandexKey'>>) => void;
  getDecryptedApiKey: () => string;
  getDecryptedGoogleKey: () => string;
  getDecryptedBingKey: () => string;
  getDecryptedYandexKey: () => string;
}

const encrypt = (text: string) => {
  if (!text) return '';
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

const decrypt = (ciphertext: string) => {
  if (!ciphertext) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
};

export const useAIStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      provider: 'moonshot',
      apiKey: '', // Stores encrypted key
      model: 'moonshot-v1-8k',
      baseUrl: 'https://api.moonshot.cn/v1',
      temperature: 0.3,
      maxTokens: 2000,
      
      // Search Defaults
      enableSearch: false,
      searchProvider: 'google',
      googleSearchApiKey: '',
      googleSearchCx: '',
      bingSearchApiKey: '',
      yandexSearchApiKey: '',
      yandexSearchLogin: '',

      setProvider: (provider) => {
        let defaultBaseUrl = '';
        let defaultModel = '';
        
        switch (provider) {
          case 'moonshot':
            defaultBaseUrl = 'https://api.moonshot.cn/v1';
            defaultModel = 'moonshot-v1-8k';
            break;
          case 'openai':
            defaultBaseUrl = 'https://api.openai.com/v1';
            defaultModel = 'gpt-4o';
            break;
          case 'deepseek':
            defaultBaseUrl = 'https://api.deepseek.com';
            defaultModel = 'deepseek-chat';
            break;
          case 'qwen':
            defaultBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
            defaultModel = 'qwen-plus';
            break;
          case 'google':
            defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
            defaultModel = 'gemini-1.5-flash';
            break;
          case 'mistral':
            defaultBaseUrl = 'https://api.mistral.ai/v1';
            defaultModel = 'mistral-small-latest';
            break;
          case 'custom':
            defaultBaseUrl = '';
            defaultModel = '';
            break;
        }
        
        set({ provider, baseUrl: defaultBaseUrl, model: defaultModel });
      },
      setConfig: (config) => {
        const updates = { ...config };
        // Encrypt API Key if it's being updated
        if (updates.apiKey) {
            updates.apiKey = encrypt(updates.apiKey);
        }
        // Encrypt Search Keys if updated
        if (updates.googleSearchApiKey) {
            updates.googleSearchApiKey = encrypt(updates.googleSearchApiKey);
        }
        if (updates.bingSearchApiKey) {
            updates.bingSearchApiKey = encrypt(updates.bingSearchApiKey);
        }
        if (updates.yandexSearchApiKey) {
            updates.yandexSearchApiKey = encrypt(updates.yandexSearchApiKey);
        }
        set(updates);
      },
      getDecryptedApiKey: () => {
        return decrypt(get().apiKey);
      },
      getDecryptedGoogleKey: () => {
        return decrypt(get().googleSearchApiKey);
      },
      getDecryptedBingKey: () => {
        return decrypt(get().bingSearchApiKey);
      },
      getDecryptedYandexKey: () => {
        return decrypt(get().yandexSearchApiKey);
      }
    }),
    {
      name: 'ai-config-storage',
    }
  )
);
