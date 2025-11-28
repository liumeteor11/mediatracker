import React, { useState, useEffect } from 'react';
import { useAIStore, AIProvider, SearchProvider } from '../store/useAIStore';
import { Save, Activity, CheckCircle, AlertCircle, Eye, EyeOff, Info, List, Globe, Search } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'react-toastify';

const PROVIDER_MODELS: Record<string, { name: string; version: string; releaseDate: string }[]> = {
  moonshot: [
    { name: 'moonshot-v1-8k', version: 'v1', releaseDate: '2023-10' },
    { name: 'moonshot-v1-32k', version: 'v1', releaseDate: '2023-10' },
    { name: 'moonshot-v1-128k', version: 'v1', releaseDate: '2023-10' }
  ],
  openai: [
    { name: 'gpt-4o', version: 'GPT-4o', releaseDate: '2024-05' },
    { name: 'gpt-4o-mini', version: 'GPT-4o Mini', releaseDate: '2024-07' },
    { name: 'o1-mini', version: 'o1 Mini', releaseDate: '2024-09' }
  ],
  deepseek: [
    { name: 'deepseek-chat', version: 'V3', releaseDate: '2024-12' },
    { name: 'deepseek-reasoner', version: 'R1', releaseDate: '2025-01' }
  ],
  qwen: [
    { name: 'qwen-max', version: '2.5', releaseDate: '2024-09' },
    { name: 'qwen-plus', version: '2.5', releaseDate: '2024-09' },
    { name: 'qwen-turbo', version: '2.5', releaseDate: '2024-09' }
  ],
  google: [
    { name: 'gemini-1.5-pro', version: '1.5 Pro', releaseDate: '2024-04' },
    { name: 'gemini-1.5-flash', version: '1.5 Flash', releaseDate: '2024-05' },
    { name: 'gemini-1.0-pro', version: '1.0 Pro', releaseDate: '2024-02' }
  ],
  mistral: [
    { name: 'mistral-large-latest', version: 'Large 2', releaseDate: '2024-07' },
    { name: 'mistral-small-latest', version: 'Small', releaseDate: '2024-02' },
    { name: 'codestral-latest', version: 'Codestral', releaseDate: '2024-05' }
  ]
};

const PROVIDER_OPTIONS: { value: AIProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'moonshot', label: 'Moonshot AI (Kimi)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'qwen', label: 'Alibaba Cloud (Qwen)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'custom', label: 'Custom (Compatible)' }
];

const SEARCH_PROVIDER_OPTIONS: { value: SearchProvider; label: string }[] = [
    { value: 'google', label: 'Google Custom Search' },
    { value: 'bing', label: 'Bing Web Search' },
    { value: 'yandex', label: 'Yandex Search' },
    { value: 'duckduckgo', label: 'DuckDuckGo (Free)' },
];

export const AIConfigPanel: React.FC = () => {
  const { 
    provider, apiKey, model, baseUrl, temperature, maxTokens,
    enableSearch, searchProvider, googleSearchCx, yandexSearchLogin,
    setProvider, setConfig, getDecryptedApiKey, getDecryptedGoogleKey, getDecryptedBingKey, getDecryptedYandexKey
  } = useAIStore();

  const [localKey, setLocalKey] = useState(getDecryptedApiKey());
  const [localGoogleKey, setLocalGoogleKey] = useState(getDecryptedGoogleKey());
  const [localBingKey, setLocalBingKey] = useState(getDecryptedBingKey());
  const [localYandexKey, setLocalYandexKey] = useState(getDecryptedYandexKey());
  
  const [showKey, setShowKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showBingKey, setShowBingKey] = useState(false);
  const [showYandexKey, setShowYandexKey] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{status: 'success' | 'error' | null, latency: number | null, message: string}>({
    status: null,
    latency: null,
    message: ''
  });
  const [isManualInput, setIsManualInput] = useState(false);

  // Update local keys and reset manual input when provider changes or store updates
  useEffect(() => {
    setLocalKey(getDecryptedApiKey());
    setLocalGoogleKey(getDecryptedGoogleKey());
    setLocalBingKey(getDecryptedBingKey());
    setLocalYandexKey(getDecryptedYandexKey());
    setIsManualInput(false);
  }, [provider, getDecryptedApiKey, getDecryptedGoogleKey, getDecryptedBingKey, getDecryptedYandexKey]);

  const handleSave = () => {
    if (!localKey) {
        toast.error('API Key is required');
        return;
    }
    
    if (enableSearch) {
        if (searchProvider === 'google' && (!localGoogleKey || !googleSearchCx)) {
            toast.warning('Google Search enabled but Key/CX missing.');
        }
        if (searchProvider === 'bing' && !localBingKey) {
            toast.warning('Bing Search enabled but API Key missing.');
        }
        if (searchProvider === 'yandex' && (!localYandexKey || !yandexSearchLogin)) {
            toast.warning('Yandex Search enabled but Key/User missing.');
        }
    }

    setConfig({
        apiKey: localKey, // Store will encrypt this
        googleSearchApiKey: localGoogleKey, // Store will encrypt this
        bingSearchApiKey: localBingKey,
        yandexSearchApiKey: localYandexKey,
        model,
        baseUrl,
        temperature,
        maxTokens,
        enableSearch,
        searchProvider,
        googleSearchCx,
        yandexSearchLogin
    });
    toast.success('Configuration saved successfully');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult({ status: null, latency: null, message: '' });
    const startTime = performance.now();

    try {
        // Use the electron IPC bridge if available, otherwise direct fetch
        if (window.electron && window.electron.aiChat) {
             const messages = [{ role: 'user', content: 'Hi' }];
             
             await window.electron.aiChat(messages, 0.7, {
                 apiKey: localKey,
                 baseUrl: baseUrl,
                 model: model,
                 // Pass search config for testing
                 searchConfig: enableSearch ? {
                     enabled: true,
                     provider: searchProvider,
                     apiKey: searchProvider === 'google' ? localGoogleKey : 
                             searchProvider === 'bing' ? localBingKey :
                             searchProvider === 'yandex' ? localYandexKey : undefined,
                     cx: googleSearchCx,
                     user: yandexSearchLogin
                 } : undefined
             });
        } else {
             // Web Mode Direct Call
             const response = await fetch(`${baseUrl}/chat/completions`, {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${localKey}`
                 },
                 body: JSON.stringify({
                     model: model,
                     messages: [{ role: 'user', content: 'Hi' }],
                     max_tokens: 5
                 })
             });
             
             if (!response.ok) {
                 const errData = await response.json().catch(() => ({}));
                 throw new Error(errData.error?.message || `HTTP ${response.status}`);
             }
        }

        const endTime = performance.now();
        setTestResult({
            status: 'success',
            latency: Math.round(endTime - startTime),
            message: 'Connection successful'
        });
        toast.success('Connection verified!');

    } catch (error: any) {
        setTestResult({
            status: 'error',
            latency: null,
            message: error.message || 'Connection failed'
        });
        toast.error(`Connection failed: ${error.message}`);
    } finally {
        setIsTesting(false);
    }
  };

  const availableModels = PROVIDER_MODELS[provider] || [];
  const isKnownModel = availableModels.some(m => m.name === model);
  const showInput = provider === 'custom' || !isKnownModel || isManualInput;

  return (
    <div className="bg-theme-surface border border-theme-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6 border-b border-theme-border pb-4">
        <Activity className="w-6 h-6 text-theme-accent" />
        <h2 className="text-xl font-bold text-theme-text">AI Model Configuration</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">Provider</label>
            <select 
              value={provider} 
              onChange={(e) => setProvider(e.target.value as AIProvider)}
              className="w-full px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
            >
              {PROVIDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">Base URL</label>
            <input 
              type="text" 
              value={baseUrl}
              onChange={(e) => setConfig({ baseUrl: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
              placeholder="https://api.example.com/v1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">API Key</label>
            <div className="relative">
              <input 
                type={showKey ? "text" : "password"} 
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                className="w-full px-4 py-2 pr-10 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                placeholder="sk-..."
              />
              <button 
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtext hover:text-theme-text"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-theme-subtext mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Stored locally with AES encryption
            </p>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">Model Name</label>
            <div className="relative">
               {showInput ? (
                 <div className="flex gap-2">
                   <input 
                     type="text" 
                     value={model} 
                     onChange={(e) => setConfig({ model: e.target.value })}
                     className="w-full px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                     placeholder={provider === 'custom' ? "Enter model name" : "Enter custom model name"}
                   />
                   {provider !== 'custom' && (
                     <button
                        onClick={() => {
                            setIsManualInput(false);
                            // If current model is not in list, revert to default
                            if (!availableModels.some(m => m.name === model)) {
                                 setConfig({ model: availableModels[0]?.name || '' });
                            }
                        }}
                        className="px-3 py-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-bg text-theme-subtext transition-colors"
                        title="Switch to list selection"
                     >
                        <List className="w-4 h-4" />
                     </button>
                   )}
                 </div>
               ) : (
                 <select 
                   value={model} 
                   onChange={(e) => {
                       if (e.target.value === '__manual__') {
                           setIsManualInput(true);
                       } else {
                           setConfig({ model: e.target.value });
                       }
                   }}
                   className="w-full px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                 >
                   {availableModels.map(m => (
                     <option key={m.name} value={m.name}>
                       {m.name} ({m.version} - {m.releaseDate})
                     </option>
                   ))}
                   <option value="__manual__" className="text-theme-accent font-medium bg-theme-surface">
                       + Manual Input...
                   </option>
                 </select>
               )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">
              Temperature ({temperature})
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={temperature}
              onChange={(e) => setConfig({ temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-theme-border rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-theme-subtext mt-1">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">Max Tokens</label>
            <input 
              type="number" 
              value={maxTokens}
              onChange={(e) => setConfig({ maxTokens: parseInt(e.target.value) })}
              className="w-full px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Web Search Configuration */}
      <div className="mt-6 border-t border-theme-border pt-6">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-theme-accent" />
                <h3 className="text-lg font-semibold text-theme-text">Web Search Capabilities</h3>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={enableSearch} 
                onChange={(e) => setConfig({ enableSearch: e.target.checked })} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-theme-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
              <span className="ms-3 text-sm font-medium text-theme-text">Enable Web Search</span>
            </label>
        </div>

        {enableSearch && (
            <div className="bg-theme-bg/50 p-4 rounded-lg border border-theme-border space-y-4">
                {/* Search Provider Selection */}
                <div>
                    <label className="block text-sm font-medium text-theme-text mb-1">Search Engine</label>
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-theme-subtext" />
                        <select 
                            value={searchProvider} 
                            onChange={(e) => setConfig({ searchProvider: e.target.value as SearchProvider })}
                            className="flex-1 px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                        >
                            {SEARCH_PROVIDER_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Google Configuration */}
                {searchProvider === 'google' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-theme-text mb-1">Google Custom Search API Key</label>
                            <div className="relative">
                                <input 
                                    type={showGoogleKey ? "text" : "password"} 
                                    value={localGoogleKey}
                                    onChange={(e) => setLocalGoogleKey(e.target.value)}
                                    className="w-full px-4 py-2 pr-10 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                                    placeholder="AIza..."
                                />
                                 <button 
                                    type="button"
                                    onClick={() => setShowGoogleKey(!showGoogleKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtext hover:text-theme-text"
                                  >
                                    {showGoogleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                            </div>
                             <a href="https://developers.google.com/custom-search/v1/overview" target="_blank" rel="noreferrer" className="text-xs text-theme-accent hover:underline mt-1 inline-block">
                                Get Google API Key
                            </a>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-theme-text mb-1">Search Engine ID (CX)</label>
                            <input 
                                type="text" 
                                value={googleSearchCx}
                                onChange={(e) => setConfig({ googleSearchCx: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                                placeholder="0123456789..."
                            />
                            <a href="https://programmablesearchengine.google.com/controlpanel/all" target="_blank" rel="noreferrer" className="text-xs text-theme-accent hover:underline mt-1 inline-block">
                                Get Search Engine ID
                            </a>
                        </div>
                    </div>
                )}

                {/* Bing Configuration */}
                {searchProvider === 'bing' && (
                     <div>
                        <label className="block text-sm font-medium text-theme-text mb-1">Bing Web Search API Key</label>
                        <div className="relative">
                            <input 
                                type={showBingKey ? "text" : "password"} 
                                value={localBingKey}
                                onChange={(e) => setLocalBingKey(e.target.value)}
                                className="w-full px-4 py-2 pr-10 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                                placeholder="Bing API Key..."
                            />
                             <button 
                                type="button"
                                onClick={() => setShowBingKey(!showBingKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtext hover:text-theme-text"
                              >
                                {showBingKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                        </div>
                         <a href="https://www.microsoft.com/en-us/bing/apis/bing-web-search-api" target="_blank" rel="noreferrer" className="text-xs text-theme-accent hover:underline mt-1 inline-block">
                            Get Bing API Key (Azure)
                        </a>
                    </div>
                )}

                {/* Yandex Configuration */}
                {searchProvider === 'yandex' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-theme-text mb-1">Yandex XML User</label>
                            <input 
                                type="text" 
                                value={yandexSearchLogin}
                                onChange={(e) => setConfig({ yandexSearchLogin: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                                placeholder="Yandex Login/User..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-theme-text mb-1">Yandex XML API Key</label>
                            <div className="relative">
                                <input 
                                    type={showYandexKey ? "text" : "password"} 
                                    value={localYandexKey}
                                    onChange={(e) => setLocalYandexKey(e.target.value)}
                                    className="w-full px-4 py-2 pr-10 rounded-lg border bg-theme-bg border-theme-border text-theme-text focus:ring-2 focus:ring-theme-accent outline-none"
                                    placeholder="Yandex API Key..."
                                />
                                 <button 
                                    type="button"
                                    onClick={() => setShowYandexKey(!showYandexKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-subtext hover:text-theme-text"
                                  >
                                    {showYandexKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                            </div>
                             <a href="https://xml.yandex.com/" target="_blank" rel="noreferrer" className="text-xs text-theme-accent hover:underline mt-1 inline-block">
                                Get Yandex XML Key
                            </a>
                        </div>
                    </div>
                )}

                {/* DuckDuckGo Configuration */}
                {searchProvider === 'duckduckgo' && (
                    <div className="text-sm text-theme-subtext bg-theme-surface p-3 rounded-lg border border-theme-border">
                        <p className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-theme-accent" />
                            DuckDuckGo search does not require an API key. It is free to use but may be slower or rate-limited.
                        </p>
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-theme-border pt-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
                onClick={handleTestConnection}
                disabled={isTesting}
                className={clsx(
                    "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors w-full md:w-auto justify-center",
                    isTesting 
                        ? "bg-theme-surface border border-theme-border text-theme-subtext cursor-wait"
                        : "bg-theme-surface border border-theme-border hover:bg-theme-bg text-theme-text"
                )}
            >
                <Activity className={clsx("w-4 h-4", isTesting && "animate-spin")} />
                {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            
            {testResult.status && (
                <div className={clsx(
                    "flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border",
                    testResult.status === 'success' 
                        ? "bg-green-500/10 border-green-500/20 text-green-600"
                        : "bg-red-500/10 border-red-500/20 text-red-600"
                )}>
                    {testResult.status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>
                        {testResult.status === 'success' 
                            ? `${testResult.latency}ms` 
                            : 'Failed'}
                    </span>
                </div>
            )}
        </div>

        <button 
            onClick={handleSave}
            className="px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors bg-theme-accent text-theme-bg hover:bg-theme-accent-hover shadow-lg shadow-theme-accent/20 w-full md:w-auto justify-center"
        >
            <Save className="w-4 h-4" />
            Save Configuration
        </button>
      </div>
      
      <div className="mt-4 text-center md:text-right">
        <a 
            href={
                provider === 'moonshot' ? 'https://platform.moonshot.cn/docs' :
                provider === 'openai' ? 'https://platform.openai.com/docs' :
                provider === 'deepseek' ? 'https://api-docs.deepseek.com/' :
                provider === 'qwen' ? 'https://help.aliyun.com/zh/model-studio/developer-reference/use-compatible-text-generation-interfaces' :
                provider === 'google' ? 'https://ai.google.dev/gemini-api/docs/openai' :
                provider === 'mistral' ? 'https://docs.mistral.ai/' :
                '#'
            } 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-theme-accent hover:underline"
        >
            View API Documentation
        </a>
      </div>
    </div>
  );
};
