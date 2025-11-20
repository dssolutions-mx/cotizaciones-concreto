# Apple HIG Design Patterns Analysis - Credit Info Implementation

## Executive Summary

The credit info implementation demonstrates sophisticated Apple Human Interface Guidelines (HIG) design patterns used throughout the cotizaciones-concreto application. These patterns prioritize clarity, hierarchy, and intuitive information presentation through carefully crafted visual and interaction design.

---

## 1. UI COMPONENTS & STYLING PATTERNS

### 1.1 Color System - Apple System Colors

**Design Files:** `/src/lib/design-system/colors.ts`

The application uses Apple's native system colors for semantic meaning:

```typescript
// Primary Actions (Apple System Colors)
systemBlue: '#007AFF'      // Primary actions, interactive elements
systemGreen: '#34C759'     // Positive states, available credit
systemOrange: '#FF9500'    // Warning states, caution levels
systemRed: '#FF3B30'       // Critical states, errors

// Neutrals (6-level gray scale - matches iOS)
systemGray: {
  1: '#8E8E93',  // Primary labels
  2: '#AEAEB2',  // Secondary labels
  3: '#C7C7CC',  // Tertiary labels
  4: '#D1D1D6',  // Quaternary labels
  5: '#E5E5EA',  // Dividers
  6: '#F2F2F7'   // Light backgrounds
}
```

**Key Pattern:** Status colors are context-aware:
- **Green (healthy):** `bg-green-50 + text-green-700`
- **Yellow (warning):** `bg-yellow-50 + text-yellow-700`
- **Orange (critical):** `bg-orange-50 + text-orange-700`
- **Red (over_limit):** `bg-red-50 + text-red-700`

### 1.2 Typography System

**Design Files:** `/src/lib/design-system/typography.ts`

Apple HIG-compliant typography with SF Pro font family:

```typescript
largeTitle: { fontSize: '34px', fontWeight: 700, lineHeight: '41px' }
title1:     { fontSize: '28px', fontWeight: 700, lineHeight: '34px' }
title2:     { fontSize: '22px', fontWeight: 700, lineHeight: '28px' }
title3:     { fontSize: '20px', fontWeight: 600, lineHeight: '25px' }
body:       { fontSize: '17px', fontWeight: 400, lineHeight: '22px' }
callout:    { fontSize: '16px', fontWeight: 400, lineHeight: '21px' }
footnote:   { fontSize: '13px', fontWeight: 400, lineHeight: '18px' }
caption:    { fontSize: '12px', fontWeight: 400, lineHeight: '16px' }
```

**Font Stack:** `'SF Pro Text', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Inter'`

### 1.3 Spacing System

**Design Files:** `/src/lib/design-system/spacing.ts`

4px-based spacing scale (Apple's preferred approach):

```typescript
0: '0px',
1: '4px',   // Micro adjustments
2: '8px',   // Component internal padding
3: '12px',  // Close relationship
4: '16px',  // Standard padding (MOST COMMON)
5: '20px',  // Medium separation
6: '24px',  // Section separation
8: '32px',  // Major section gaps
```

**Pattern:** Credit Status Summary uses:
- Internal card padding: `p-8` (32px)
- Section spacing: `gap-8` (32px)
- Grid items: `gap-6` or `gap-4`

### 1.4 Border Radius

**Design Files:** `/src/lib/design-system/borderRadius.ts`

```typescript
none: '0px',
sm: '8px',           // Subtle roundness
DEFAULT: '12px',     // Most common (standard buttons, inputs)
lg: '16px',          // Cards, large components
xl: '20px',          // Hero elements
2xl: '24px',         // Maximum roundness for emphasis
3xl: '28px',
full: '9999px'       // Pills (status badges)
```

**Example in Credit Status Summary:**
- Card container: `rounded-2xl` (for hero section)
- Standard containers: `rounded-lg` (16px)
- Badge pills: Implicit full (99999px)

---

## 2. LAYOUT PATTERNS

### 2.1 Visual Hierarchy - The "Hero + Supporting" Pattern

**Component:** `CreditStatusSummary.tsx`

Three-column layout establishing clear information hierarchy:

```
┌─────────────────────────────────────────────────┐
│ STATUS HEADER (Title + Badge)                   │
├─────────────────────────────────────────────────┤
│ ┌──────────┬──────────────┬──────────────────┐  │
│ │  HERO    │  SUPPORTING  │   SECONDARY      │  │
│ │ Circular │   Financial  │   (Available)    │  │
│ │ Progress │    Details   │   HIGHLIGHTED    │  │
│ │   (%)    │   (2-cols)   │   (whitebg)      │  │
│ └──────────┴──────────────┴──────────────────┘  │
│                                                 │
│ [Payment Status Bar - Secondary Info]          │
└─────────────────────────────────────────────────┘
```

**Key Pattern - Information Weight:**
1. **Hero Section** (Left): Visual gauge with percentage - catches eye first
2. **Supporting** (Middle): Two financial metrics in grid
3. **Secondary** (Right): Available credit in prominent white card with TrendingUp icon

### 2.2 Card-Based Information Organization

**Components:** `CreditTermsCard.tsx`, `CreditContextPanel.tsx`

Uses Apple's "grouped list" metaphor in web form:

```
Display Mode:
┌─ Header (label + status badge)
├─ Grouped Rows
│  ├─ Primary: Credit Limit (text-3xl bold)
│  ├─ Primary: Payment Instrument (text-3xl bold)
│  ├─ Divider
│  ├─ Secondary: Payment Frequency
│  ├─ Secondary: Grace Period
│  ├─ Secondary: Pagaré Expiry (with warning)
│  ├─ Divider
│  └─ Notes (Full width, bg-gray-50)
└─ Footer (Action buttons)
```

**Styling Pattern:**
```tsx
// Primary information
<label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
  LÍMITE DE CRÉDITO
</label>
<p className="text-3xl font-bold text-foreground">
  $250,000
</p>

// Secondary information
<label className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
  Frecuencia de Pago
</label>
<p className="text-lg font-semibold text-foreground">
  Cada 30 días
</p>
```

### 2.3 Accordion-Based Progressive Disclosure

**Component:** `CreditManagementView.tsx`

Uses expandable accordions following Apple's disclosure pattern:

```tsx
<Accordion type="multiple" defaultValue={['terms', 'documents']}>
  <AccordionItem value="terms" className="border rounded-lg bg-white shadow-sm">
    <AccordionTrigger className="px-6 py-4 hover:no-underline">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-base">Términos y Condiciones</h3>
          <p className="text-sm text-gray-500">Subtitle explaining contents</p>
        </div>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-6 pb-6">
      {/* Content */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Benefits:**
- Maintains focus on hero content (Credit Status Summary)
- Reveals detail sections on demand
- Matches iOS Settings/Health app patterns

---

## 3. MODERN DESIGN ELEMENTS

### 3.1 Status Indicator Components - Visual Consistency

**Component:** `CreditStatusIndicator.tsx`

Uses **circular gauge pattern** (Apple Health inspired):

```typescript
// Configurable sizes for responsive design
sizeConfig = {
  sm: { gauge: 80, strokeWidth: 6 },
  md: { gauge: 120, strokeWidth: 8 },
  lg: { gauge: 160, strokeWidth: 10 }
}

// SVG-based progress visualization
<svg width={gaugeSize} height={gaugeSize} className="transform -rotate-90">
  {/* Background circle (light gray) */}
  <circle cx={center} cy={center} r={radius} stroke="#E5E7EB" />
  
  {/* Progress circle (colored based on status) */}
  <circle
    cx={center} cy={center} r={radius}
    stroke={colorScheme.primary}
    strokeDasharray={circumference}
    strokeDashoffset={offset}
    strokeLinecap="round"
    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
  />
</svg>

{/* Center content */}
<div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="font-bold text-3xl">{Math.round(utilization_percentage)}%</span>
  <span className="text-xs text-muted-foreground">Utilizado</span>
</div>
```

**Why This Pattern?**
- Immediate visual understanding of status at a glance
- Matches Apple Health app aesthetic
- Scales responsively
- Smooth animations

### 3.2 Progress Bars - Subtle Intensity Coding

**Component:** `PaymentComplianceView.tsx`

```tsx
<Progress
  value={progressPercentage}
  className={`h-2 ${
    is_overdue
      ? '[&>div]:bg-red-600'
      : compliance_status === 'approaching_due'
      ? '[&>div]:bg-orange-500'
      : '[&>div]:bg-green-600'
  }`}
/>
```

**Pattern:** Color progression indicates severity:
- Green (0-70%): Healthy
- Orange (70-90%): Approaching threshold
- Red (90%+): Critical

### 3.3 Empty States - Helpful Guidance Pattern

**Component:** `CreditStatusSummary.tsx` (when !has_terms)

```tsx
<Card className="border-2 border-dashed border-gray-300 bg-gray-50/50">
  <CardContent className="p-8 text-center">
    <div className="max-w-md mx-auto">
      {/* Icon in circle */}
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Settings className="h-10 w-10 text-gray-400" />
      </div>
      
      {/* Clear messaging */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        Crédito No Configurado
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Descriptive explanation of what's missing and why it matters
      </p>
      
      {/* Single clear action */}
      <Button onClick={onConfigureClick} size="lg" className="gap-2">
        <Settings className="h-5 w-5" />
        Configurar Crédito
      </Button>
    </div>
  </CardContent>
</Card>
```

**Apple Pattern Elements:**
- Dashed border indicates "not configured yet"
- Icon in circular background (iOS-native style)
- Clear, single call-to-action
- Helpful explanatory text

### 3.4 Status Badges - Semantic Coloring

**Pattern:** Context-aware badge styling

```tsx
<Badge className={`${colors.bg} ${colors.text} border-0 px-3 py-1`}>
  <span className={`inline-block w-2 h-2 rounded-full ${colors.dot} mr-2`} />
  {getStatusLabel()}
</Badge>
```

**Semantic Mapping:**
```
Status          Badge Style              Meaning
─────────────────────────────────────────────────
healthy         green-50 + green-700     "All good"
warning         yellow-50 + yellow-700   "Watch out"
critical        orange-50 + orange-700   "Pay attention"
over_limit      red-50 + red-700         "Action needed"
```

---

## 4. INFORMATION PRESENTATION PATTERNS

### 4.1 Hierarchical Information Display

**Principle:** Lead with the most important metric, progressively disclose details

**Credit Status Summary Example:**

```
LEVEL 1 (Immediate): 
  Circular gauge showing utilization %
  Single status badge (Healthy/Warning/Critical)

LEVEL 2 (Quick scan):
  Limit of Credit
  Current Balance
  Available Credit (HERO - white card)

LEVEL 3 (Deep dive):
  Last Payment Date
  Payment compliance badge
```

### 4.2 Form Display Mode vs Edit Mode

**Component:** `CreditTermsCard.tsx`

**Display Mode** - Read-only with visual emphasis:
```
Headers: UPPERCASE, tracking-wide, text-xs
Values: Sized by importance
  - Primary (credit_limit): text-3xl bold
  - Secondary (payment_frequency): text-lg
  - Supporting: text-sm

Grouping: Dividers separate sections
  - Primary info (credit terms)
  - Secondary info (payment terms)
  - Tertiary info (notes/documents)
```

**Edit Mode** - Clean form with established hierarchy:
```
FormField structure:
  - Label (font-semibold)
  - Input (h-12, text-lg for primary)
  - FormDescription (text-xs)
  - FormMessage (error state)

Sections grouped with:
  - Section title (uppercase, tracking-wide)
  - Grid layout (grid-cols-1 md:grid-cols-2)
  - Border dividers between sections
```

### 4.3 Comparison Visualization Pattern

**Component:** `CreditContextPanel.tsx`

Shows current state vs projected state side-by-side:

```
CURRENT STATE          →    PROJECTED STATE
┌──────────────┐           ┌──────────────┐
│ Limit        │           │ Limit        │
│ Current Bal. │           │ Projected    │
│ Available    │    Order  │ Projected    │
│ Utilization% │    +$50k  │ Utilization% │
└──────────────┘           └──────────────┘
```

**Code Pattern:**
```tsx
<div className="space-y-3">
  <h4 className="font-semibold text-sm">Estado Actual</h4>
  <div className="grid grid-cols-3 gap-3">
    <div className="p-3 bg-muted rounded-lg">
      {/* Current metric */}
    </div>
    {/* More metrics */}
  </div>
</div>

<div className="space-y-3 pt-3 border-t">
  <h4 className="font-semibold text-sm flex items-center gap-2">
    <TrendingUp className="h-4 w-4" />
    Impacto de Este Pedido
  </h4>
  {/* Impact visualization */}
</div>
```

### 4.4 Alert/Warning Display Pattern

**Component:** Multiple (CreditContextPanel, PaymentComplianceView)

Critical information uses consistent pattern:

```tsx
<div className="p-4 bg-{color}-50 border border-{color}-200 rounded-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="h-5 w-5 text-{color}-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-{color}-900">Headline</p>
      <p className="text-sm text-{color}-700 mt-1">
        Explanation of why this matters and what action to take
      </p>
    </div>
  </div>
</div>
```

**Variants:**
- Error: Red (bg-red-50, border-red-200, text-red-700)
- Warning: Orange (bg-orange-50, border-orange-200, text-orange-700)
- Info: Blue (bg-blue-50, border-blue-200, text-blue-700)

---

## 5. KEY DESIGN PRINCIPLES APPLIED

### 5.1 Visual Hierarchy Through Scale

```
SIZE RELATIONSHIP
Title:        24px (1.5rem) → Eye catches first
Value:        32px (2rem) or 28px → Primary info
Meta:         16px (1rem) → Supporting context
Label:        12-13px → Descriptive text
```

### 5.2 Whitespace as Structure

- Card padding: `p-8` (32px) creates breathing room
- Gap between items: `gap-8` or `gap-6` prevents visual crowding
- Dividers (border-t) mark section breaks
- Grouped sections with vertical rhythm

### 5.3 Color as Meaning (Not Decoration)

Every color choice communicates:
- **Green:** Positive, healthy, available
- **Orange:** Caution, approaching threshold
- **Red:** Danger, action required
- **Blue:** Informational, system-level
- **Gray:** Neutral, secondary, inactive

### 5.4 Icons as Language

- Used purposefully (not for decoration)
- Always paired with text for clarity
- Color-coded to match status
- Size scales with context: `h-4 w-4` (small), `h-5 w-5` (medium), `h-6 w-6` (large)

### 5.5 Consistency Through Systems

- All colors from design-system
- All spacing from predefined scale
- All border radius from set values
- All typography from typography system
- Font family: Apple-first stack (SF Pro → system defaults)

---

## 6. ACTIONABLE PATTERNS FOR SALES REPORT REDESIGN

### 6.1 Core Components to Replicate

**For Sales Metrics Dashboard:**

1. **Circular Gauge Pattern** (from CreditStatusIndicator)
   ```
   Use for: Daily sales targets, conversion rates
   Benefits: Immediate comprehension of performance vs target
   ```

2. **Hero + Supporting Layout** (from CreditStatusSummary)
   ```
   Layout: 3-column grid
   Use for: Top-level metrics (total revenue, orders, etc.)
   Hero section: Main KPI (revenue)
   Supporting: Related metrics (order count, avg value)
   Secondary: Highlight (trend indicator)
   ```

3. **Comparison Cards** (from CreditContextPanel)
   ```
   Use for: Period-over-period comparison
   Current vs previous month/quarter
   Target vs actual performance
   ```

4. **Accordion Sections** (from CreditManagementView)
   ```
   Use for: Detailed breakdowns
   Sales by region/product/agent
   Historical trends
   Expandable for progressive disclosure
   ```

### 6.2 Specific UI Components to Use

**Primary Components (High Frequency):**
- Card with shadow-lg border-2
- Badge for status indicators
- Progress bars for targets
- Circular SVG gauges

**Secondary Components:**
- Grid layouts (2-3 columns typical)
- Status dividers (border-t)
- Icon + text pairs (for labels)
- Color-coded backgrounds for emphasis

### 6.3 Color Palette for Sales Report

```
Metrics Performance:
- Exceeding target:  systemGreen (#34C759)
- On track:          systemBlue (#007AFF)
- Below target:      systemOrange (#FF9500)
- Critical:          systemRed (#FF3B30)

Product Lines:
- Use different neutral grays from systemGray scale
- Avoid using green/red for product differentiation
```

### 6.4 Spacing & Layout Blueprint

**Page structure:**
```
1. Hero Section (Credit-style status)
   - Large circular gauge or big number
   - Status badge
   - Key metric explanation
   - Padding: p-8 min

2. Supporting Metrics Grid
   - 2-3 columns
   - Gap-6 between items
   - Cards with rounded-lg

3. Detailed Tables/Charts
   - Use accordion to expand
   - Keep default collapsed if not primary info

4. Footer/Actions
   - Right-aligned action buttons
   - Use consistent Button variants
```

### 6.5 Interactive Patterns to Implement

1. **Status-aware styling** - Colors change based on KPI performance
2. **Smooth transitions** - Use CSS transitions for gauge animations (0.5s ease)
3. **Hover states** - Cards lift on hover (shadow change)
4. **Loading states** - Skeleton loaders matching card layouts
5. **Error handling** - Consistent alert pattern (red-50 bg with icon)

---

## 7. DESIGN TOKEN REFERENCE

### Colors Used in Credit Components
```
Primary accent:   #007AFF (systemBlue)
Success:          #34C759 (systemGreen)
Warning:          #FF9500 (systemOrange)
Error:            #FF3B30 (systemRed)

Backgrounds:
  - White:        #FFFFFF
  - Gray 6:       #F2F2F7 (light backgrounds)
  - Gray 5:       #E5E5EA (dividers)
  
Text:
  - Primary:      #000000
  - Secondary:    rgba(60, 60, 67, 0.6)
  - Tertiary:     rgba(60, 60, 67, 0.3)
```

### Spacing Scale (Used)
```
Most common: 16px (p-4, gap-4)
Large cards: 32px (p-8, gap-8)
Between sections: 24px (p-6, gap-6)
Micro spacing: 8px or 12px (tight components)
```

### Border Radius (Used in Credit Components)
```
Cards:        rounded-lg (16px)
Hero cards:   rounded-2xl (24px)
Buttons:      rounded (12px default)
Pills/badges: rounded-full
Input fields: rounded (12px)
```

---

## 8. CODE EXAMPLES FOR SALES REPORT

### Example 1: Daily Sales Hero Card

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

export function DailySalesHero() {
  return (
    <Card className="bg-white shadow-lg border-2 border-green-200">
      <CardContent className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Circular gauge - Hero */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <svg width="140" height="140" className="transform -rotate-90">
                <circle cx="70" cy="70" r="58" stroke="currentColor" 
                        strokeWidth="10" fill="none" className="text-gray-200" />
                <circle cx="70" cy="70" r="58" stroke="currentColor" 
                        strokeWidth="10" fill="none" strokeDasharray={circumference}
                        strokeDashoffset={offset} strokeLinecap="round" 
                        className="text-green-600 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <TrendingUp className="h-8 w-8 text-green-600 mb-1" />
                <span className="text-3xl font-bold">87%</span>
                <span className="text-xs text-gray-600">Target</span>
              </div>
            </div>
          </div>

          {/* Supporting metrics */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Ventas Totales Hoy</p>
              <p className="text-2xl font-bold text-gray-900">$123,456</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Ordenes</p>
              <p className="text-2xl font-bold text-gray-900">34</p>
            </div>
          </div>

          {/* Hero value */}
          <div className="flex flex-col items-center justify-center bg-white rounded-2xl p-6 shadow-sm">
            <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-sm text-gray-600 mb-2">vs Ayer</p>
            <p className="text-4xl font-bold text-green-600">+12%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Example 2: Sales Performance Grid

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SalesMetricsGrid() {
  const metrics = [
    { label: 'Region Norte', value: '$45,000', status: 'healthy', percent: 92 },
    { label: 'Region Centro', value: '$38,000', status: 'warning', percent: 78 },
    { label: 'Region Sur', value: '$40,456', status: 'healthy', percent: 88 },
  ];

  const getStatusColor = (status) => {
    switch(status) {
      case 'healthy': return 'bg-green-50 text-green-700 border-green-200';
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {metrics.map((metric) => (
        <Card key={metric.label} className={`border-2 ${getStatusColor(metric.status).split(' ')[1]}-border`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-lg">{metric.label}</h3>
              <Badge className={getStatusColor(metric.status)}>
                {metric.percent}%
              </Badge>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-3">
              {metric.value}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  metric.percent >= 90 ? 'bg-green-600' : 
                  metric.percent >= 75 ? 'bg-yellow-500' : 
                  'bg-red-600'
                }`}
                style={{ width: `${metric.percent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## 9. COMMON MISTAKES TO AVOID

1. **Over-styling badges** - Keep them simple with just bg, text, and border
2. **Too many colors** - Stick to the semantic color system
3. **Inconsistent spacing** - Always use the spacing scale (4px multiples)
4. **Missing hierarchy** - Use size and weight to establish importance
5. **Cluttered cards** - Use whitespace and dividers to group information
6. **Non-responsive layouts** - Always include md: breakpoints for 2+ columns
7. **Decorative icons** - Every icon should communicate meaning
8. **Unclear empty states** - Always guide users on next action
9. **Missing status indicators** - Users should know state at a glance
10. **Inconsistent font sizes** - Use the typography system exclusively

---

## 10. TESTING CHECKLIST FOR SALES REPORT

- [ ] All colors from design-system
- [ ] Spacing follows 4px scale
- [ ] Typography uses predefined sizes
- [ ] Status indicators use semantic colors
- [ ] Responsive layouts (mobile-first)
- [ ] Empty states are helpful, not confusing
- [ ] Icons have labels or context
- [ ] Badges are consistent across app
- [ ] Cards have proper shadow and border
- [ ] Color accessibility (WCAG AA for contrast)
- [ ] Smooth transitions on interactive elements
- [ ] Loading states match card structure
- [ ] Error messages use alert pattern
- [ ] No hardcoded colors (use Tailwind + design system)
- [ ] Fonts fall back correctly

---

## SUMMARY

The credit info implementation demonstrates mature Apple HIG design through:
1. **Semantic color system** - Colors mean something specific
2. **Clear information hierarchy** - Size and placement guide attention
3. **Progressive disclosure** - Detail available on demand
4. **Responsive design** - Works on all screen sizes
5. **Consistency** - Design tokens applied uniformly
6. **Accessibility** - Colors, sizes, contrast all considered

For the sales report redesign, replicate these patterns, especially the hero card layout, circular gauges for progress, and the accordion-based progressive disclosure for detailed data.

