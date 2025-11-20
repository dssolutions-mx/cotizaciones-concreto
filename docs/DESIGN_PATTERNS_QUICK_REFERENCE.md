# Apple HIG Design Patterns - Quick Reference

## Color Cheat Sheet

```tsx
// Semantic Status Colors
healthy:     bg-green-50,   text-green-700,   border-green-200
warning:     bg-yellow-50,  text-yellow-700,  border-yellow-200
critical:    bg-orange-50,  text-orange-700,  border-orange-200
error:       bg-red-50,     text-red-700,     border-red-200
info:        bg-blue-50,    text-blue-700,    border-blue-200

// Apple System Colors
primaryAction:    #007AFF (systemBlue)
positive:         #34C759 (systemGreen)
warning:          #FF9500 (systemOrange)
danger:           #FF3B30 (systemRed)
```

## Spacing Quick Ref

```
p-4 or gap-4   = 16px  (most common)
p-6 or gap-6   = 24px  (section spacing)
p-8 or gap-8   = 32px  (card padding/hero spacing)
```

## Layout Patterns

### Hero Card (3-column)
```tsx
<Card className="shadow-lg border-2 border-green-200">
  <CardContent className="p-8">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left: Visual element (gauge, icon) */}
      {/* Middle: Supporting metrics (2-item stack) */}
      {/* Right: Secondary highlight (white bg card) */}
    </div>
  </CardContent>
</Card>
```

### Metric Card (Simple)
```tsx
<Card className="border-2 rounded-lg">
  <CardContent className="p-6">
    <h3 className="font-semibold text-lg">Title</h3>
    <p className="text-3xl font-bold text-gray-900 my-3">Value</p>
    <Badge className={getStatusBadge()}>Status</Badge>
  </CardContent>
</Card>
```

### Grouped List (Display Mode)
```tsx
<div className="space-y-6">
  <div>
    <label className="text-xs uppercase tracking-wide">Label</label>
    <p className="text-3xl font-bold">Primary Value</p>
  </div>
  <div className="border-t" />
  <div>
    <label className="text-xs uppercase tracking-wide">Label</label>
    <p className="text-lg font-semibold">Secondary Value</p>
  </div>
</div>
```

### Alert/Warning Box
```tsx
<div className="p-4 bg-red-50 border border-red-200 rounded-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
    <div>
      <p className="font-semibold text-red-900">Title</p>
      <p className="text-sm text-red-700 mt-1">Description</p>
    </div>
  </div>
</div>
```

### Accordion Section (Progressive Disclosure)
```tsx
<AccordionItem value="id" className="border rounded-lg bg-white shadow-sm">
  <AccordionTrigger className="px-6 py-4 hover:no-underline">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-blue-100">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <div className="text-left">
        <h3 className="font-semibold">Title</h3>
        <p className="text-sm text-gray-500">Subtitle</p>
      </div>
    </div>
  </AccordionTrigger>
  <AccordionContent className="px-6 pb-6">
    {/* Content */}
  </AccordionContent>
</AccordionItem>
```

## Typography Sizing

```
Page Title:     text-2xl font-bold
Card Title:     text-lg font-semibold
Primary Value:  text-3xl font-bold (or text-2xl)
Secondary:      text-lg font-semibold
Body:           text-sm (default)
Label:          text-xs uppercase tracking-wide
Badge:          text-sm font-medium
```

## Icon Sizing

```
In cards:     h-5 w-5
Large hero:   h-8 w-8 or h-6 w-6
In labels:    h-4 w-4 or h-3 w-3
Badges:       h-3 w-3 or h-4 w-4
```

## Border Radius

```
rounded      = 12px  (buttons, inputs, standard)
rounded-lg   = 16px  (cards)
rounded-2xl  = 24px  (hero cards)
rounded-full = 9999px (pills/badges)
```

## Common Class Combinations

```tsx
// Card header
<div className="flex items-start justify-between pb-4 border-b">
  <h2 className="text-2xl font-bold">Title</h2>
  <Badge>Status</Badge>
</div>

// Metric display
<div className="space-y-2">
  <p className="text-sm text-gray-600">Label</p>
  <p className="text-3xl font-bold text-gray-900">Value</p>
</div>

// Grid of metrics
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* 3-column on desktop, stacked on mobile */}
</div>

// Section with icon
<div className="flex items-center gap-3">
  <Icon className="h-5 w-5 text-blue-600" />
  <p className="text-sm font-medium">Label</p>
</div>

// Status indicator
<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
     style={{backgroundColor: statusColor.bg}}>
  <Icon className="h-4 w-4" />
  Status Label
</div>
```

## Shadow Patterns

```
shadow-sm   = subtle (hover state)
shadow-lg   = card shadows
shadow-xl   = not used in credit components
```

## Forms Pattern

### Field with Validation
```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel className="text-sm font-semibold">Label</FormLabel>
      <FormControl>
        <Input placeholder="..." className="h-12" {...field} />
      </FormControl>
      <FormDescription className="text-xs">Helper text</FormDescription>
      <FormMessage /> {/* Error appears here */}
    </FormItem>
  )}
/>
```

## Loading & Empty States

### Empty State
```tsx
<div className="border-2 border-dashed border-gray-300 bg-gray-50/50">
  <div className="text-center p-8">
    <Icon className="h-20 w-20 text-gray-400 mx-auto mb-4" />
    <h3 className="text-xl font-semibold mb-2">Title</h3>
    <p className="text-sm text-gray-600 mb-6">Description</p>
    <Button>Action</Button>
  </div>
</div>
```

### Loading Skeleton
```tsx
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-3/4" />
  </CardHeader>
  <CardContent className="space-y-3">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-full" />
  </CardContent>
</Card>
```

## Do's & Don'ts

### Do
- Use design-system colors
- Keep status colors consistent
- Use whitespace for grouping
- Size elements from typography system
- Include helpful empty states
- Use badges for status
- Pair icons with text
- Use dividers to separate sections

### Don't
- Hardcode colors
- Mix spacing scales
- Use decorative icons
- Overcomplicate badges
- Create custom font sizes
- Skip empty states
- Use too many colors
- Make status unclear

## Files to Reference

- Colors: `/src/lib/design-system/colors.ts`
- Typography: `/src/lib/design-system/typography.ts`
- Spacing: `/src/lib/design-system/spacing.ts`
- Border Radius: `/src/lib/design-system/borderRadius.ts`

## Real Examples in Codebase

- Hero card with gauge: `CreditStatusSummary.tsx`
- Grouped list: `CreditTermsCard.tsx`
- Comparison cards: `CreditContextPanel.tsx`
- Accordion sections: `CreditManagementView.tsx`
- Status indicator: `CreditStatusIndicator.tsx`
- Payment progress: `PaymentComplianceView.tsx`

