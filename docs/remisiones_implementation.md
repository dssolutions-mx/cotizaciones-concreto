# Sistema de Registro de Remisiones con Extracción de PDF

## Descripción General

Este sistema permite registrar las remisiones de concreto y bombeo para cada orden, con dos métodos de entrada:

1. **Extracción automática de PDF**: Extrae datos específicos de remisiones en formato PDF
2. **Registro manual**: Para ingresar datos manualmente, especialmente útil para remisiones de bombeo

## Base de Datos

Se han creado las siguientes tablas y modificaciones:

- Nuevos campos en `order_items`: `concrete_volume_delivered` y `pump_volume_delivered`
- Nueva tabla `remisiones`: Almacena los datos principales de cada remisión
- Nueva tabla `remision_materiales`: Guarda los materiales específicos de cada remisión
- Políticas RLS: Acceso controlado para diferentes roles de usuario
- Trigger automático: Actualiza los totales de volumen en las órdenes

### Estructura de Tablas

#### Tabla `remisiones`
```sql
CREATE TABLE remisiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  remision_number VARCHAR(50) NOT NULL,
  fecha DATE NOT NULL,
  hora_carga TIME NOT NULL,
  volumen_fabricado DECIMAL(10,2) NOT NULL,
  conductor VARCHAR(100),
  matricula VARCHAR(50),
  designacion_ehe VARCHAR(50),
  tipo_remision VARCHAR(20) NOT NULL CHECK (tipo_remision IN ('CONCRETO', 'BOMBEO')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
)
```

#### Tabla `remision_materiales`
```sql
CREATE TABLE remision_materiales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remision_id UUID REFERENCES remisiones(id) ON DELETE CASCADE NOT NULL,
  material_type VARCHAR(100) NOT NULL,
  cantidad_real DECIMAL(10,2),
  cantidad_teorica DECIMAL(10,2)
)
```

## Componentes Frontend

### 1. RemisionPdfExtractor
Componente para cargar y extraer datos de archivos PDF de remisiones:
- Permite previsualizar el PDF cargado
- Extrae datos mediante expresiones regulares específicas
- Devuelve los datos estructurados para su validación

### 2. VerificationModal
Modal para verificar/editar los datos extraídos del PDF:
- Permite corregir cualquier dato extraído incorrectamente
- Muestra comparaciones entre valores teóricos y reales
- Valida y almacena los datos en la base de datos

### 3. RemisionManualForm
Formulario para registro manual de remisiones:
- Soporte para remisiones de concreto y bombeo
- Validación de campos requeridos
- Registro directo sin paso de verificación

### 4. RegistroRemision
Componente principal que integra los anteriores:
- Interfaz con pestañas para elegir método de entrada
- Control de acceso basado en roles
- Actualización automática de la lista al crear una remisión

### 5. RemisionesList
Visualización de remisiones registradas:
- Agrupación por tipo (concreto/bombeo)
- Cálculo de totales
- Visualización de detalles completos

## Flujo de Trabajo

1. El usuario navega a la pestaña "Remisiones" en los detalles de la orden
2. Selecciona el método de entrada (PDF o Manual)
3. Para PDF:
   - Carga el archivo
   - Verifica los datos extraídos en el modal
   - Confirma para guardar
4. Para registro manual:
   - Completa el formulario
   - Envía directamente
5. La lista de remisiones se actualiza automáticamente
6. Los totales de volumen entregado se actualizan en la orden

## Control de Acceso

- Solo los roles DOSIFICADOR, PLANT_MANAGER y EXECUTIVE pueden crear remisiones
- Todos los roles anteriores más SALES_AGENT pueden visualizarlas
- Las políticas RLS garantizan la seguridad a nivel de base de datos

## Tecnologías Utilizadas

- **PDF.js**: Para la extracción de texto de archivos PDF
- **Expresiones regulares**: Para extraer campos específicos
- **Supabase**: Para almacenamiento y políticas RLS
- **React**: Interfaz de usuario con componentes reutilizables

## Dependencias

- pdfjs-dist: Biblioteca para procesamiento de PDF
- date-fns: Manipulación y formateo de fechas
- Componentes UI personalizados (Button, Dialog, Table, etc.)

## Consideraciones Técnicas

1. La extracción de PDF se realiza completamente en el navegador sin enviar el archivo al servidor
2. Las políticas RLS garantizan que solo usuarios autorizados puedan crear y ver remisiones
3. El trigger automático mantiene actualizados los volúmenes entregados en las órdenes
4. La interfaz proporciona validación visual de datos extraídos para garantizar precisión 