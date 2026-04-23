# Plataforma integral de concreto

**Un solo sistema** para cotizar, producir, comprar, cobrar y asegurar calidad: operación diaria, finanzas y laboratorio conectados en tiempo real sobre **Next.js**, **Supabase** y **TypeScript**.

> De la cotización a la remisión, del laboratorio al cliente: visibilidad por planta, roles claros y trazabilidad que aguantan auditoría.

---

## Por qué importa

- **Menos hojas y correos:** flujos digitales para pedidos, evidencias, compras y reportes.
- **Una sola fuente de verdad:** datos en Supabase con control de acceso por rol y por planta.
- **Listo para equipos mixtos:** comercial en campo, dosificación en planta, finanzas en oficina, calidad en laboratorio.

---

## Lo que incluye (hoy)

### Comercial y cotización

- CRM de **clientes** y obras, **cotizaciones** con flujo de aprobación y validación de crédito.
- **Precios** por material y periodo, listas ejecutivas y **gobierno de precios** con trazabilidad.
- **Pedidos** con UX orientada a operación (filtros, pestañas, balance del cliente).
- **Calculadora de recetas** y carga de recetas; integración **Arkik** (procesamiento de remisiones y creación de recetas desde archivo).

### Finanzas y analítica

- **Centro de compras** (órdenes de compra, entradas, conciliación, exportaciones contables).
- **Reportes de ventas**, **ventas y pagos diarios**, **remisiones por cliente**, **CxC / cartera**.
- **Producción** y analíticas comparativas; **mapa de ubicaciones** y datos históricos.
- **Evidencia de concreto** por orden (documentos, exportaciones, bundles para clientes).
- **Reportes para clientes** y **cumplimiento** (por ejemplo reportes semanales de personal).

### Control de producción e inventario

- **Registro de entradas** de material, **solicitudes de material**, **ajustes** y **lotes**.
- **Remisiones**, **cross-plant**, **alertas** y tableros avanzados.
- **Servicio de bombeo** y **evidencia de concreto** en planta.
- **Evidencia** y flujos pensados para **dosificadores** y administración de operaciones.

### Calidad y laboratorio (EMA / ISO-friendly)

- **Muestreos**, **ensayos**, **control en obra** y **reportes** consolidados.
- **Instrumentos**: catálogo, programa, **conjuntos**, **paquetes**, verificaciones e incidentes.
- **Validaciones**: caracterización de materiales, **curvas de Abrams**, proveedores de nuevos materiales.
- **Controles** y paneles de análisis por cliente y por receta; **gobernanza de recetas** y maestros.
- Estudios: **certificados**, **fichas técnicas**, **hojas de seguridad**.

### Recursos humanos y administración

- **Reloj checador** y reporte **semanal de remisiones** para RH.
- **Administración**: plantas, usuarios, roles, materiales, **portal de clientes** y bombeo.

### Portal del cliente

- Acceso para clientes a **pedidos**, **programación**, **aprobaciones**, **balance** y **calidad** según permisos.

### Seguridad y operación

- Autenticación **Supabase**, **RLS**, protección **BotID** y anuncios de **nuevas versiones** en la app.

---

## Roles que ya contempla el producto

El menú y los permisos están pensados para perfiles como **ejecutivo**, **gerente de planta**, **agente de ventas**, **validador de crédito**, **dosificador**, **calidad**, **administración de operaciones** y **portal externo**, siempre filtrando por **planta** cuando aplica.

---

## Versiones

- **[CHANGELOG.md](./CHANGELOG.md)** — Historial mensual curado.
- **[docs/VERSIONING.md](./docs/VERSIONING.md)** — CalVer, tags y **GitHub Releases**.

---

## Arranque rápido (desarrollo)

Requisitos: **Node.js** ≥ 20.19 y **npm** ≥ 10 (ver `package.json` → `engines`).

```bash
npm install
```

Variables mínimas en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon
```

```bash
npm run dev
```

Build de producción (usa `build.js` en la raíz):

```bash
npm run build
npm start
```

Más detalle: [MDFILES/DOCUMENTATION.md](./MDFILES/DOCUMENTATION.md) y [docs/README.md](./docs/README.md).

### Estructura del repositorio

- **`src/`** — Aplicación Next.js.
- **`scripts/`** — Herramientas operativas (TypeScript/Node usados por `npm run`, backfills, validaciones).
- **`docs/`** — Documentación activa; **`docs/archive/`** — notas y planes viejos sacados de la raíz.
- **`archive/data/`** — CSV/JSON de apoyo a migraciones puntuales (no usados en runtime).
- **`proxy.ts`** — Next.js 16 **Proxy** (auth, CSP, rutas); exportar **`proxy`**. **`build.js`** — build en la raíz (referenciado por `package.json` / Vercel).
- **`generate_*_migration.py`** — Generadores SQL puntuales en la raíz (mismo directorio que `archive/data/`).

---

## Licencia

Software **propietario** — **Juan Jose Aguirre Segarra**. Términos completos en **[LICENSE](./LICENSE)**. Uso comercial o redistribución: **juan.aguirre@dssolutions-mx.com**. En `package.json`, `"license": "UNLICENSED"` indica que no se publica como paquete npm de código abierto. Notas generales (sin valor legal): [docs/LICENSE_NOTES.md](./docs/LICENSE_NOTES.md).
