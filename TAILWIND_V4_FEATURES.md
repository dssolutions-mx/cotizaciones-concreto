# Tailwind CSS v4 New Features

This document outlines the new features available in Tailwind CSS v4 and how to use them in our project.

## Table of Contents
1. [CSS-First Configuration](#css-first-configuration)
2. [Container Queries](#container-queries)
3. [Logical Properties for RTL Support](#logical-properties)
4. [OKLCH Color System](#oklch-color-system)
5. [New Utilities](#new-utilities)
6. [Custom Variants](#custom-variants)

## CSS-First Configuration

Tailwind CSS v4 moves configuration from JavaScript to CSS. Our `globals.css` file now defines theme values using CSS variables in an `@theme` block:

```css
@theme {
  --color-primary-50: #f0fdf4;
  --color-primary-100: #dcfce7;
  --color-primary-500: #22c55e;
  --color-primary-600: #16a34a;
  --color-primary-700: #15803d;
  /* More color definitions */
}
```

This approach provides better performance and allows for more dynamic theme changes.

## Container Queries

Tailwind CSS v4 supports container queries for responsive design based on parent container width rather than viewport width.

### Usage Example:

```jsx
<div className="@container">
  <div className="@md:text-lg @lg:text-xl">
    This text will resize based on the container width
  </div>
</div>
```

This is particularly useful for creating reusable components that adapt to their parent container regardless of the overall viewport size.

## Logical Properties

Tailwind CSS v4 includes logical properties for RTL (right-to-left) support, making it easier to build internationalized interfaces.

### Usage Example:

```jsx
<div className="ps-4 pe-4 ms-2 me-2 border-s-2">
  <!-- This content will adapt to RTL languages -->
</div>
```

- `ps-4` = padding-start (works as padding-left in LTR, padding-right in RTL)
- `pe-4` = padding-end
- `ms-2` = margin-start
- `me-2` = margin-end
- `border-s-2` = border-start

## OKLCH Color System

Tailwind CSS v4 uses the OKLCH color system for better color consistency across browsers and devices. In our theme, you can define colors in OKLCH format:

```css
@theme {
  --color-primary-500: oklch(0.65 0.3 120);
}
```

## New Utilities

Tailwind CSS v4 introduces several new utility classes:

### Text Shadow

```jsx
<h1 className="text-shadow text-shadow-lg">Title with Shadow</h1>
```

### Element Masking

```jsx
<div className="mask mask-circle">
  <!-- Content with a circular mask -->
</div>
```

### Colored Drop Shadows

```jsx
<div className="shadow-lg shadow-primary-500/50">
  <!-- Shadow with primary color at 50% opacity -->
</div>
```

### Improved Grid Layouts

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 place-items-center">
  <!-- Content -->
</div>
```

## Custom Variants

Tailwind CSS v4 allows for custom variants using the `@custom-variant` directive. We've set up a dark mode variant:

```css
@custom-variant dark (&:is(.dark *));
```

You can use this in your components:

```jsx
<div className="dark:bg-gray-900">
  <!-- Content with dark mode styles -->
</div>
```

## How to Use in Our Project

1. **Update Component Styles**: Gradually refactor components to use the new utilities
2. **Container-Based Responsive Design**: Use `@container` queries for components that need to adapt to their container
3. **Internationalization**: Use logical properties for any components that might need RTL support
4. **Theme Consistency**: Update color definitions to use OKLCH for better color consistency

## Example Refactoring

Before:
```jsx
<div className="p-4 bg-white rounded-lg shadow-md">
  <div className="flex items-center">
    <div className="ml-4 mr-4">Content</div>
  </div>
</div>
```

After:
```jsx
<div className="p-4 bg-white rounded-lg shadow-md @container">
  <div className="flex items-center">
    <div className="ms-4 me-4 @md:text-lg">Content</div>
  </div>
</div>
```

For additional information, refer to the [official Tailwind CSS v4 documentation](https://tailwindcss.com/docs). 