# MediaTracker AI - All-State Design Drafts

Since this is a text-based environment, these drafts describe the visual states of key components in Markdown format.

## 1. Media Card States

### A. Normal (Default)
- **Visual**: Shows poster image covering 100% of the card.
- **Overlay**: Gradient at bottom (transparent to black).
- **Content**: Title (White/Gold), Year (Gray).
- **Depth**: Flat, slight shadow `shadow-md`.

### B. Hover (Interaction)
- **Trigger**: Mouse cursor enters card area.
- **Action**: Card flips 180 degrees on Y-axis.
- **Transition**: Smooth 0.6s rotation.
- **Cursor**: `pointer`.

### C. Active / Flipped (Back Side)
- **Visual**: Dark solid background (`bg-cinema-800`).
- **Content**: 
  - Plot summary (Text-sm, clamped to 4 lines).
  - Ratings (IMDb/Rotten Tomatoes icons).
  - Action Buttons (Add to Collection).
- **Buttons**:
  - "Add": Gold background, black text.
  - "Details": Transparent border, gold text.

## 2. Button States

### A. Primary Button (Theme: Dark)
- **Normal**: Gold background (`#FFD700`), Dark text (`#121212`).
- **Hover**: Scale up 1.05x, Shadow glow (`shadow-gold/50`).
- **Active (Click)**: Scale down 0.95x.
- **Disabled**: Opacity 50%, grayscale cursor `not-allowed`.

### B. Theme Toggle Button
- **Normal**: Circular, Transparent background, Icon (Sun/Moon).
- **Hover**: Background highlight (`bg-gray-200/10`), Rotate icon 15deg.
- **Active**: Quick scale animation.

## 3. Input Fields (Search)

### A. Idle
- **Border**: 1px solid Gray/Cinema-700.
- **Background**: Dark/White.
- **Placeholder**: "Search for..." (Opacity 60%).

### B. Focused
- **Border**: Gold (Dark) / Indigo (Light).
- **Ring**: 4px spread, 20% opacity of border color.
- **Effect**: Background glow intensifies.

### C. Filled
- **Text**: High contrast (White/Black).
- **Icon**: Clear (X) icon appears on right (if implemented).

## 4. Navigation Links

### A. Normal
- **Text**: Gray-400 (Dark) / Gray-600 (Light).
- **Icon**: Same color as text.

### B. Active (Current Page)
- **Background**: `bg-cinema-800` (Dark) / `bg-indigo-50` (Light).
- **Text**: Gold (Dark) / Indigo (Light).
- **Icon**: Gold (Dark) / Indigo (Light).

### C. Hover
- **Text**: White (Dark) / Black (Light).
- **Background**: Slight tint.
