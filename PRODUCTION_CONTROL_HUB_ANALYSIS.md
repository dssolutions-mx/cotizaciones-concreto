# Production Control Hub Pattern Analysis

## Overview
The production control hub is implemented as **DosificadorDashboard** component (`/src/components/inventory/DosificadorDashboard.tsx`), which serves as the main hub page at `/production-control`. This is the "Centro de materiales" (Materials Center) that guides users through production workflows.

---

## 1. Page Structure & Architecture

### Entry Point
- **URL**: `/production-control/page.tsx` 
- **Component**: Minimal wrapper that renders `<DosificadorDashboard />`
- **Pattern**: Simple layout page that delegates to feature component

### Layout
- **File**: `/production-control/layout.tsx`
- **Structure**: 
  - Applies global styling with DM Sans + JetBrains Mono fonts
  - Sets background color `#f5f3f0` (warm beige)
  - Uses max-width container (6xl) for responsive grid
  - Responsive padding: `p-4 md:p-6`

---

## 2. Hub Page Layout Pattern

### Visual Hierarchy (Top to Bottom)
The hub uses a clear section-based layout to guide users through workflows:

#### 1. **Breadcrumb Navigation** (Line 292)
```
InventoryBreadcrumb component
```
Context navigation showing where user is in the app.

#### 2. **Header Section** (Lines 295-341)
- **Layout**: 2-column flex (responsive: stacks on mobile)
- **Left side**:
  - Main title: "Centro de materiales" (h1, text-2xl semibold)
  - Welcome message: "Bienvenido, {firstName} {lastName}"
  - Plant context: Badge showing current plant name + code
- **Right side**:
  - Date badge (current date in Spanish)
  - Refresh button with loading spinner
  - Last updated timestamp (monospace)
- **Styling**: 
  - Border: `border-stone-200`
  - Background: White
  - Border radius + padding (4-5)

#### 3. **Cross-Plant Alert Banner** (Lines 344-368)
- **Visibility**: Conditional - only shows if cross-plant items pending
- **Design**: 
  - Amber background (`bg-amber-50/90`)
  - Icon + descriptive text
  - Action button to navigate to cross-plant section
  - Pattern: Warning/informational context that guides next action

#### 4. **Material Health Strip** (Lines 371-454)
**Purpose**: Quick visual overview of inventory health
- **Header**:
  - Title: "Inventario por material" 
  - Status badges showing critical count + warning count
- **Content**: Horizontal scrolling material tiles
  - Each tile is 140-160px wide (responsive)
  - Shows material name (2-line clamp)
  - Health bar with color coding (emerald/amber/red)
  - Current stock in kg
  - Reorder point reference
- **Filtering**:
  - Category pills above the scroll strip
  - "Todos" button + individual category buttons
  - Buttons toggle between viewing all or filtered by category
- **States**:
  - Loading: 5 skeleton tiles
  - Error: Error message
  - Empty: "No hay registros"

#### 5. **Urgent Action Zone** (Lines 457-503)
**Purpose**: High-priority alerts requiring immediate attention
- **Visibility**: Only shows if `urgentItems.length > 0`
- **Design**:
  - Red border (2px, red-300)
  - Red background (`bg-red-50/60`)
  - Alert triangle icon
  - Title: "Acción urgente — conteo físico"
- **Content**: List of urgent items with:
  - Alert number (monospace)
  - Material name
  - Current stock
  - Time remaining badge (deadline countdown)
  - Red action button: "Confirmar conteo"

#### 6. **Action Stream (Primary Actions)** (Lines 506-564)
**Purpose**: Guide users to main workflows
- **Title**: "Acciones principales" (uppercase)
- **Grid**: `grid-cols-1 sm:grid-cols-2`
- **Card Design** (4 cards):
  1. **Registrar entrada** (Register Entry) - Sky blue
  2. **Solicitar material** (Request Material) - Emerald
  3. **Procesar Arkik** (Process Arkik Upload) - Violet
  4. **Servicio de bombeo** (Pumping Service) - Sky blue

- **Card Structure**:
  - Icon box (12x12 rem, colored background)
  - Title (semibold)
  - Description (xs, gray)
  - Chevron right icon (interactive indicator)
  - Hover state: Background color change
  - Full link wrapper (group pattern)

#### 7. **Secondary Tools** (Lines 567-593)
**Purpose**: Quick access to less-frequently-used features
- **Title**: "Más herramientas"
- **Grid**: `grid-cols-1 md:grid-cols-2`
- **Items**: 9 smaller link buttons in 2-column layout
  - Icons on left
  - Simple text link style
  - Smaller padding/font vs primary actions
- **Categories**:
  - Alerts
  - Lots
  - Adjustments
  - Reorder Config
  - Reports
  - Daily Log
  - Cross-plant
  - Time Clock
  - Remissions

#### 8. **Recent Activity Section** (Lines 598-641)
**Purpose**: Transparency into what's happening on the plant
- **Header**:
  - Activity icon + title "Actividad reciente"
  - Subtitle: "Últimas acciones en la planta"
  - Refresh button
- **Content**: Vertical list of activities
  - Activity-type icon (color-coded by type)
  - Action description
  - Details
  - Time ago (relative timestamp)
  - Completion status (green checkmark)
- **States**:
  - Loading: 3 skeleton rows
  - Empty: "Sin actividad reciente"

---

## 3. Visual Layout Pattern

### Grid System
- **Overall Container**: `space-y-6` (vertical stacking with gaps)
- **Primary action cards**: `grid-cols-1 sm:grid-cols-2` (2 columns on desktop)
- **Secondary tools**: `grid-cols-1 md:grid-cols-2` (2 columns on tablet+)

### Color Coding System
| Element | Color | Use |
|---------|-------|-----|
| Healthy Stock | Emerald | Good status |
| Warning Stock | Amber | Needs attention |
| Critical Stock | Red | Urgent action needed |
| Primary Actions | Sky Blue | Register entry, pumping |
| Secondary Actions | Emerald | Request material |
| Upload/Processing | Violet | Arkik uploads |
| Cross-plant Banner | Amber | Informational alert |
| Urgent Zone | Red | Critical alerts |

### Typography
- **Title**: text-2xl font-semibold tracking-tight (main h1)
- **Section headers**: text-sm font-semibold uppercase tracking-wide
- **Card titles**: font-semibold
- **Card descriptions**: text-xs text-stone-600
- **Metadata**: font-mono (timestamps, quantities)

### Spacing
- Main container: `p-4 md:p-6`
- Card padding: `p-4` (sections)
- Gap between sections: `space-y-6`
- Icon spacing: `gap-4` (in action cards)

---

## 4. Component Patterns Used

### Data Loading & State Management
```typescript
// Fetch on mount with cleanup
useCallback + useEffect pattern for async data
useState for: summary, activities, loading states
useMemo for: derived data (urgentItems, materialsGrouped, filteredForCategory)
useRef for: scroll position management
```

### Icon Strategy
- Uses lucide-react icons extensively
- **Icons per section**:
  - Activities: Icon varies by type (Package, Truck, Upload, etc.)
  - Actions: Large colored icon boxes with matching background
  - Tools: Small gray icons inline

### Responsive Design
- Mobile-first approach
- Key breakpoints:
  - `sm:` tablets/small desktop (640px)
  - `md:` larger desktop (768px)
- Examples:
  - Header: `flex-col gap-4 sm:flex-row sm:items-start`
  - Primary actions: `grid-cols-1 sm:grid-cols-2`
  - Secondary: `grid-cols-1 md:grid-cols-2`

### Interactivity Patterns
1. **Material Tiles** (horizontal scroll):
   - Click to open detail sheet
   - Tooltip on hover
   - Ring focus state (focus-visible:ring-2)

2. **Category Pills**:
   - Toggle filter state
   - Active pill: dark background
   - Inactive pill: light background

3. **Action Cards**:
   - Link wrapper (group pattern)
   - Hover: Background color change
   - Chevron icon hint
   - Focus ring on hover

4. **Detail Sheet**:
   - Material detail modal (MaterialDetailSheet component)
   - Controlled by `open` state
   - Shows detailed material info

### Error & Loading States
- **Skeleton loaders**: Placeholder grids during data fetch
- **Error messages**: Colored text (red for errors)
- **Empty states**: Contextual message
- **Disabled states**: On buttons during loading

---

## 5. Workflow Guidance Strategy

### Hub as Decision Tree
The hub guides users through several decision paths:

1. **Inventory Path**:
   - View material health strip
   - Filter by category
   - Click to see details
   - Take action if urgent

2. **Primary Operations Path**:
   - See action cards in logical order
   - Register entry → Manage → Process → Deliver

3. **Alert Response Path**:
   - Urgent items section appears first
   - Shows deadline countdown
   - Direct link to confirmation page

4. **Plant Context Path**:
   - Current plant always visible
   - Cross-plant alerts if applicable
   - Plant-specific data fetched

### Visual Hierarchy for Guidance
1. **Most Urgent**: Red urgent zone (top of content)
2. **Primary Focus**: Material health + action stream
3. **Needed Soon**: Secondary tools (collapsible conceptually)
4. **Context**: Activity feed + plant info

---

## 6. Data Flow

### API Endpoints Used
- `/api/inventory/dashboard-summary` - Get material inventory
- `/api/production-control/activities` - Get recent activities
- `/api/production-control/cross-plant-status` - Get cross-plant pending items

### Real-time Updates
- Manual refresh button
- Fetches on mount + when currentPlant changes
- Activities and cross-plant data loaded together
- Timestamps show last update time

---

## 7. Key Implementation Details

### Material Tile Rendering Logic
```typescript
// Dimensions & Health Bar
- Width: 140-160px (responsive)
- Health bar: width % = (current_stock / reorder_point) * 100
- Color: emerald (healthy), amber (warning), red (critical)

// Click Behavior
- Opens MaterialDetailSheet modal
- Passes material data + plant ID
```

### Category Filtering
```typescript
// Pills dynamically generated from materials
categoryPills = unique material categories, sorted

// Two rendering modes:
1. selectedCategory === null: Show all, grouped by category
2. selectedCategory === string: Show filtered, sorted by name
```

### Activity Icons by Type
```typescript
'inventory' action.includes('Entrada') → Package (blue)
'inventory' NOT includes('Entrada') → TrendingDown (amber)
'pumping' → Truck (sky blue)
'arkik' → Upload (violet)
'order' → FileText (emerald)
default → Activity (gray)
```

---

## 8. Key Design Decisions

1. **Two-tier Navigation**: 
   - Primary actions (4 cards, visually prominent)
   - Secondary tools (9 items, smaller, accessible but not prominent)

2. **Color Separation**:
   - Each primary action has unique color
   - Tells story of what type of action it is

3. **Horizontal Scroll for Inventory**:
   - Allows seeing many materials without overwhelming
   - Category filtering reduces cognitive load
   - Quick glance at health status

4. **Time-based Sorting**:
   - Activities sorted by recency
   - Material health visible at glance
   - Deadlines shown with countdown

5. **Lazy Loading Pattern**:
   - Sheet modal for details (doesn't load until needed)
   - Activities/cross-plant loaded in background
   - Summary data most critical

---

## 9. Accessibility Features

- Tooltips for material tiles (hover + keyboard)
- Focus rings on all interactive elements
- Semantic HTML (buttons, links, sections)
- Color + icons (not color alone for status)
- ARIA labels implied through component library
- Time-ago text (formatTimeAgo) for relative dates

---

## Summary for Quality Section Implementation

### What Makes This Hub Pattern Effective:

1. **Clear Visual Hierarchy**: Most urgent at top, then primary actions, then tools
2. **Contextual Guidance**: Section headers + descriptions tell users what to do
3. **Color Coding**: Visual language makes status instantly clear
4. **Multiple Access Patterns**: 
   - For experienced users: Quick links to secondary tools
   - For new users: Guided flow through primary actions
5. **Real-time Awareness**: Activities + timestamps keep users informed
6. **Progressive Disclosure**: Details available on-demand (modal sheet)
7. **Responsive**: Works on mobile through desktop with same info hierarchy

### Reusable Patterns for Quality Sections:
- Icon-boxed action cards (primary actions pattern)
- Status visualization with color + bar chart
- Filtering pills for categorization
- Activity feed format for recent events
- Urgent/alert zones in distinct color
- Card-based grid layout
- Horizontal scroll for dense data
