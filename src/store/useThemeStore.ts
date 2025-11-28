import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'doraemon' | 'cyberpunk' | 'scandinavian' | 'gradient';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'cyberpunk', // Default to Cyberpunk (closest to previous dark mode)
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'media-tracker-theme',
    }
  )
);
