import React, { useState, useEffect } from 'react';
import { useCollectionStore } from '../store/useCollectionStore';
import { MediaCard } from '../components/MediaCard';
import { CollectionCategory, MediaItem } from '../types/types';
import { Filter, Search as SearchIcon, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export const CollectionPage: React.FC = () => {
  const { collection, moveCategory } = useCollectionStore();
  const [filter, setFilter] = useState<CollectionCategory | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredCollection = collection.filter(item => {
    const matchesCategory = filter === 'All' || item.category === filter;
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleMove = (item: MediaItem, category: CollectionCategory) => {
    moveCategory(item.id, category);
    toast.success(`Moved "${item.title}" to ${category}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
            <h1 className="text-3xl font-bold text-theme-accent">My Collection</h1>
            <p className="mt-1 text-theme-subtext">Manage and track your media journey</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
             <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-subtext" />
                <input 
                    type="text" 
                    placeholder="Filter collection..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 rounded-lg border focus:ring-2 outline-none w-full sm:w-64 transition-all bg-theme-surface border-theme-border text-theme-text focus:border-theme-accent focus:ring-theme-accent/20 placeholder-theme-subtext"
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                {(['All', ...Object.values(CollectionCategory)] as const).map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={clsx(
                          "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                          filter === cat 
                            ? "bg-theme-accent text-theme-bg"
                            : "bg-theme-surface border border-theme-border text-theme-text hover:bg-theme-bg"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {collection.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed bg-theme-surface border-theme-border">
            <Filter className="w-12 h-12 mx-auto mb-4 text-theme-subtext" />
            <h3 className="text-lg font-medium text-theme-text">Your collection is empty</h3>
            <p className="mb-6 text-theme-subtext">Start searching to add movies, books, and more.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-y-8 gap-x-6">
            <AnimatePresence>
                {filteredCollection.map((item, index) => (
                    <MediaCard 
                        key={item.id} 
                        item={item} 
                        layoutId={item.id}
                        onClick={() => setSelectedId(item.id)}
                        onAction={handleMove}
                        index={index}
                        variant="collection"
                    />
                ))}
            </AnimatePresence>
        </motion.div>
      )}

      {filteredCollection.length === 0 && collection.length > 0 && (
          <div className="text-center py-12">
              <p className="text-theme-subtext">No items match your filter.</p>
          </div>
      )}

      <AnimatePresence>
        {selectedId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm"
              onClick={() => setSelectedId(null)}
            />
            <div className="fixed inset-0 grid place-items-center z-[70] pointer-events-none p-4 md:p-8">
               <div className="pointer-events-auto h-[85vh] aspect-[1/1.48] shadow-2xl relative max-w-full">
                  {collection.find(item => item.id === selectedId) && (
                     <MediaCard
                        item={collection.find(item => item.id === selectedId)!}
                        layoutId={selectedId}
                        onAction={handleMove}
                        showActions={true}
                        className="w-full h-full"
                        variant="collection"
                     />
                  )}
                  <button
                    onClick={() => setSelectedId(null)}
                    className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
               </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
