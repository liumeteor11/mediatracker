import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MediaItem, CollectionCategory } from '../types/types';
import { fetchCover } from '../services/coverService';

interface CollectionState {
  collection: MediaItem[];
  addToCollection: (item: MediaItem, category: CollectionCategory) => void;
  removeFromCollection: (id: string) => void;
  updateItem: (id: string, updates: Partial<MediaItem>) => void;
  moveCategory: (id: string, category: CollectionCategory) => void;
  getStats: () => { total: number; watched: number; toWatch: number; favorites: number };
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      collection: [],
      addToCollection: (item, category) => {
        set((state) => {
            const exists = state.collection.find(c => c.title === item.title && c.type === item.type);
            if (exists) {
                // If exists, just move it (or update)
                return {
                    collection: state.collection.map(c => c.id === exists.id ? { ...c, category, savedAt: Date.now() } : c)
                };
            }
            return { collection: [ { ...item, category, savedAt: Date.now() }, ...state.collection ] };
        });

        // Trigger background cover fetch if missing
        const currentItem = get().collection.find(c => c.id === item.id);
        if (currentItem && !currentItem.posterUrl) {
            fetchCover(currentItem).then((url) => {
                if (url) {
                    get().updateItem(currentItem.id, { posterUrl: url });
                }
            });
        }
      },
      removeFromCollection: (id) => set((state) => ({
        collection: state.collection.filter((item) => item.id !== id),
      })),
      updateItem: (id, updates) => set((state) => ({
        collection: state.collection.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      })),
      moveCategory: (id, category) => set((state) => ({
        collection: state.collection.map((item) =>
          item.id === id ? { ...item, category } : item
        ),
      })),
      getStats: () => {
        const { collection } = get();
        return {
          total: collection.length,
          watched: collection.filter(c => c.category === CollectionCategory.WATCHED).length,
          toWatch: collection.filter(c => c.category === CollectionCategory.TO_WATCH).length,
          favorites: collection.filter(c => c.category === CollectionCategory.FAVORITES).length,
        };
      }
    }),
    {
      name: 'media-tracker-collection',
    }
  )
);
