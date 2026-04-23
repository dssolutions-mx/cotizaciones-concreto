# 🚀 CLIENT PORTAL DEVELOPER GUIDE: iOS 26 LIQUID GLASS EDITION

**Project:** Apple-Grade Concrete Management Client Portal  
**Timeline:** 72-Hour Sprint  
**Team Size:** 50+ AI-Leveraged Developers  
**Target:** Production-Ready B2B2C Portal  
**Design Philosophy:** iOS 26 Liquid Glass Minimalism

---

## 📑 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [iOS 26 Liquid Glass Design Language](#ios-26-liquid-glass-design-language)
3. [Design System Specifications](#design-system-specifications)
4. [Team Organization](#team-organization)
5. [Day-by-Day Execution Plan](#day-by-day-execution-plan)
6. [Component Library](#component-library)
7. [Implementation Guidelines](#implementation-guidelines)
8. [Quality Assurance](#quality-assurance)
9. [Resources & Tools](#resources--tools)

---

## 🎯 EXECUTIVE SUMMARY

### Mission Critical
Transform internal concrete management tool into a white-labeled, Apple-quality client portal that showcases your technological sophistication to your client's most important customer.

### Core Requirements
- **Manual Registration:** Admin-controlled user onboarding
- **Data Visibility:** Orders, deliveries, balances, quality tests (NO unit prices, NO material compositions)
- **Quality Focus:** Rendimiento volumétrico (volumetric efficiency) is KEY metric
- **Branding:** Co-branded experience (Your logo + Client logo)
- **Security:** Zero data leakage between clients (bulletproof RLS)

### Success Criteria
✅ Production-ready in 72 hours  
✅ Apple-grade visual quality  
✅ <2s page load times  
✅ Zero security vulnerabilities  
✅ Mobile-first responsive design

---

## ✅ PROGRESS TRACKER

### ✅ Foundation & Design System (Day 1)
- [x] Apple system font stack integrated (SF Pro/system stack) across app
- [x] Tailwind config with iOS 26 design tokens (colors, spacing, typography, borderRadius)
- [x] Liquid Glass effect utilities (glass-base, glass-thick, glass-thin, glass-interactive)
- [x] Core UI components (Card, Container, Stack, Grid, Section, Button, Input, Select, DatePicker)
- [x] Data display components (DataTable, DataList, Badge, StatCard, Table)
- [x] Advanced components (MetricCard, ActivityCard, QuickAction, OrderCard, FilterChip, Branding)

### ✅ Authentication & Routing
- [x] Client Portal route guard (`EXTERNAL_CLIENT`) implemented (`ClientPortalGuard`)
- [x] Client Portal layout with enhanced Liquid Glass navigation
- [x] Seamless routing for external clients (middleware, login, auth callback)
- [x] Mobile-responsive navigation with hamburger menu

### ✅ Feature Pages (Immersive iOS 26 Experience)
- [x] **Dashboard**: Interactive metric cards, quick actions, recent activity, upcoming deliveries
- [x] **Orders List**: Search & filter chips, animated grid, gesture-driven cards
- [x] **Order Detail**: Timeline view, remisiones drill-down, gradient accents, status badges
- [x] **Balance**: Main balance card, site breakdown, recent payments, financial overview
- [x] **Quality**: Rendimiento volumétrico focus, compliance metrics, test results with badges

### ✅ Animations & Micro-interactions
- [x] Framer Motion integration for all interactive elements
- [x] Hover states with scale and translation effects
- [x] Page transition animations (fade-in, slide-up)
- [x] Loading states with rotating spinners
- [x] Staggered list animations

### ✅ Production Optimizations (Latest)
- [x] **Elegant Color Scheme**: Replaced bright colors with sophisticated slate/gray tones
- [x] **Performance**: Removed RPC functions, using direct table queries with RLS
- [x] **API Reuse**: Quality module uses same APIs as internal quality/clientes page
- [x] **Smooth Transitions**: Enhanced login-to-portal flow with proper role detection
- [x] **Refined Navigation**: Minimalistic nav with subtle hover states and borders
- [x] **DC Concretos Branding**: Integrated actual company logo throughout portal

### 🚧 Pending Enhancements


- [ ] Dark mode toggle and persistence
- [ ] Advanced charts for quality trends
- [ ] Client-specific notifications and alerts

---

## 🌊 iOS 26 LIQUID GLASS DESIGN LANGUAGE

### What is Liquid Glass?

In 2025, Apple introduced Liquid Glass, marking its most significant visual redesign since 2013. This new design language emphasizes translucency, depth, and fluid responsiveness across all major Apple platforms.

Liquid Glass is a translucent material that reflects and refracts its surroundings, while dynamically transforming to help bring greater focus to content.

### Core Principles

#### 1. **Translucency Over Opacity**
UI components feature rounded, translucent elements with the "optical qualities of glass" (including refraction), which react to motion, content, and inputs.

**Implementation:**
- Use background blur effects (backdrop-filter: blur())
- Layer transparent elements with subtle tints
- Dynamic opacity based on content behind

#### 2. **Depth Through Layering**
UI elements no longer sit flat; they add dynamic blur, light refraction, and transparency to make them feel like physical pieces of curved or frosted glass.

**Implementation:**
- Multiple z-index layers
- Specular highlights on interactive elements
- Subtle shadows to indicate elevation

#### 3. **Content-First Deference**
Transparency allows the user to maintain the context of where they are while smooth transitions make interface changes more understandable and intuitive.

**Implementation:**
- Remove unnecessary decorative backgrounds
- Let data be the hero (concrete volumes, test results)
- Minimal chrome, maximum content

#### 4. **Dynamic Responsiveness**
Elements adapt dynamically to light and content, simulating real-world glass effects.

**Implementation:**
- Hover states with glass "ripple" effects
- Button presses that show depth
- Scroll-triggered opacity changes

---

## 🎨 DESIGN SYSTEM SPECIFICATIONS

### Typography System

San Francisco is Apple's system font with nine weights, optimized for digital screens with proportional spacing.

```css
/* iOS 26 Typography Hierarchy */

/* Display Text - Large Titles */
.text-large-title {
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 34px;
  font-weight: 700;
  line-height: 41px;
  letter-spacing: 0.37px;
}

/* Page Headers */
.text-title-1 {
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 34px;
  letter-spacing: 0.36px;
}

.text-title-2 {
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 28px;
  letter-spacing: 0.35px;
}

/* Section Headers */
.text-title-3 {
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 25px;
  letter-spacing: 0.38px;
}

/* Body Text - DEFAULT FOR MOST CONTENT */
.text-body {
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 17px;
  font-weight: 400;
  line-height: 22px;
  letter-spacing: -0.41px;
}

/* Secondary Text */
.text-callout {
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 21px;
  letter-spacing: -0.32px;
}

/* Captions */
.text-footnote {
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  letter-spacing: -0.08px;
}

.text-caption {
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  letter-spacing: 0px;
}
```

**CRITICAL RULES:**
- Use SF Pro Display for sizes 20pt+, SF Pro Text for body and smaller
- Never use more than 3 font weights in a single view
- Use Inter as fallback if SF Pro unavailable

### Color System (iOS 26 Palette)

```typescript
// colors.ts
export const colors = {
  // Primary Actions
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemOrange: '#FF9500',
  systemRed: '#FF3B30',
  
  // Neutrals (Light Mode)
  systemGray: {
    1: '#8E8E93',   // Secondary text
    2: '#AEAEB2',   // Tertiary text
    3: '#C7C7CC',   // Separators
    4: '#D1D1D6',   // Borders
    5: '#E5E5EA',   // Card backgrounds
    6: '#F2F2F7'    // Page background
  },
  
  // Text Colors (Light Mode)
  label: {
    primary: '#000000',
    secondary: 'rgba(60, 60, 67, 0.6)',
    tertiary: 'rgba(60, 60, 67, 0.3)',
    quaternary: 'rgba(60, 60, 67, 0.18)'
  },
  
  // Backgrounds (Light Mode)
  background: {
    primary: '#FFFFFF',
    secondary: '#F2F2F7',
    tertiary: '#FFFFFF',
    grouped: {
      primary: '#F2F2F7',
      secondary: '#FFFFFF',
      tertiary: '#F2F2F7'
    }
  },
  
  // Dark Mode Auto-Switch
  dark: {
    label: {
      primary: '#FFFFFF',
      secondary: 'rgba(235, 235, 245, 0.6)',
      tertiary: 'rgba(235, 235, 245, 0.3)',
      quaternary: 'rgba(235, 235, 245, 0.18)'
    },
    background: {
      primary: '#000000',
      secondary: '#1C1C1E',
      tertiary: '#2C2C2E',
      grouped: {
        primary: '#000000',
        secondary: '#1C1C1E',
        tertiary: '#2C2C2E'
      }
    },
    systemGray: {
      1: '#8E8E93',
      2: '#636366',
      3: '#48484A',
      4: '#3A3A3C',
      5: '#2C2C2E',
      6: '#1C1C1E'
    }
  }
} as const;
```

### Spacing System (8pt Grid)

```typescript
// spacing.ts
export const spacing = {
  0: '0px',
  1: '4px',     // Tight spacing within components
  2: '8px',     // Component padding
  3: '12px',    // Small gaps
  4: '16px',    // Card padding (MOST COMMON)
  5: '20px',    // Medium gaps
  6: '24px',    // Section spacing
  8: '32px',    // Major sections
  10: '40px',   // Large spacing
  12: '48px',   // Page margins
  16: '64px',   // Hero sections
  20: '80px',   // Extra large sections
  24: '96px'    // Maximum spacing
} as const;
```

### Liquid Glass Effects

Apple's APIs include options to control blur type and intensity, giving you flexibility for every view.

```css
/* Liquid Glass Material System */

/* Base Glass Effect */
.glass-base {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Thick Glass (Primary Surfaces) */
.glass-thick {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 
    0 8px 32px 0 rgba(31, 38, 135, 0.15),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
}

/* Thin Glass (Secondary Surfaces) */
.glass-thin {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px) saturate(180%);
  -webkit-backdrop-filter: blur(10px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Dark Mode Glass */
.dark .glass-base {
  background: rgba(28, 28, 30, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dark .glass-thick {
  background: rgba(28, 28, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.3),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
}

/* Interactive Glass (Buttons, Cards) */
.glass-interactive {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-interactive:hover {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 
    0 12px 40px 0 rgba(31, 38, 135, 0.2),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.6);
}

.glass-interactive:active {
  transform: translateY(0px);
  box-shadow: 
    0 4px 16px 0 rgba(31, 38, 135, 0.15),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4);
}
```

### Border Radius (iOS 26 Standard)

iOS 26 enforces containers with specific corner radii that can no longer be overridden.

```typescript
// borderRadius.ts
export const borderRadius = {
  none: '0px',
  sm: '8px',     // Small buttons
  DEFAULT: '12px', // Standard cards (MOST COMMON)
  lg: '16px',    // Large cards
  xl: '20px',    // Hero cards
  '2xl': '24px', // Modals
  '3xl': '28px', // iOS 26 System Standard
  full: '9999px' // Pills, avatars
} as const;
```

### Shadows & Elevation

```css
/* iOS 26 Shadow System - VERY SUBTLE */

/* Level 1: Subtle Elevation */
.shadow-sm {
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 1px 3px rgba(0, 0, 0, 0.06);
}

/* Level 2: Standard Cards (MOST COMMON) */
.shadow-md {
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.06),
    0 4px 8px rgba(0, 0, 0, 0.08);
}

/* Level 3: Floating Elements */
.shadow-lg {
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
}

/* Level 4: Modals & Overlays */
.shadow-xl {
  box-shadow: 
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Level 5: Maximum Elevation */
.shadow-2xl {
  box-shadow: 
    0 16px 48px rgba(0, 0, 0, 0.16),
    0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Dark Mode Adjustments */
.dark .shadow-sm {
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.4);
}

.dark .shadow-md {
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.4),
    0 4px 8px rgba(0, 0, 0, 0.5);
}
```

---

## 👥 TEAM ORGANIZATION

### Squad Structure (50+ Developers)

```
WORKSTREAM A: Backend & Security (10 devs)
├── Squad A1: Database Migration (3 devs)
│   └── Lead: Execute SQL migrations, test RLS
├── Squad A2: Security Policies (3 devs)
│   └── Lead: Implement RLS, penetration testing
├── Squad A3: API Layer (2 devs)
│   └── Lead: Query optimization, caching
└── Squad A4: Testing Infrastructure (2 devs)
    └── Lead: Security test suite, load testing

WORKSTREAM B: Design System & Core UI (15 devs)
├── Squad B1: Design Tokens Setup (3 devs)
│   └── Lead: Colors, typography, spacing tokens
├── Squad B2: Layout Components (4 devs)
│   └── Lead: Grid, Card, Container, Stack
├── Squad B3: Data Display (4 devs)
│   └── Lead: Table, List, Badge, Stat
└── Squad B4: Form & Input (4 devs)
    └── Lead: Button, Input, Select, DatePicker

WORKSTREAM C: Feature Pages (15 devs)
├── Squad C1: Dashboard (4 devs)
│   └── Lead: Metrics cards, charts, recent activity
├── Squad C2: Orders Module (4 devs)
│   └── Lead: Order list, detail view, filters
├── Squad C3: Balance Module (3 devs)
│   └── Lead: Balance overview, transaction history
└── Squad C4: Quality Module (4 devs)
    └── Lead: Test results, rendimiento volumétrico

WORKSTREAM D: Integration & Polish (10 devs)
├── Squad D1: Auth Flow (3 devs)
│   └── Lead: Login, logout, role guards
├── Squad D2: Data Fetching (3 devs)
│   └── Lead: React Query, optimistic updates
├── Squad D3: Animations (2 devs)
│   └── Lead: Liquid Glass effects, transitions
└── Squad D4: Responsive Design (2 devs)
    └── Lead: Mobile-first, tablet, desktop
```

### Communication Protocol

**Daily Sync:** 9:00 AM (15 min)
- Each workstream lead reports progress
- Blockers escalated immediately
- Cross-squad dependencies identified

**Integration Checkpoints:**
- Hour 12: Backend ↔ Frontend sync
- Hour 24: Full system integration test
- Hour 36: UAT with pilot client
- Hour 48: Performance optimization
- Hour 60: Final bug fixes
- Hour 72: Production deployment

---

## 📅 DAY-BY-DAY EXECUTION PLAN

### **DAY 1: FOUNDATION (0-24 Hours)**

#### **Hour 0-4: KICKOFF & INFRASTRUCTURE**

**ALL SQUADS:**

```bash
# 1. Repository Setup
git clone [your-repo-url]
cd cotizador-project

# 2. Create feature branch
git checkout -b client-portal/[squad-name]

# 3. Install dependencies
npm install

# 4. Environment setup
cp .env.example .env.local
# Add Supabase credentials

# 5. Verify build
npm run dev
```

**Download Resources:**
- SF Pro fonts: https://developer.apple.com/fonts/
- iOS 26 Figma Kit: https://www.figma.com/community/file/1527721578857867021/ios-and-ipados-26
- Apple Design Resources: https://developer.apple.com/design/resources/

---

#### **Hour 0-4: Squad A1 (Database Migration)**

**CRITICAL: Execute migrations in Supabase immediately**

```sql
-- =============================================
-- MIGRATION 001: External Client Role
-- File: supabase/migrations/20250101000001_external_client_role.sql
-- =============================================

BEGIN;

-- 1. Add EXTERNAL_CLIENT role to user_profiles
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role = ANY (ARRAY[
  'QUALITY_TEAM'::text, 
  'PLANT_MANAGER'::text, 
  'SALES_AGENT'::text, 
  'EXECUTIVE'::text, 
  'CREDIT_VALIDATOR'::text, 
  'DOSIFICADOR'::text, 
  'EXTERNAL_SALES_AGENT'::text, 
  'ADMIN_OPERATIONS'::text,
  'EXTERNAL_CLIENT'::text  -- NEW ROLE
]));

-- 2. Add portal user linkage to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES user_profiles(id);

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS is_portal_enabled boolean DEFAULT false;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_clients_portal_user 
ON clients(portal_user_id)
WHERE portal_user_id IS NOT NULL;

-- 4. Add helpful comments
COMMENT ON COLUMN clients.portal_user_id IS 
'Links this client to a user profile with EXTERNAL_CLIENT role for portal access';

COMMENT ON COLUMN clients.is_portal_enabled IS 
'Flag to enable/disable portal access for this client (gradual rollout)';

COMMIT;
```

---

#### **Hour 0-6: Squad A2 (Row-Level Security)**

```sql
-- =============================================
-- MIGRATION 002: Row-Level Security Policies
-- File: supabase/migrations/20250101000002_rls_external_clients.sql
-- =============================================

BEGIN;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get client ID for current portal user
CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM clients 
  WHERE portal_user_id = auth.uid() 
  AND is_portal_enabled = true
  LIMIT 1;
$$;

-- Check if user is external client
CREATE OR REPLACE FUNCTION is_external_client()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'EXTERNAL_CLIENT'
  );
$$;

-- =============================================
-- ORDERS TABLE
-- =============================================

CREATE POLICY "external_client_orders_read"
ON orders
FOR SELECT
TO authenticated
USING (
  is_external_client()
  AND client_id = get_user_client_id()
);

-- =============================================
-- REMISIONES TABLE (DELIVERIES)
-- =============================================

CREATE POLICY "external_client_remisiones_read"
ON remisiones
FOR SELECT
TO authenticated
USING (
  is_external_client()
  AND order_id IN (
    SELECT id FROM orders 
    WHERE client_id = get_user_client_id()
  )
);

-- =============================================
-- CLIENT BALANCES
-- =============================================

CREATE POLICY "external_client_balances_read"
ON client_balances
FOR SELECT
TO authenticated
USING (
  is_external_client()
  AND client_id = get_user_client_id()
);

-- =============================================
-- QUALITY DATA: Muestreos (Samplings)
-- =============================================

CREATE POLICY "external_client_muestreos_read"
ON muestreos
FOR SELECT
TO authenticated
USING (
  is_external_client()
  AND remision_id IN (
    SELECT r.id FROM remisiones r
    INNER JOIN orders o ON r.order_id = o.id
    WHERE o.client_id = get_user_client_id()
  )
);

-- =============================================
-- QUALITY DATA: Muestras (Samples)
-- =============================================

CREATE POLICY "external_client_muestras_read"
ON muestras
FOR SELECT
TO authenticated
USING (
  is_external_client()
  AND muestreo_id IN (
    SELECT m.id FROM muestreos m
    INNER JOIN remisiones r ON m.remision_id = r.id
    INNER JOIN orders o ON r.order_id = o.id
    WHERE o.client_id = get_user_client_id()
  )
);

-- =============================================
-- QUALITY DATA: Ensayos (Tests)
-- =============================================

CREATE POLICY "external_client_ensayos_read"
ON ensayos
FOR SELECT
TO authenticated
USING (
  is_external_client()
  AND muestra_id IN (
    SELECT mu.id FROM muestras mu
    INNER JOIN muestreos m ON mu.muestreo_id = m.id
    INNER JOIN remisiones r ON m.remision_id = r.id
    INNER JOIN orders o ON r.order_id = o.id
    WHERE o.client_id = get_user_client_id()
  )
);

-- =============================================
-- RECIPES TABLE (LIMITED VIEW - NO COMPOSITIONS)
-- =============================================

CREATE POLICY "external_client_recipes_read"
ON recipes
FOR SELECT
TO authenticated
USING (
  is_external_client()
  AND id IN (
    SELECT DISTINCT recipe_id FROM remisiones r
    INNER JOIN orders o ON r.order_id = o.id
    WHERE o.client_id = get_user_client_id()
  )
);

-- BLOCK material_quantities access (compositions)
CREATE POLICY "external_client_material_quantities_block"
ON material_quantities
FOR SELECT
TO authenticated
USING (
  NOT is_external_client()
);

COMMIT;
```

---

#### **Hour 4-8: Squad B1 (Design System Foundation)**

Create `/src/lib/design-system/`:

```typescript
// /src/lib/design-system/colors.ts
export const colors = {
  // [Full color system from above]
} as const;

export type SystemColor = keyof typeof colors;
```

```typescript
// /src/lib/design-system/typography.ts
export const typography = {
  largeTitle: {
    fontSize: '34px',
    fontWeight: 700,
    lineHeight: '41px',
    letterSpacing: '0.37px',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
  },
  // [Full typography system from above]
} as const;

export type TypographyStyle = keyof typeof typography;
```

```typescript
// /src/lib/design-system/spacing.ts
export const spacing = {
  // [Full spacing system from above]
} as const;

export type SpacingKey = keyof typeof spacing;
```

```typescript
// /src/lib/design-system/index.ts
export { colors, type SystemColor } from './colors';
export { typography, type TypographyStyle } from './typography';
export { spacing, type SpacingKey } from './spacing';
export { borderRadius } from './borderRadius';

// Glass effect utilities
export const glassEffects = {
  base: 'glass-base',
  thick: 'glass-thick',
  thin: 'glass-thin',
  interactive: 'glass-interactive'
} as const;
```

**Add to Tailwind Config:**

```javascript
// tailwind.config.js
const { colors, spacing, typography, borderRadius } = require('./src/lib/design-system');

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...colors,
      },
      spacing: {
        ...spacing,
      },
      borderRadius: {
        ...borderRadius,
      },
      fontFamily: {
        'sf-pro': ['SF Pro Text', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

**Add Global CSS:**

```css
/* /src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* SF Pro Font Loading */
  @font-face {
    font-family: 'SF Pro Text';
    src: local('SF Pro Text');
    font-weight: 100 900;
    font-display: swap;
  }

  @font-face {
    font-family: 'SF Pro Display';
    src: local('SF Pro Display');
    font-weight: 100 900;
    font-display: swap;
  }

  /* Base Styles */
  body {
    @apply text-body font-sf-pro;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  /* Liquid Glass Effects */
  .glass-base {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .glass-thick {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(30px) saturate(180%);
    -webkit-backdrop-filter: blur(30px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 
      0 8px 32px 0 rgba(31, 38, 135, 0.15),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.5);
  }

  .glass-thin {
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(10px) saturate(180%);
    -webkit-backdrop-filter: blur(10px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .glass-interactive {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .glass-interactive:hover {
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
    box-shadow: 
      0 12px 40px 0 rgba(31, 38, 135, 0.2),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.6);
  }

  /* Dark Mode Glass */
  .dark .glass-base {
    background: rgba(28, 28, 30, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .dark .glass-thick {
    background: rgba(28, 28, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 8px 32px 0 rgba(0, 0, 0, 0.3),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
  }
}
```

---

#### **Hour 8-16: Squad B2 (Layout Components)**

```typescript
// /src/components/ui/Card.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  variant?: 'base' | 'thick' | 'thin' | 'interactive';
  className?: string;
  onClick?: () => void;
}

export function Card({ 
  children, 
  variant = 'thick',
  className = '',
  onClick
}: CardProps) {
  const variants = {
    base: 'glass-base',
    thick: 'glass-thick',
    thin: 'glass-thin',
    interactive: 'glass-interactive cursor-pointer'
  };

  return (
    <div 
      className={cn(
        'rounded-2xl p-6',
        variants[variant],
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
```

```typescript
// /src/components/ui/Container.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContainerProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

export function Container({ 
  children, 
  maxWidth = 'xl',
  className = ''
}: ContainerProps) {
  const maxWidths = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full'
  };

  return (
    <div className={cn(
      'mx-auto px-6 py-12',
      maxWidths[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}
```

```typescript
// /src/components/ui/Stack.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StackProps {
  children: ReactNode;
  direction?: 'row' | 'column';
  spacing?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  className?: string;
}

export function Stack({ 
  children, 
  direction = 'column',
  spacing = 4,
  align = 'stretch',
  justify = 'start',
  className = ''
}: StackProps) {
  return (
    <div className={cn(
      'flex',
      direction === 'row' ? 'flex-row' : 'flex-col',
      `gap-${spacing}`,
      `items-${align}`,
      `justify-${justify}`,
      className
    )}>
      {children}
    </div>
  );
}
```

---

#### **Hour 8-16: Squad B3 (Data Display Components)**

```typescript
// /src/components/ui/StatCard.tsx
import { ReactNode } from 'react';
import { Card } from './Card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({ 
  label, 
  value, 
  change,
  icon,
  trend = 'neutral',
  className 
}: StatCardProps) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <Card variant="thick" className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-footnote text-label-secondary mb-1">
            {label}
          </p>
          <p className="text-title-1 font-bold text-label-primary">
            {value}
          </p>
          {change !== undefined && (
            <p className={cn('text-caption mt-2', trendColors[trend])}>
              {change > 0 ? '+' : ''}{change}%
            </p>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-systemGray-6 dark:bg-dark-systemGray-6 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
```

```typescript
// /src/components/ui/Badge.tsx
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Badge({ 
  children, 
  variant = 'neutral',
  size = 'md',
  className 
}: BadgeProps) {
  const variants = {
    primary: 'bg-systemBlue/10 text-systemBlue border-systemBlue/20',
    success: 'bg-systemGreen/10 text-systemGreen border-systemGreen/20',
    warning: 'bg-systemOrange/10 text-systemOrange border-systemOrange/20',
    error: 'bg-systemRed/10 text-systemRed border-systemRed/20',
    neutral: 'bg-systemGray-6 text-label-primary border-systemGray-4'
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-caption',
    md: 'px-3 py-1 text-footnote',
    lg: 'px-4 py-1.5 text-callout'
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  );
}
```

---

#### **Hour 16-24: Squad C1 (Dashboard Page)**

```typescript
// /src/app/client-portal/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Container } from '@/components/ui/Container';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/ui/Stack';
import { Package, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';

interface DashboardMetrics {
  totalOrders: number;
  totalVolume: number;
  currentBalance: number;
  qualityScore: number;
}

export default function ClientDashboard() {
  const { profile } = useAuthBridge();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Get client info
        const { data: client } = await supabase
          .from('clients')
          .select('id, business_name')
          .eq('portal_user_id', profile?.id)
          .single();

        if (!client) return;

        // Fetch orders count (RLS auto-filters)
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true });

        // Fetch total volume from remisiones
        const { data: remisiones } = await supabase
          .from('remisiones')
          .select('volumen_fabricado');

        const totalVolume = remisiones?.reduce(
          (sum, r) => sum + (parseFloat(r.volumen_fabricado) || 0), 
          0
        ) || 0;

        // Fetch balance
        const { data: balance } = await supabase
          .from('client_balances')
          .select('current_balance')
          .single();

        // Fetch quality score (simplified)
        const { data: ensayos } = await supabase
          .from('ensayos')
          .select('porcentaje_cumplimiento');

        const avgQuality = ensayos?.length
          ? ensayos.reduce((sum, e) => sum + (parseFloat(e.porcentaje_cumplimiento) || 0), 0) / ensayos.length
          : 0;

        setMetrics({
          totalOrders: ordersCount || 0,
          totalVolume: Math.round(totalVolume * 10) / 10,
          currentBalance: parseFloat(balance?.current_balance || '0'),
          qualityScore: Math.round(avgQuality)
        });

      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    if (profile) {
      fetchMetrics();
    }
  }, [profile]);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-systemBlue"></div>
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-large-title font-bold text-label-primary mb-2">
          Dashboard
        </h1>
        <p className="text-body text-label-secondary">
          Bienvenido al portal de gestión de concreto
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Pedidos Totales"
          value={metrics?.totalOrders || 0}
          icon={<Package className="w-6 h-6 text-systemBlue" />}
        />
        <StatCard
          label="Volumen Entregado"
          value={`${metrics?.totalVolume || 0} m³`}
          icon={<TrendingUp className="w-6 h-6 text-systemGreen" />}
        />
        <StatCard
          label="Balance Actual"
          value={`$${metrics?.currentBalance.toLocaleString('es-MX')}`}
          icon={<DollarSign className="w-6 h-6 text-systemOrange" />}
        />
        <StatCard
          label="Calidad Promedio"
          value={`${metrics?.qualityScore || 0}%`}
          trend={metrics?.qualityScore >= 95 ? 'up' : 'neutral'}
          icon={<CheckCircle className="w-6 h-6 text-systemGreen" />}
        />
      </div>

      {/* Recent Activity */}
      <Card variant="thick">
        <h2 className="text-title-2 font-bold text-label-primary mb-4">
          Actividad Reciente
        </h2>
        <p className="text-body text-label-secondary">
          Próximamente: Historial de entregas y actualizaciones
        </p>
      </Card>
    </Container>
  );
}
```

---

### **DAY 2: FEATURES & INTEGRATION (24-48 Hours)**

#### **Hour 24-32: Squad C2 (Orders Module)**

```typescript
// /src/app/client-portal/orders/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Order {
  id: string;
  order_number: string;
  construction_site: string;
  delivery_date: string;
  order_status: string;
  total_amount: number;
  items: any[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            items:order_items(*)
          `)
          .order('delivery_date', { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string }> = {
      'created': { variant: 'neutral', label: 'Creado' },
      'approved': { variant: 'success', label: 'Aprobado' },
      'in_progress': { variant: 'primary', label: 'En Progreso' },
      'completed': { variant: 'success', label: 'Completado' },
      'cancelled': { variant: 'error', label: 'Cancelado' }
    };

    const config = statusMap[status] || statusMap['created'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-systemBlue"></div>
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-large-title font-bold text-label-primary mb-2">
          Mis Pedidos
        </h1>
        <p className="text-body text-label-secondary">
          {orders.length} pedidos en total
        </p>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id} variant="interactive">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-title-3 font-semibold text-label-primary">
                  Pedido #{order.order_number}
                </p>
                <p className="text-callout text-label-secondary mt-1">
                  {order.construction_site}
                </p>
              </div>
              {getStatusBadge(order.order_status)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-body">
              <div>
                <p className="text-label-secondary text-footnote">Fecha de Entrega</p>
                <p className="text-label-primary font-medium">
                  {format(new Date(order.delivery_date), 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-label-secondary text-footnote">Monto Total</p>
                <p className="text-label-primary font-medium">
                  ${order.total_amount.toLocaleString('es-MX')}
                </p>
              </div>
            </div>

            {order.items?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-systemGray-4">
                <p className="text-footnote text-label-secondary">
                  {order.items.length} producto(s)
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </Container>
  );
}
```

---

#### **Hour 32-40: Squad C4 (Quality Module - CRITICAL)**

```typescript
// /src/app/client-portal/quality/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';

interface QualityData {
  muestreos: any[];
  ensayos: any[];
  avgRendimiento: number;
  complianceRate: number;
}

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQualityData() {
      try {
        // Fetch samplings
        const { data: muestreos } = await supabase
          .from('muestreos')
          .select(`
            *,
            remision:remisiones(
              remision_number,
              order:orders(order_number, construction_site)
            )
          `)
          .order('fecha_muestreo', { ascending: false })
          .limit(10);

        // Fetch tests
        const { data: ensayos } = await supabase
          .from('ensayos')
          .select(`
            *,
            muestra:muestras(
              muestreo:muestreos(
                remision:remisiones(remision_number)
              )
            )
          `)
          .order('fecha_ensayo', { ascending: false });

        // Calculate metrics
        const avgCompliance = ensayos?.length
          ? ensayos.reduce((sum, e) => sum + (parseFloat(e.porcentaje_cumplimiento) || 0), 0) / ensayos.length
          : 0;

        // Calculate rendimiento volumétrico (KEY METRIC)
        // This is the ratio of actual volume vs theoretical volume
        const avgRendimiento = 98.5; // Placeholder - calculate from real data

        setData({
          muestreos: muestreos || [],
          ensayos: ensayos || [],
          avgRendimiento,
          complianceRate: avgCompliance
        });

      } catch (error) {
        console.error('Error fetching quality data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchQualityData();
  }, []);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-systemBlue"></div>
        </div>
      </Container>
    );
  }

  return (
    <Container maxWidth="2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-large-title font-bold text-label-primary mb-2">
          Control de Calidad
        </h1>
        <p className="text-body text-label-secondary">
          Resultados de ensayos y rendimiento volumétrico
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <StatCard
          label="Rendimiento Volumétrico Promedio"
          value={`${data?.avgRendimiento.toFixed(1)}%`}
          trend={data?.avgRendimiento >= 98 ? 'up' : 'neutral'}
        />
        <StatCard
          label="Tasa de Cumplimiento"
          value={`${data?.complianceRate.toFixed(1)}%`}
          trend={data?.complianceRate >= 95 ? 'up' : 'neutral'}
        />
      </div>

      {/* Test Results */}
      <Card variant="thick">
        <h2 className="text-title-2 font-bold text-label-primary mb-6">
          Resultados de Ensayos Recientes
        </h2>

        <div className="space-y-4">
          {data?.ensayos.slice(0, 5).map((ensayo) => (
            <div 
              key={ensayo.id}
              className="p-4 rounded-xl bg-systemGray-6 dark:bg-dark-systemGray-6"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-callout font-medium text-label-primary">
                  Ensayo - {format(new Date(ensayo.fecha_ensayo), 'dd MMM yyyy')}
                </p>
                <Badge 
                  variant={
                    parseFloat(ensayo.porcentaje_cumplimiento) >= 95 
                      ? 'success' 
                      : parseFloat(ensayo.porcentaje_cumplimiento) >= 85
                      ? 'warning'
                      : 'error'
                  }
                >
                  {ensayo.porcentaje_cumplimiento}% Cumplimiento
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 text-footnote">
                <div>
                  <p className="text-label-secondary">Resistencia Calculada</p>
                  <p className="text-label-primary font-medium">
                    {ensayo.resistencia_calculada} kg/cm²
                  </p>
                </div>
                <div>
                  <p className="text-label-secondary">Carga</p>
                  <p className="text-label-primary font-medium">
                    {ensayo.carga_kg} kg
                  </p>
                </div>
              </div>

              {ensayo.observaciones && (
                <p className="mt-3 text-caption text-label-secondary">
                  {ensayo.observaciones}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </Container>
  );
}
```

---

#### **Hour 40-48: Squad D1 (Authentication & Route Guards)**

```typescript
// /src/components/auth/ClientPortalGuard.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';

export default function ClientPortalGuard({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { profile, isInitialized } = useAuthBridge();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized) {
      if (!profile) {
        // Not logged in
        router.replace('/login');
      } else if (profile.role !== 'EXTERNAL_CLIENT') {
        // Not an external client
        router.replace('/dashboard');
      }
    }
  }, [isInitialized, profile, router]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-systemBlue"></div>
      </div>
    );
  }

  if (!profile || profile.role !== 'EXTERNAL_CLIENT') {
    return null;
  }

  return <>{children}</>;
}
```

```typescript
// /src/app/client-portal/layout.tsx
import ClientPortalGuard from '@/components/auth/ClientPortalGuard';
import ClientPortalNav from '@/components/client-portal/ClientPortalNav';

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClientPortalGuard>
      <div className="min-h-screen bg-background-secondary">
        <ClientPortalNav />
        <main>{children}</main>
      </div>
    </ClientPortalGuard>
  );
}
```

```typescript
// /src/components/client-portal/ClientPortalNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, DollarSign, Beaker, LogOut } from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { cn } from '@/lib/utils';

export default function ClientPortalNav() {
  const pathname = usePathname();
  const { profile, logout } = useAuthBridge();

  const navItems = [
    { href: '/client-portal/dashboard', label: 'Dashboard', icon: Home },
    { href: '/client-portal/orders', label: 'Pedidos', icon: Package },
    { href: '/client-portal/balance', label: 'Balance', icon: DollarSign },
    { href: '/client-portal/quality', label: 'Calidad', icon: Beaker },
  ];

  return (
    <nav className="glass-thick sticky top-0 z-50 border-b border-systemGray-4">
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-systemBlue flex items-center justify-center">
              <span className="text-white font-bold text-xl">DC</span>
            </div>
            <span className="text-title-3 font-bold text-label-primary">
              Portal de Cliente
            </span>
          </div>

          {/* Nav Items */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center space-x-2 px-4 py-2 rounded-xl transition-all',
                    isActive
                      ? 'glass-thick text-label-primary font-medium'
                      : 'text-label-secondary hover:glass-thin hover:text-label-primary'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <button
            onClick={logout}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl glass-interactive text-label-primary"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden md:inline">Salir</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
```

---

### **DAY 3: POLISH & DEPLOYMENT (48-72 Hours)**

#### **Hour 48-56: Squad D3 (Animations & Micro-interactions)**

```typescript
// /src/lib/animations.ts

// Liquid Glass Ripple Effect
export const rippleAnimation = {
  initial: { scale: 0, opacity: 0.5 },
  animate: { scale: 2, opacity: 0 },
  transition: { duration: 0.6, ease: 'easeOut' }
};

// Card Hover Effect
export const cardHoverAnimation = {
  initial: { y: 0 },
  whileHover: { 
    y: -4,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  whileTap: { 
    y: 0,
    transition: { duration: 0.1 }
  }
};

// Fade In Up
export const fadeInUpAnimation = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' }
};

// Stagger Children
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};
```

```typescript
// Update Card component with animations
import { motion } from 'framer-motion';
import { cardHoverAnimation } from '@/lib/animations';

export function Card({ children, variant, className, onClick }: CardProps) {
  return (
    <motion.div
      {...cardHoverAnimation}
      className={cn(
        'rounded-2xl p-6',
        variants[variant],
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
```

---

#### **Hour 56-64: Squad A4 (Security Testing)**

```typescript
// /tests/security/rls-policies.test.ts

import { createClient } from '@supabase/supabase-js';

describe('RLS Security Tests', () => {
  let clientAUser: any;
  let clientBUser: any;

  beforeAll(async () => {
    // Setup test users for Client A and Client B
    // ...
  });

  it('Client A cannot see Client B orders', async () => {
    const supabaseA = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    await supabaseA.auth.signInWithPassword({
      email: clientAUser.email,
      password: 'test-password'
    });

    const { data: orders } = await supabaseA
      .from('orders')
      .select('*');

    // Verify all orders belong to Client A
    const allBelongToClientA = orders?.every(
      order => order.client_id === clientAUser.client_id
    );

    expect(allBelongToClientA).toBe(true);
  });

  it('External clients cannot access material compositions', async () => {
    const supabaseA = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    await supabaseA.auth.signInWithPassword({
      email: clientAUser.email,
      password: 'test-password'
    });

    const { data: materialQuantities, error } = await supabaseA
      .from('material_quantities')
      .select('*');

    // Should return empty or error
    expect(materialQuantities?.length || 0).toBe(0);
  });

  it('External clients cannot access internal routes', async () => {
    // Test that routes like /finanzas, /admin are blocked
    // ...
  });
});
```

---

#### **Hour 64-72: Final Polish & Deployment**

**Deployment Checklist:**

```bash
# 1. Run all tests
npm run test
npm run test:security

# 2. Build production
npm run build

# 3. Run lighthouse audit
npm run audit

# 4. Deploy to Vercel
vercel --prod

# 5. Verify RLS policies in production
npm run verify-rls-prod

# 6. Create first pilot user
npm run create-client-user -- --email=pilot@client.com
```

---

## 📚 COMPONENT LIBRARY REFERENCE

### Button Component (iOS 26 Style)

```typescript
// /src/components/ui/Button.tsx
import { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-systemBlue text-white hover:bg-systemBlue/90',
    secondary: 'bg-systemGray-5 text-label-primary hover:bg-systemGray-4',
    ghost: 'bg-transparent text-systemBlue hover:bg-systemBlue/10',
    glass: 'glass-interactive text-label-primary'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-footnote',
    md: 'px-4 py-2.5 text-body',
    lg: 'px-6 py-3 text-callout'
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        'rounded-xl font-medium transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
              fill="none"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Cargando...
        </span>
      ) : children}
    </motion.button>
  );
}
```

---

## ✅ QUALITY ASSURANCE CHECKLIST

### Security
- [ ] RLS policies tested with multiple client accounts
- [ ] Material compositions blocked for external clients
- [ ] Unit prices hidden from portal views
- [ ] SQL injection attempts fail gracefully
- [ ] XSS prevention verified

### Performance
- [ ] Dashboard loads in <2s
- [ ] All pages achieve Lighthouse score >90
- [ ] Images optimized (WebP, lazy loading)
- [ ] Bundle size <500KB gzipped
- [ ] No unnecessary re-renders

### Accessibility
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Color contrast ratios meet standards
- [ ] Focus indicators visible

### Design
- [ ] Matches iOS 26 Liquid Glass aesthetic
- [ ] Responsive on mobile, tablet, desktop
- [ ] Dark mode works correctly
- [ ] Animations smooth (60fps)
- [ ] Typography hierarchy clear

### Functionality
- [ ] All CRUD operations work
- [ ] Filters and search functional
- [ ] Error states handled gracefully
- [ ] Loading states clear
- [ ] Success feedback visible

---

## 🛠️ RESOURCES & TOOLS

### Essential Links
- **SF Pro Fonts:** https://developer.apple.com/fonts/
- **iOS 26 Figma Kit:** https://www.figma.com/community/file/1527721578857867021
- **Apple HIG:** https://developer.apple.com/design/human-interface-guidelines/
- **Supabase Docs:** https://supabase.com/docs

### Recommended VSCode Extensions
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- Prettier
- ESLint
- Error Lens

### Performance Tools
- Lighthouse
- React DevTools Profiler
- Chrome DevTools Performance tab
- Bundle Analyzer

---

## 🎯 SUCCESS METRICS

### Technical
✅ Zero RLS policy violations  
✅ <2s page load time  
✅ Lighthouse score >90  
✅ Zero console errors in production  
✅ 100% TypeScript type coverage

### Business
✅ Pilot client signs off on design  
✅ Zero data leakage incidents  
✅ 95%+ uptime in first week  
✅ <5 support tickets per week  
✅ Client satisfaction score >8/10

---

## 🚨 CRITICAL REMINDERS

1. **NEVER expose material compositions** to external clients
2. **NEVER show unit prices** in portal views
3. **ALWAYS test RLS policies** before deploying
4. **Rendimiento volumétrico** is the KEY quality metric
5. **Co-branding** must be prominent and professional

---

## 📞 SUPPORT & ESCALATION

**Blockers:** Escalate immediately to tech lead  
**Security Issues:** Stop work, notify security team  
**Design Questions:** Reference iOS 26 Figma kit  
**Database Issues:** Check Supabase logs first

---

**Good luck, team! Let's build something amazing. 🚀**
