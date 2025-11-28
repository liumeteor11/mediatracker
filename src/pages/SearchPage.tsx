import React, { useState, useEffect } from 'react';
import { Search, Loader2, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { searchMedia, getTrendingMedia } from '../services/aiService';
import { MediaItem, CollectionCategory, MediaType } from '../types/types';
import { MediaCard } from '../components/MediaCard';
import { useCollectionStore } from '../store/useCollectionStore';
import { toast } from 'react-toastify';
import clsx from 'clsx';

const CATEGORY_FILTERS = [
  { label: 'All', value: 'All' },
  { label: 'Movies', value: MediaType.MOVIE },
  { label: 'TV Series', value: MediaType.TV_SERIES },
  { label: 'Books', value: MediaType.BOOK },
  { label: 'Comics', value: MediaType.COMIC },
  { label: 'Short Dramas', value: MediaType.SHORT_DRAMA },
  { label: 'Music', value: MediaType.MUSIC },
  { label: 'Other', value: MediaType.OTHER },
];

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MediaType | 'All'>('All');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTrending, setIsTrending] = useState(true);

  const { addToCollection } = useCollectionStore();

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. Check local storage if not forcing refresh
      if (!forceRefresh) {
        const cachedData = localStorage.getItem('media_tracker_trending_data');
        const cachedTs = localStorage.getItem('media_tracker_trending_ts');
        
        if (cachedData && cachedTs) {
            const now = Date.now();
            const lastRefresh = parseInt(cachedTs, 10);
            const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
            
            if (now - lastRefresh < sevenDays) {
                try {
                    const parsedData = JSON.parse(cachedData);
                    if (Array.isArray(parsedData) && parsedData.length > 0) {
                         setResults(parsedData);
                         setIsTrending(true);
                         setLoading(false);
                         return;
                    }
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }
        }
      }

      // 2. Fetch new data
      const trending = await getTrendingMedia();
      
      // 3. Save to local storage
      if (trending.length > 0) {
        setResults(trending);
        setIsTrending(true);
        localStorage.setItem('media_tracker_trending_data', JSON.stringify(trending));
        localStorage.setItem('media_tracker_trending_ts', Date.now().toString());
        if (forceRefresh) {
             toast.success('Trending content updated!');
        }
      } else {
         // If fetch returns empty but we have cache, maybe fallback? 
         // For now, just show error or empty.
         if (forceRefresh) setError('Failed to refresh trending media.');
      }
      
    } catch (err) {
      setError('Failed to load trending media.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setIsTrending(false);
    
    try {
      const data = await searchMedia(query, selectedType);
      setResults(data);
      if (data.length === 0) {
        setError('No results found. Try a different query.');
      }
    } catch (err) {
      setError('An error occurred while searching. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  const onAddToCollection = (item: MediaItem, category: CollectionCategory) => {
    addToCollection(item, category);
    toast.success(`Added "${item.title}" to ${category}`);
  };

  return (
    <div className="space-y-8 relative">
       {/* Spotlight Effect */}
       <div className="absolute top-[-100px] left-1/2 transform -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[100px] opacity-30 pointer-events-none bg-theme-accent" />

      {/* Search Header */}
      <div className="text-center mb-12 space-y-6 relative z-10">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-theme-accent to-theme-accent-hover">
          Discover Your Next Obsession
        </h1>
        <p className="text-lg max-w-2xl mx-auto text-theme-subtext">
          Search for movies, books, TV shows, and comics powered by AI.
        </p>
        
        <form onSubmit={handleSearch} className="max-w-xl mx-auto relative group">
          <div className="absolute -inset-0.5 rounded-full blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 bg-gradient-to-r from-theme-accent to-theme-accent-hover"></div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for 'Inception' or 'Cyberpunk novels'..."
            className="relative w-full pl-12 pr-32 py-4 rounded-full border-2 focus:outline-none focus:ring-2 shadow-xl text-lg transition-all bg-theme-surface border-theme-border text-theme-text focus:border-theme-accent focus:ring-theme-accent/20 placeholder-theme-subtext"
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-theme-subtext" />
          <button 
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 bg-theme-accent text-theme-bg hover:bg-theme-accent-hover hover:shadow-lg"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-2xl mx-auto">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedType(filter.value as MediaType | 'All')}
              className={clsx(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border",
                selectedType === filter.value
                  ? "bg-theme-accent text-theme-bg border-theme-accent shadow-md"
                  : "bg-theme-surface text-theme-subtext border-theme-border hover:border-theme-accent/50 hover:text-theme-text"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-6 border-b pb-4 border-theme-border">
            {isTrending ? (
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 font-bold text-xl text-theme-accent">
                        <TrendingUp className="w-6 h-6" />
                        <h2>Trending Now</h2>
                    </div>
                    
                    <button
                        onClick={() => loadTrending(true)}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-theme-surface text-theme-accent hover:bg-theme-bg disabled:opacity-50"
                        title="Refresh trending content (Updates weekly)"
                    >
                        <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
                        <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                </div>
            ) : (
                <h2 className="text-xl font-bold text-theme-text">
                    {results.length > 0 ? `Results for "${query}"` : ''}
                </h2>
            )}
        </div>

        {error && (
            <div className="flex items-center justify-center p-8 rounded-xl border text-red-600 bg-red-50 border-red-100">
                <AlertCircle className="w-6 h-6 mr-2" />
                {error}
            </div>
        )}

        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl aspect-[1/1.48] animate-pulse border p-4 bg-theme-surface border-theme-border">
                    <div className="w-full h-2/3 rounded-lg mb-4 bg-theme-bg"></div>
                    <div className="h-4 rounded w-3/4 mb-2 bg-theme-bg"></div>
                    <div className="h-4 rounded w-1/2 bg-theme-bg"></div>
                </div>
              ))}
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6">
            {results.map((item, index) => (
              <MediaCard 
                key={item.id} 
                item={item} 
                onAction={onAddToCollection}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
