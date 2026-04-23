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

El código es **propietario** de **Juan Jose Aguirre Segarra**. No se concede licencia de uso, copia ni distribución salvo acuerdo por escrito con el titular. Consulta el archivo **[LICENSE](./LICENSE)**.

`package.json` declara `"license": "UNLICENSED"` para indicar que **no** es un paquete npm de código abierto con permisos generales.

### Cómo suele gestionarse la licencia (autor persona física)

Esto resume prácticas habituales; **no es asesoría legal**. Para contratos con clientes, empleados o inversores conviene un abogado en tu jurisdicción (por ejemplo México o Estados Unidos, según dónde factures o tengas socios).

1. **Derechos de autor y titularidad** — En muchos países el software tiene protección por **derecho de autor** desde que existe en forma tangible. Quien **programa** suele ser el primer titular; si el código lo pagó una **empresa** como trabajo subordinado o encargo, el contrato laboral o de servicios puede decir que los derechos son de la **empresa** (cesión o obra por encargo). Si otros **contribuyen** al repo, conviene **acuerdos de contribución** o cláusulas de cesión para que la titularidad quede clara.

2. **Archivo `LICENSE` en el repo** — Sirve como **aviso público**: “todo reservado”. No sustituye un **contrato** con cada cliente; es la primera capa de claridad en GitHub.

3. **Contratos con terceros** — Para clientes o socios: **contrato de licencia de software**, **SaaS / términos de servicio**, o **NDA + anexo de licencia** donde se defina alcance (usuarios, plantas, instalación on‑prem vs nube), duración, soporte, limitación de responsabilidad y confidencialidad.

4. **Registro** — En muchas jurisdicciones **no** es obligatorio registrar el programa para existir derechos de autor, pero el **registro** o depósito puede ayudar como **prueba** en litigios (depende del país). Pregunta a un especialista local si aplica a tu caso.

5. **Marcas y datos** — El `LICENSE` cubre el **código**; **marca**, **base de datos** de clientes y **contenido** del usuario suelen regularse aparte (políticas de privacidad, contratos de tratamiento de datos, etc.).

6. **Open source más adelante** — Si algún día quisieras publicar bajo MIT, Apache-2.0, AGPL, etc., se reemplaza `LICENSE`, se actualiza `"license"` en `package.json` y se revisa que no queden **secretos** (claves, nombres de clientes) en el historial del repositorio.

### ¿Cómo “obtener” una licencia pública tipo paquete npm?

No hace falta un trámite gubernamental general para “tener licencia”: defines **permisos** en **texto legal** (`LICENSE` + contratos). Para software **cerrado**, lo habitual es **contacto directo** con el titular (Juan Jose Aguirre Segarra) y un **contrato firmado**.
