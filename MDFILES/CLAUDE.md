# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js-based concrete quotation management system (Sistema de Cotizaciones de Concreto) for DC Concretos. It's a full-stack web application built with React 19, TypeScript, and Supabase, managing quotes, orders, clients, recipes, and quality control processes.

## Development Commands

### Core Development Commands
```bash
# Start development server with Turbopack
npm run dev

# Build the application (uses custom build.js script)
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

### Custom Build Process
The project uses a custom build script (`build.js`) that:
- Validates environment variables with fallbacks for build process
- Runs `next build --no-lint` to skip linting during build
- Creates fallback client reference manifests if needed

### Testing Commands
The project doesn't appear to have a configured test framework. Check with the team about testing approach before adding tests.

### Linting
Run `npm run lint` to check code quality. The project has extensive ESLint configuration and most linting issues have been addressed with disable comments where needed.

## Architecture Overview

### Frontend Structure
- **Next.js 15** with App Router architecture
- **React 19** with client components and server components
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **Zustand** for client-side state management (auth, plant context, offline support)
- **SWR** for data fetching and caching
- **shadcn/ui** components built on Radix UI

### Key Directories
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable React components organized by feature
- `src/lib/` - Utility functions, services, and configurations
- `src/store/` - Zustand stores for state management
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks
- `src/services/` - Business logic and data processing services

### Database & Backend
- **Supabase** as Backend-as-a-Service (PostgreSQL + Auth + Edge Functions)
- **Row Level Security (RLS)** for data access control
- **Role-based access control** with roles: QUALITY_TEAM, PLANT_MANAGER, SALES_AGENT, EXECUTIVE, CREDIT_VALIDATOR, DOSIFICADOR
- **Edge Functions** for notifications and scheduled reports

### Authentication Architecture
Uses **Zustand-based auth store** with Supabase integration:
- Cross-tab synchronization
- Offline support with operation queuing
- Cache management for performance
- Session persistence across browser restarts

## Critical Implementation Rules

### Supabase Authentication (CRITICAL)
**NEVER use deprecated patterns.** The project uses `@supabase/ssr` package exclusively:

✅ **ALWAYS use this pattern:**
```typescript
// Server client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore Server Component calls
          }
        },
      },
    }
  )
}
```

❌ **NEVER use these deprecated patterns:**
- `@supabase/auth-helpers-nextjs`
- Individual cookie methods (`get`, `set`, `remove`)

### State Management Patterns
- Use **Zustand** for global state (auth, plant context)
- Use **SWR** for server state and caching
- Use React state for component-local state
- Plant context affects data filtering across the application

### Component Organization
Components are organized by feature area:
- `auth/` - Authentication and authorization components
- `clients/` - Client management components
- `orders/` - Order processing components
- `quotes/` - Quote management components
- `quality/` - Quality control and testing components
- `recipes/` - Recipe management components
- `ui/` - Base UI components (shadcn/ui)

### Role-Based Access Control
The system implements extensive RBAC:
- Use `useAuthBridge()` hook to access current user and role
- Use `<RoleGuard>` components to protect UI elements
- API routes implement server-side role validation
- Database RLS policies enforce access control

### Plant-Aware Architecture
Many features are plant-specific:
- Use plant context from `PlantProvider`
- Filter data by plant where applicable
- Plant selection affects recipes, materials, and pricing

## Business Logic Key Areas

### Quotation Flow
1. Sales agents create quotes for clients
2. Quotes go through approval workflow
3. Approved quotes can be converted to orders
4. Orders require credit validation

### Credit Validation Process
- CREDIT_VALIDATOR role reviews orders
- Can approve, reject, or temporarily reject orders
- EXECUTIVE role can override temporary rejections

### Quality Control System
- QUALITY_TEAM manages testing and sampling
- Ensayos (tests) and Muestreos (sampling) tracking
- Site checks and quality reporting
- Integration with third-party systems (Arkik)

### Recipe Management
- Recipes have versions with effective dates
- Material quantities and pricing tracked per version
- Plant-specific recipe availability
- Integration with K2 system for production

## Data Processing Services

### Arkik Integration
- `src/services/arkikValidator.ts` - Order validation
- `src/services/arkikOrderGrouper.ts` - Order grouping logic
- `src/services/priceDrivenArkikValidator.ts` - Price-driven validation
- API routes in `src/app/api/arkik/`

### Quality Services
- `src/services/qualityService.ts` - Quality control operations
- `src/services/siteChecksService.ts` - Site inspection management
- Integration with external testing systems

## Environment Variables

Required environment variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The build process provides fallbacks for missing variables to enable builds without full configuration.

## Development Guidelines

### Code Style
- Follow existing TypeScript patterns
- Use existing component libraries (shadcn/ui, Ant Design, RSuite)
- Maintain role-based access patterns
- Follow plant-aware data filtering patterns

### Adding New Features
1. Check existing patterns in similar components
2. Implement proper role-based access control
3. Consider plant context if feature is plant-specific
4. Use established state management patterns
5. Follow existing API route patterns for server-side logic

### Working with Database
- All database interactions use Supabase client
- Respect RLS policies - they enforce access control
- Use typed database schemas from `src/types/database.types.ts`
- Consider plant filtering when querying data

### Performance Considerations
- Use SWR for caching API responses
- Implement skeleton loading states
- Use React.memo for expensive components
- Consider plant context when caching data

## Testing Strategy

The project currently lacks a comprehensive testing framework. When adding tests:
- Check with team about preferred testing approach
- Consider the complex authentication and authorization requirements
- Test role-based access control thoroughly
- Mock Supabase client for unit tests