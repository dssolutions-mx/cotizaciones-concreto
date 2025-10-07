# Sistema de Visualización de Historial de Precios

Este sistema permite visualizar el historial de precios de recetas por cliente en una aplicación web desarrollada con Next.js 14, Supabase, TypeScript y Tailwind CSS.

## Características

- Visualización tabular y gráfica de precios históricos
- Filtrado por cliente o receta
- Búsqueda y filtros por rango de fechas
- Indicadores de tendencias y cambios porcentuales
- Interfaz moderna y responsiva
- Soporte para múltiples clientes y recetas
- Linting configurado para mantener la calidad del código

## Requisitos Previos

- Node.js 18.x o superior
- npm o yarn
- Base de datos Supabase configurada

## Configuración del Proyecto

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variables de entorno:

Crear un archivo `.env.local` con las siguientes variables:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

3. Iniciar el servidor de desarrollo:

```bash
npm run dev
```

## Estructura del Proyecto

```
src/
  ├── app/                    # Páginas y rutas de la aplicación
  ├── components/            # Componentes reutilizables
  │   ├── ui/               # Componentes de interfaz de usuario
  │   ├── PriceHistoryTable.tsx
  │   └── PriceHistoryChart.tsx
  ├── services/             # Servicios y lógica de negocio
  │   └── priceHistoryService.ts
  ├── types/               # Definiciones de tipos TypeScript
  │   └── priceHistory.ts
  └── lib/                 # Utilidades y funciones auxiliares
      ├── utils.ts
      └── formatters.ts
```

## Uso

1. Acceder a la página de historial de precios en `/dashboard/price-history`
2. Seleccionar el modo de visualización (tabla o gráfico)
3. Filtrar por cliente o receta según necesidad
4. Utilizar los filtros de fecha y búsqueda para refinar resultados

## Tecnologías Utilizadas

- Next.js 14
- TypeScript
- Tailwind CSS
- Supabase
- Recharts
- shadcn/ui
- React Day Picker
- date-fns

## Desarrollo

Para contribuir al proyecto:

1. Crear una rama para la nueva característica
2. Implementar cambios siguiendo los estándares de código
3. Ejecutar pruebas y asegurar que no hay errores
4. Crear un pull request con una descripción detallada

## Licencia

MIT 

## Dashboard Optimization

The dashboard has been optimized with the following improvements:

1. **API Route-based Data Fetching**:
   - Created separate API routes for different dashboard data sections
   - Each route implements caching with appropriate Cache-Control headers
   - API routes can be called in parallel for better performance

2. **Data Caching with SWR**:
   - Implemented SWR (stale-while-revalidate) for client-side data fetching
   - Data is cached in the browser memory for faster subsequent renders
   - Each data section has its own revalidation strategy

3. **Progressive Loading**:
   - Dashboard now shows skeleton loaders during data fetching
   - Components load progressively with staggered animations
   - UI is responsive even when data is still loading

4. **Component Atomization**:
   - Separated dashboard into smaller, focused components
   - Each component handles its own loading state
   - Better memory and performance management

5. **Reduced Animation Cost**:
   - Optimized animation timings and stagger effects
   - Reduced animation complexity for better performance
   - Shortened animation duration for faster perceived load times

These optimizations significantly improve the dashboard load time and provide a smoother user experience, especially for users with slower connections. 

## Calidad de Código y Linting

El proyecto utiliza ESLint para mantener un alto estándar de calidad de código. Hemos configurado reglas que ayudan a prevenir errores comunes y promueven buenas prácticas de desarrollo.

Para obtener más información sobre las reglas de linting y cómo resolver las advertencias comunes, consulta el archivo [LINTING.md](./LINTING.md).

Para ejecutar el linter:

```bash
# Ejecutar el linter
npx next lint

# Corregir automáticamente los problemas que se puedan solucionar
npx next lint --fix
``` # Force redeploy Tue Oct  7 03:15:56 CST 2025
