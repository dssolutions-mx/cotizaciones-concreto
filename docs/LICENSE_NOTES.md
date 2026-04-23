# Notas sobre licencia (no es asesoría legal)

Texto de referencia que antes estaba en el README del repositorio. Para decisiones formales, consulta a un abogado en tu jurisdicción.

## Autor persona física

Esto resume prácticas habituales; **no es asesoría legal**. Para contratos con clientes, empleados o inversores conviene un abogado en tu jurisdicción (por ejemplo México o Estados Unidos, según dónde factures o tengas socios).

1. **Derechos de autor y titularidad** — En muchos países el software tiene protección por **derecho de autor** desde que existe en forma tangible. Quien **programa** suele ser el primer titular; si el código lo pagó una **empresa** como trabajo subordinado o encargo, el contrato laboral o de servicios puede decir que los derechos son de la **empresa** (cesión o obra por encargo). Si otros **contribuyen** al repo, conviene **acuerdos de contribución** o cláusulas de cesión para que la titularidad quede clara.

2. **Archivo `LICENSE` en el repo** — Sirve como **aviso público**: “todo reservado”. No sustituye un **contrato** con cada cliente; es la primera capa de claridad en GitHub.

3. **Contratos con terceros** — Para clientes o socios: **contrato de licencia de software**, **SaaS / términos de servicio**, o **NDA + anexo de licencia** donde se defina alcance (usuarios, plantas, instalación on‑prem vs nube), duración, soporte, limitación de responsabilidad y confidencialidad.

4. **Registro** — En muchas jurisdicciones **no** es obligatorio registrar el programa para existir derechos de autor, pero el **registro** o depósito puede ayudar como **prueba** en litigios (depende del país). Pregunta a un especialista local si aplica a tu caso.

5. **Marcas y datos** — El `LICENSE` cubre el **código**; **marca**, **base de datos** de clientes y **contenido** del usuario suelen regularse aparte (políticas de privacidad, contratos de tratamiento de datos, etc.).

6. **Open source más adelante** — Si algún día quisieras publicar bajo MIT, Apache-2.0, AGPL, etc., se reemplaza `LICENSE`, se actualiza `"license"` en `package.json` y se revisa que no queden **secretos** (claves, nombres de clientes) en el historial del repositorio.

## Licencia “pública” tipo paquete npm

No hace falta un trámite gubernamental general para “tener licencia”: defines **permisos** en **texto legal** (`LICENSE` + contratos). Para software **cerrado**, lo habitual es **contacto directo** con el titular y un **contrato firmado**.
