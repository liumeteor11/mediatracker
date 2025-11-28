# MediaTracker AI - UI Component Library

This document outlines the core UI components used in the MediaTracker AI "Cinema Gallery" theme.

## 1. MediaCard

The core component for displaying media items (movies, books, etc.).

### Props
| Prop | Type | Description |
|------|------|-------------|
| `item` | `MediaItem` | The data object containing title, poster, year, type, etc. |
| `onAction` | `(item, category) => void` | Callback when user performs an action (add/move). |
| `index` | `number` | The index in the list, used for calculating staggered animation delays. |

### Visual Specification
- **Aspect Ratio**: 16:9 (Cinema standard).
- **Dimensions**: Responsive width within grid columns.
- **Animation**: 
  - **Entrance**: `opacity: 0` -> `1`, `y: 20` -> `0`. Delay = `index * 0.1s`.
  - **Hover**: 3D Flip effect using CSS `transform: rotateY(180deg)` and `preserve-3d`.
- **States**:
  - **Front**: Poster image (cover), Title (overlay at bottom).
  - **Back**: Details (Plot, Rating, Action Buttons) on a dark/frosted background.

### Usage Example
```tsx
<MediaCard 
  item={movieData} 
  index={0} 
  onAction={(item, cat) => addToCollection(item, cat)} 
/>
```

## 2. Layout & Theme Wrapper

The global layout component that handles theme context and structure.

### Features
- **Theme Context**: Wraps children in `bg-cinema-900` (Dark) or `bg-gray-50` (Light).
- **Structure**: `Navbar` (Sticky) + `Main Content` (Flex Grow) + `Footer`.
- **Footer**: Includes "Powered by Moonshot AI" credit.

### Usage Example
```tsx
<Layout>
  <Routes>...</Routes>
</Layout>
```

## 3. Navbar

Responsive navigation bar with integrated theme toggle.

### Features
- **Sticky Positioning**: `sticky top-0 z-50`.
- **Backdrop Blur**: `backdrop-blur-md`.
- **Theme Toggle**: Button toggles `dark`/`light` mode in Zustand store.
  - Icon switches between Sun/Moon.
  - Transition: `duration-300 hover:scale-110`.

## 4. UI Elements

### Buttons
- **Primary (Dark Mode)**: `bg-cinema-gold text-cinema-900 hover:bg-cinema-amber`.
- **Primary (Light Mode)**: `bg-indigo-600 text-white hover:bg-indigo-700`.
- **Ghost/Icon**: `p-2 rounded-full hover:bg-gray-200/10`.

### Inputs (Search)
- **Style**: Pill-shaped (`rounded-full`), large padding (`py-4`).
- **Focus State**: Ring with theme color (`ring-cinema-gold` or `ring-indigo-500`).
- **Spotlight Effect**: Container has a blurred gradient background that intensifies on hover.

### Grid System
- **Desktop**: 4 columns (`grid-cols-4`), Gap 24px (`gap-6`).
- **Tablet**: 2 columns (`grid-cols-2`).
- **Mobile**: 1 column (`grid-cols-1`), Gap 12px.
