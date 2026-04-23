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

Build de producción (usa `build.js` del repo):

```bash
npm run build
npm start
```

Más detalle: [MDFILES/DOCUMENTATION.md](./MDFILES/DOCUMENTATION.md) y [docs/README.md](./docs/README.md).

---

## Licencia

El código es **propietario**. No se concede licencia de uso, copia ni distribución salvo acuerdo por escrito con el titular de los derechos. Consulta el archivo **[LICENSE](./LICENSE)**.

`package.json` declara `"license": "UNLICENSED"` para reflejar que **no** es software de código abierto.

### ¿Cómo “obtener” una licencia si hoy no hay una pública?

1. **Decidir la política** con asesoría legal: ¿solo uso interno, licencia a clientes, SaaS, o código abierto parcial?
2. **Si permanece propietario:** mantén este `LICENSE` (o sustitúyelo por un contrato marco redactado por un abogado) y otorga permisos por **contrato** o **NDA + anexo de licencia** a cada tercero.
3. **Si quieren open source de verdad:** elijan una licencia estándar (por ejemplo MIT, Apache-2.0, AGPL-3.0), reemplacen `LICENSE`, cambien `"license"` en `package.json` y aclaren en el README qué componentes quedan excluidos (marca, datos, etc.).

No existe un trámite gubernamental obligatorio para “registrar” una licencia de software en la mayoría de jurisdicciones; lo importante es **documentar los derechos** y **los permisos** por escrito.
