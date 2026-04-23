# Cotizaciones Concreto

Aplicación web para **cotizaciones, pedidos, finanzas, compras, inventario y calidad** del negocio de concreto. Está construida con **Next.js** (App Router), **React**, **TypeScript**, **Supabase** y **Tailwind CSS**.

## Versiones y releases

- **[CHANGELOG.md](./CHANGELOG.md)** — Notas por mes (línea de tiempo alineada con el historial del repositorio).
- **[docs/VERSIONING.md](./docs/VERSIONING.md)** — Esquema CalVer (`YYYY.M.patch`), tags `vYYYY.M.0` y proceso para publicar en GitHub Releases.

La versión actual del paquete está en `package.json` y debe actualizarse junto con el changelog al cerrar cada mes.

## Requisitos

- **Node.js** ≥ 20.19.0 (ver `package.json` → `engines`)
- **npm** ≥ 10
- Proyecto **Supabase** con variables de entorno configuradas

## Configuración rápida

```bash
npm install
```

Crear `.env.local` con al menos:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon
```

Inicio en desarrollo:

```bash
npm run dev
```

Compilación de producción (usa `build.js` del repositorio):

```bash
npm run build
npm start
```

## Calidad de código

```bash
npm run lint
```

Guía de reglas ESLint: [MDFILES/LINTING.md](./MDFILES/LINTING.md).

## Documentación adicional

- [MDFILES/DOCUMENTATION.md](./MDFILES/DOCUMENTATION.md) — Visión general del sistema.
- [docs/README.md](./docs/README.md) — Índice de guías (despliegue, flujo de desarrollo, CI).

## Licencia

MIT
