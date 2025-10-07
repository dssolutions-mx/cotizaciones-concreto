# Implementación de Impresión PDF para Estudios de Caracterización

## 📄 Descripción General

Se ha implementado la funcionalidad para exportar un **reporte completo** de caracterización de materiales (Arena y Grava) en formato PDF profesional con los colores corporativos de DC Concretos. El reporte incluye TODOS los estudios completados del alta_estudio en un solo documento.

## 🎨 Características del PDF

### Diseño Visual
- ✅ **Colores Corporativos**: Verde `#069E2D` y Azul Oscuro `#0C1F28`
- ✅ **Logo de la Empresa**: En el encabezado de cada página
- ✅ **Diseño Diagonal**: Header con diseño diagonal bicolor
- ✅ **Footer Informativo**: Contacto de la empresa en todas las páginas
- ✅ **Numeración**: Páginas numeradas automáticamente

### Contenido Incluido

El PDF genera un reporte completo que incluye TODOS los estudios completados:

#### Página 1: Información General y Granulometría
- 📋 **Información del Estudio**:
  - Tipo de material (Arena/Grava)
  - Nombre del material
  - Procedencia (mina)
  - Planta
  - Técnico responsable
  - Tamaño (si aplica)
  - Fecha de elaboración
  - ID del estudio

- 📊 **Análisis Granulométrico**:
  - Tabla completa con todas las mallas ensayadas
  - Columnas: Malla, Abertura (mm), Peso Retenido (g), % Retenido, % Acumulado, % Pasa
  - Límites granulométricos (si están definidos)
  - Resultados calculados:
    * Peso de muestra inicial
    * Peso total retenido
    * Módulo de finura
    * Tamaño máximo nominal
  - Observaciones del técnico

#### Página 2: Ensayos Físicos (si aplica)
Esta página incluye TODOS los estudios físicos completados:

- ⚖️ **Masa Volumétrica**:
  - Masa volumétrica suelta (kg/m³)
  - Masa volumétrica compactada (kg/m³)

- 🔬 **Densidad**:
  - Densidad relativa (g/cm³)
  - Densidad SSS (g/cm³)
  - Densidad aparente (g/cm³)
  - Absorción (%)

- 🧪 **Pérdida por Lavado**:
  - Pérdida por lavado (g)
  - Pérdida por lavado (%)

- 💧 **Absorción**:
  - Absorción (%)
  - Absorción (g)

- 📊 **Caracterización Física** (si existe como estudio separado):
  - Masa específica
  - Masa específica SSS
  - Masa específica seca

## 🛠️ Implementación Técnica

### Componentes Creados

#### 1. `EstudioPDF.tsx`
Ubicación: `src/components/quality/caracterizacion/EstudioPDF.tsx`

Componente de React PDF que genera el documento:
```typescript
import { EstudioPDF } from '@/components/quality/caracterizacion/EstudioPDF';

<PDFDownloadLink
  document={<EstudioPDF estudio={estudiosData} />}
  fileName={`estudio_${fecha}.pdf`}
>
  {({ loading }) => (loading ? 'Generando PDF...' : 'Descargar PDF')}
</PDFDownloadLink>
```

**Props del componente**:
```typescript
interface EstudioPDFProps {
  estudio: {
    alta_estudio: {
      id: string;
      tipo_material: 'Arena' | 'Grava';
      mina_procedencia: string;
      nombre_material: string;
      tecnico: string;
      fecha_elaboracion: string;
      planta?: { nombre: string };
    };
    estudios: Array<{
      tipo_estudio: string;
      estado: string;
      resultados?: any;
    }>;
    limites?: Array<{
      malla: string;
      limite_inferior: number;
      limite_superior: number;
    }>;
    tamaño?: string;
  };
}
```

### Modificaciones en Páginas Existentes

#### 2. Página de Detalle del Estudio
Ubicación: `src/app/quality/caracterizacion-materiales/[id]/page.tsx`

Se agregó:
- ✅ Import de `PDFDownloadLink` de `@react-pdf/renderer`
- ✅ Import del componente `EstudioPDF`
- ✅ Import del ícono `Printer` de lucide-react
- ✅ Botón "Imprimir Reporte" en el **header principal** de la página

**Código agregado en el header**:
```typescript
{/* Botón de Imprimir Reporte Completo */}
{estudio.estudios_seleccionados.some(e => e.estado === 'completado' && e.resultados) && (
  <PDFDownloadLink
    document={
      <EstudioPDF
        estudio={{
          alta_estudio: estudio,
          estudios: estudio.estudios_seleccionados.filter(e => e.estado === 'completado' && e.resultados),
          limites: [],
          tamaño: estudio.estudios_seleccionados.find(e => e.resultados?.tamaño)?.resultados?.tamaño
        }}
      />
    }
    fileName={`Reporte_Caracterizacion_${estudio.nombre_material}_${format(new Date(), 'yyyyMMdd')}.pdf`}
  >
    {({ loading }) => (
      <Button
        variant="default"
        className="bg-[#069E2D] hover:bg-[#069E2D]/90 text-white"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generando PDF...
          </>
        ) : (
          <>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Reporte
          </>
        )}
      </Button>
    )}
  </PDFDownloadLink>
)}
```

## 🎨 Estilos del PDF

### Paleta de Colores
```typescript
const colors = {
  primary: '#069E2D',      // Verde DC Concretos
  secondary: '#0C1F28',    // Azul Oscuro DC Concretos
  text: '#333333',         // Texto principal
  textLight: '#666666',    // Texto secundario
  border: '#E5E7EB',       // Bordes
  bgLight: '#F9FAFB',      // Fondo alternado
  bgInfo: '#F0F9FF',       // Fondo de información
  bgWarning: '#FFFBEB',    // Fondo de observaciones
}
```

### Tipografía
- **Títulos**: Helvetica-Bold, 16px
- **Subtítulos**: Helvetica-Bold, 12px, Verde `#069E2D`
- **Encabezados de Tabla**: Helvetica-Bold, 9px, Blanco
- **Contenido**: Helvetica, 9-10px

## 📱 Interfaz de Usuario

### Botón de Imprimir Reporte
- **Ubicación**: Header principal de la página de detalle, junto al botón "Volver"
- **Diseño**: 
  - Botón verde con colores corporativos (`#069E2D`)
  - Ícono de impresora
  - Texto "Imprimir Reporte"
- **Estados**:
  - Normal: Muestra ícono de impresora + texto
  - Cargando: Muestra spinner con texto "Generando PDF..."
  - Deshabilitado: Cuando el PDF se está generando
  - Oculto: Si no hay estudios completados

### Comportamiento
1. El botón solo aparece si:
   - Al menos UN estudio está completado (`estado === 'completado'`)
   - Al menos UN estudio tiene resultados guardados

2. Al hacer clic:
   - Se recopilan TODOS los estudios completados
   - Se genera un PDF completo con todos los resultados
   - Se descarga con el nombre: `Reporte_Caracterizacion_{NombreMaterial}_{Fecha}.pdf`
   - Ejemplo: `Reporte_Caracterizacion_Grava_20mm_20250107.pdf`

3. El reporte incluye:
   - ✅ Información general del alta_estudio
   - ✅ TODOS los estudios completados con sus resultados
   - ✅ Tabla de granulometría (si está completada)
   - ✅ Masa volumétrica (si está completada)
   - ✅ Densidad (si está completada)
   - ✅ Pérdida por lavado (si está completada)
   - ✅ Absorción (si está completada)
   - ✅ Caracterización física (si está completada)

## 🚀 Uso

### Para el Usuario Final
1. Navegar a la página de detalle de un estudio de caracterización (alta_estudio)
2. Completar uno o más estudios (Granulometría, Masa Volumétrica, Densidad, etc.)
3. En el header de la página, hacer clic en el botón verde "Imprimir Reporte"
4. El PDF se generará automáticamente con TODOS los estudios completados
5. El PDF se descargará con el nombre del material y la fecha

### Para Desarrolladores
```typescript
// Importar componentes necesarios
import { PDFDownloadLink } from '@react-pdf/renderer';
import { EstudioPDF } from '@/components/quality/caracterizacion/EstudioPDF';

// Preparar datos del estudio
const estudiosData = {
  alta_estudio: {
    id: '...',
    tipo_material: 'Arena',
    // ... otros campos
  },
  estudios: [
    {
      tipo_estudio: 'Granulometría',
      resultados: { /* ... */ }
    }
  ],
  limites: [ /* ... */ ],
  tamaño: '3/4"'
};

// Renderizar botón de descarga
<PDFDownloadLink
  document={<EstudioPDF estudio={estudiosData} />}
  fileName="estudio.pdf"
>
  {({ loading }) => (
    <Button disabled={loading}>
      {loading ? 'Generando...' : 'Descargar PDF'}
    </Button>
  )}
</PDFDownloadLink>
```

## 📦 Dependencias

- `@react-pdf/renderer`: Para generación de PDFs
- `date-fns`: Para formateo de fechas
- `lucide-react`: Para íconos

## 🔄 Mejoras Futuras

### Posibles Extensiones
1. **Gráfica de Granulometría en PDF**:
   - Capturar la gráfica como imagen
   - Incluirla en el PDF

2. **Firma Digital**:
   - Campo para firma del técnico
   - Sello de la empresa

3. **QR Code**:
   - Código QR con enlace al estudio digital
   - Verificación de autenticidad

4. **Comparaciones**:
   - Comparar múltiples estudios en un solo PDF
   - Gráficas comparativas

5. **Templates Personalizables**:
   - Diferentes plantillas según la planta
   - Configuración de elementos a incluir

## 🐛 Troubleshooting

### El PDF no se genera
- Verificar que todos los datos del estudio estén completos
- Revisar la consola del navegador para errores
- Verificar que `@react-pdf/renderer` esté instalado correctamente

### Formato incorrecto
- Verificar que los datos cumplan con la estructura esperada
- Revisar que las fechas estén en formato válido
- Comprobar que los números sean numéricos y no strings

### Imágenes no aparecen
- Verificar que la ruta del logo sea accesible públicamente
- Asegurarse de que las imágenes estén en la carpeta `public/`

## 📚 Referencias

- [React-PDF Documentation](https://react-pdf.org/)
- [Lucide Icons](https://lucide.dev/)
- [Date-fns Documentation](https://date-fns.org/)

---

**Última actualización**: Enero 2025
**Versión**: 1.0.0

