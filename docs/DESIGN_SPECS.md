# MediaTracker AI - Design Specifications

## 1. Color Palette

### Cinema Dark Theme (Primary)
| Name | Hex Code | Tailwind Class | Usage |
|------|----------|----------------|-------|
| **Cinema Black** | `#121212` | `bg-cinema-900` | Main Background |
| **Cinema Dark** | `#1a1a1a` | `bg-cinema-800` | Card/Panel Backgrounds |
| **Cinema Gold** | `#FFD700` | `text-cinema-gold` | Primary Actions, Highlights, Icons |
| **Cinema Amber** | `#FFC107` | `text-cinema-amber` | Gradients, Hover States |
| **Text Primary** | `#F3F4F6` | `text-gray-100` | Headings, Body Text |
| **Text Secondary** | `#9CA3AF` | `text-gray-400` | Meta info, Subtitles |

### Light Theme (Secondary)
| Name | Hex Code | Tailwind Class | Usage |
|------|----------|----------------|-------|
| **Background** | `#F9FAFB` | `bg-gray-50` | Main Background |
| **Surface** | `#FFFFFF` | `bg-white` | Cards, Panels |
| **Primary** | `#4F46E5` | `text-indigo-600` | Primary Actions |
| **Text Primary** | `#111827` | `text-gray-900` | Headings |

## 2. Typography

- **Font Family**: System Default Sans-Serif (SF Pro, Inter, Roboto, Segoe UI).
- **Weights**:
  - Regular (400): Body text.
  - Medium (500): Buttons, Navigation.
  - Bold (700): Headings.
  - Extra Bold (800): Hero Titles.

## 3. Spacing & Grid System

### Grid Layout
- **Columns**: 12-column system (implemented via Tailwind `grid-cols-*`).
- **Container**: `max-w-7xl mx-auto`.

### Breakpoints & Margins
| Device | Breakpoint | Margins (X-Axis) | Gaps |
|--------|------------|------------------|------|
| **Mobile** | `< 768px` | 3% (`px-[3%]`) | 12px |
| **Tablet** | `768px - 1024px` | 5% | 20px |
| **Desktop** | `> 1024px` | 5% (`px-[5%]`) | 24px |

## 4. Animation Parameters

### Transitions
- **Duration**: `300ms` (Standard for hover, theme switch).
- **Easing**: `ease-in-out`.

### 3D Effects
- **Perspective**: `1000px` (Applied to card container).
- **Transform**: `rotateY(180deg)` (Flip effect).
- **Backface Visibility**: `hidden` (To hide back of card when front is visible).

### Staggered Entrance
- **Base Delay**: `0s`.
- **Increment**: `0.1s` per item index.
- **Properties**: `Opacity` (0 -> 1), `TranslateY` (20px -> 0px).

## 5. Visual Effects

### Spotlight / Glow
- **Implementation**: Absolute positioned `div` with heavy blur.
- **Blur Radius**: `100px` to `120px`.
- **Opacity**: `0.2` to `0.3`.
- **Color**: Gold (Dark Mode) / Indigo (Light Mode).

### Shadows
- **Card Shadow**: `shadow-xl` (Tailwind default).
- **Glow Shadow**: Custom `shadow-[0_0_15px_rgba(255,215,0,0.5)]` for Gold elements.
