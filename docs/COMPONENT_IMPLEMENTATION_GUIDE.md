# Component Implementation Guide for Sales Report Redesign

## Component File References

### 1. Hero Card with Circular Gauge (Most Important for Sales Report)

**Reference Component:** `/src/components/credit/CreditStatusSummary.tsx` (lines 1-228)

**Use Case:** Daily/Weekly sales target progress

**Key Code Pattern:**
```tsx
// Import necessary utilities
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// Calculate circular gauge progress
const circleProgress = Math.min(utilization_percentage, 100);
const circumference = 2 * Math.PI * 58; // radius of 58
const strokeDashoffset = circumference - (circleProgress / 100) * circumference;

// Render circular SVG
<svg width="140" height="140" className="transform -rotate-90">
  <circle cx="70" cy="70" r="58" stroke="currentColor" 
          strokeWidth="10" fill="none" className="text-gray-200" />
  <circle cx="70" cy="70" r="58" stroke="currentColor" 
          strokeWidth="10" fill="none" strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          className="text-green-600 transition-all duration-1000" />
</svg>

// 3-column layout
<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
  {/* Left: Gauge */}
  {/* Middle: Supporting metrics */}
  {/* Right: Hero metric in white card */}
</div>
```

**Why It Works:**
- Immediate visual understanding (gauge is first thing you see)
- Responsive grid layout
- Clear metric hierarchy
- Status badge provides context

---

### 2. Simple Metric Card

**Reference Component:** `/src/components/credit/CreditStatusIndicator.tsx` (lines 112-220)

**Use Case:** Individual sales metrics (region, product, agent)

**Key Features:**
- Configurable sizes (sm, md, lg)
- Status-based coloring
- Responsive design
- Hover states

**Minimal Implementation:**
```tsx
<Card className="shadow-md border-2 border-green-200">
  <CardContent className="p-6">
    {/* Icon and title */}
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-green-100">
        <TrendingUp className="h-5 w-5 text-green-600" />
      </div>
      <h3 className="text-lg font-semibold">Region Norte</h3>
    </div>
    
    {/* Value */}
    <p className="text-3xl font-bold text-gray-900 mb-3">$125,000</p>
    
    {/* Status */}
    <Badge className="bg-green-50 text-green-700">87% Target</Badge>
  </CardContent>
</Card>
```

---

### 3. Grouped Information Display

**Reference Component:** `/src/components/credit/CreditTermsCard.tsx` (lines 403-524)

**Use Case:** Detailed metrics breakdown, form displays

**Key Patterns:**
- Primary info in larger text
- Uppercase labels with tracking
- Dividers between sections
- Secondary info smaller

**Code Pattern:**
```tsx
<div className="space-y-6">
  {/* Primary section */}
  <div className="space-y-2">
    <label className="text-xs uppercase tracking-wide text-muted-foreground">
      Total Sales Today
    </label>
    <p className="text-3xl font-bold">$456,789</p>
  </div>

  {/* Divider */}
  <div className="border-t" />

  {/* Secondary section */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">
        Total Orders
      </label>
      <p className="text-lg font-semibold">142</p>
    </div>
    
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">
        Average Order Value
      </label>
      <p className="text-lg font-semibold">$3,221</p>
    </div>
  </div>
</div>
```

---

### 4. Comparison View (Current vs Projected)

**Reference Component:** `/src/components/credit/CreditContextPanel.tsx` (lines 297-416)

**Use Case:** Period-over-period comparison, target vs actual

**Key Pattern:**
```tsx
{/* Current section */}
<div className="space-y-3">
  <h4 className="font-semibold text-sm">Mes Anterior</h4>
  <div className="grid grid-cols-3 gap-3">
    <div className="p-3 bg-muted rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">Total</p>
      <p className="font-bold">$250,000</p>
    </div>
    {/* More metrics */}
  </div>
</div>

{/* Divider */}
<div className="border-t pt-3" />

{/* Projected section */}
<div className="space-y-3">
  <h4 className="font-semibold text-sm flex items-center gap-2">
    <TrendingUp className="h-4 w-4" />
    Proyección Este Mes
  </h4>
  {/* Metrics */}
</div>
```

---

### 5. Alert/Warning Patterns

**Reference Component:** Multiple - `/src/components/credit/CreditContextPanel.tsx` (lines 461-476)

**Use Cases:** 
- Over limit warnings
- Performance alerts
- Action required notifications

**Code Pattern:**
```tsx
{/* Error State */}
<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-red-900">Target Not Met</p>
      <p className="text-sm text-red-700 mt-1">
        Sales are 15% below target. Review region performance.
      </p>
    </div>
  </div>
</div>

{/* Warning State */}
<div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-orange-900">Approaching Threshold</p>
      <p className="text-sm text-orange-700 mt-1">
        Two regions approaching maximum capacity.
      </p>
    </div>
  </div>
</div>

{/* Info State */}
<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
  <div className="flex items-start gap-3">
    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-blue-900">Update Available</p>
      <p className="text-sm text-blue-700 mt-1">
        Latest data available - last updated 5 minutes ago
      </p>
    </div>
  </div>
</div>
```

---

### 6. Progress Indicator

**Reference Component:** `/src/components/credit/PaymentComplianceView.tsx` (lines 269-293)

**Use Case:** Progress towards target, completion percentage

**Implementation:**
```tsx
import { Progress } from '@/components/ui/progress';

// Calculate percentage
const progressPercent = (currentValue / targetValue) * 100;

// Render with status-based color
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Daily Sales Progress</span>
    <span className="font-medium">{Math.round(progressPercent)}%</span>
  </div>
  <Progress
    value={Math.min(progressPercent, 100)}
    className={`h-2 ${
      progressPercent >= 100
        ? '[&>div]:bg-green-600'
        : progressPercent >= 80
        ? '[&>div]:bg-blue-600'
        : progressPercent >= 50
        ? '[&>div]:bg-orange-500'
        : '[&>div]:bg-red-600'
    }`}
  />
</div>
```

---

### 7. Accordion/Collapsible Sections

**Reference Component:** `/src/components/credit/CreditManagementView.tsx` (lines 64-130)

**Use Case:** Detailed breakdowns, expandable sections

**Full Pattern:**
```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

<Accordion type="multiple" defaultValue={['summary', 'details']}>
  {/* Section 1 */}
  <AccordionItem value="summary" className="border rounded-lg bg-white shadow-sm">
    <AccordionTrigger className="px-6 py-4 hover:no-underline">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-blue-600" />
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-base">Daily Summary</h3>
          <p className="text-sm text-gray-500">Today's sales metrics</p>
        </div>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-6 pb-6">
      {/* Daily metrics content */}
    </AccordionContent>
  </AccordionItem>

  {/* Section 2 */}
  <AccordionItem value="details" className="border rounded-lg bg-white shadow-sm">
    <AccordionTrigger className="px-6 py-4 hover:no-underline">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <LineChart className="h-5 w-5 text-green-600" />
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-base">Detailed Analysis</h3>
          <p className="text-sm text-gray-500">Sales by region and product</p>
        </div>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-6 pb-6">
      {/* Detailed breakdown */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

### 8. Empty State

**Reference Component:** `/src/components/credit/CreditStatusSummary.tsx` (lines 75-98)

**Use Case:** No data available, configuration needed

**Pattern:**
```tsx
<Card className="border-2 border-dashed border-gray-300 bg-gray-50/50">
  <CardContent className="p-8 text-center">
    <div className="max-w-md mx-auto">
      {/* Icon in circle */}
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <BarChart3 className="h-10 w-10 text-gray-400" />
      </div>
      
      {/* Messaging */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No Data Available
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Sales data for this period is not yet available. Check back later.
      </p>
      
      {/* Action */}
      <Button onClick={onRefresh} size="lg" className="gap-2">
        <RefreshCw className="h-5 w-5" />
        Refresh Data
      </Button>
    </div>
  </CardContent>
</Card>
```

---

## Layout Template for Sales Report Page

### Full Page Structure

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function SalesReportPage() {
  return (
    <div className="space-y-6 p-6">
      {/* 1. Hero Section - Daily Overview */}
      <Card className="shadow-lg border-2 border-blue-200">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Circular gauge */}
            {/* Supporting metrics */}
            {/* Hero highlight */}
          </div>
        </CardContent>
      </Card>

      {/* 2. Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-2">
          <CardContent className="p-6">
            {/* Individual metric */}
          </CardContent>
        </Card>
        {/* More metric cards */}
      </div>

      {/* 3. Collapsible Sections */}
      <Accordion type="multiple" defaultValue={['summary']}>
        {/* Accordion items */}
      </Accordion>

      {/* 4. Alerts (if needed) */}
      {warningExists && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          {/* Alert content */}
        </div>
      )}
    </div>
  );
}
```

---

## Color Mapping Examples for Sales Metrics

```tsx
// Function to determine status color
const getPerformanceColor = (actual, target) => {
  const percent = (actual / target) * 100;
  
  if (percent >= 100) {
    return {
      bg: 'bg-green-50',
      text: 'text-green-700',
      dot: 'bg-green-500',
      label: 'Exceeding Target'
    };
  } else if (percent >= 80) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      dot: 'bg-blue-500',
      label: 'On Track'
    };
  } else if (percent >= 60) {
    return {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      dot: 'bg-orange-500',
      label: 'Below Target'
    };
  } else {
    return {
      bg: 'bg-red-50',
      text: 'text-red-700',
      dot: 'bg-red-500',
      label: 'Critical'
    };
  }
};

// Usage
const color = getPerformanceColor(45000, 50000);
<Badge className={`${color.bg} ${color.text} border-0`}>
  <span className={`inline-block w-2 h-2 rounded-full ${color.dot} mr-2`} />
  {color.label}
</Badge>
```

---

## Responsive Design Checklist

All layouts should use these patterns:

```tsx
// Mobile-first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  {/* Stacked on mobile (cols-1) */}
  {/* 2 columns on tablet (md:cols-2) */}
  {/* 3 columns on desktop (lg:cols-3) */}
</div>

// Common breakpoints used
md:  768px  (tablets)
lg:  1024px (desktops)
xl:  1280px (large screens)
```

---

## Testing This Implementation

1. Check that all colors come from design-system
2. Verify spacing uses 4px scale multiples
3. Ensure typography sizes follow system
4. Test responsive layouts at md breakpoint
5. Verify status indicators are semantic (color = meaning)
6. Check icons pair with text (no orphaned icons)
7. Verify empty states are helpful
8. Test alert states render correctly

---

## Copy-Paste Ready Components

### Quick Metric Card
```tsx
export function MetricCard({ icon: Icon, label, value, percent, status }) {
  const colors = {
    healthy: 'bg-green-50 text-green-700',
    warning: 'bg-orange-50 text-orange-700',
    critical: 'bg-red-50 text-red-700'
  };

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-sm">{label}</h3>
        </div>
        <p className="text-3xl font-bold mb-3">{value}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{percent}% Target</span>
          <Badge className={`${colors[status]} border-0`}>{status}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Status Badge Component
```tsx
export function StatusBadge({ label, status }) {
  const colors = {
    healthy: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    warning: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' }
  };

  const color = colors[status];
  return (
    <Badge className={`${color.bg} ${color.text} border-0 px-3 py-1`}>
      <span className={`inline-block w-2 h-2 rounded-full ${color.dot} mr-2`} />
      {label}
    </Badge>
  );
}
```

