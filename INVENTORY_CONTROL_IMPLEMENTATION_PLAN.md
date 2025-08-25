# Inventory Control System Implementation Plan
## Dosificador Dashboard & Daily Inventory Management

### Overview
This plan implements a comprehensive inventory control system with a dedicated dosificador dashboard for daily material management, including entries, adjustments, and Arkik integration. The system follows modular architecture principles and integrates seamlessly with existing infrastructure.

---

## Phase 1: Database Schema Restructuring & New Tables

### 1.1 Core Inventory Tables Creation

**Note**: This implementation integrates with the existing `material_prices` table for cost calculations. The `total_cost` field in `material_entries` is automatically calculated using the current active price from `material_prices` for the specific material and plant combination.

#### Table: `material_entries` (Daily Material Receipts)
```sql
CREATE TABLE material_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(100) UNIQUE NOT NULL,
  plant_id UUID NOT NULL REFERENCES plants(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  supplier_id UUID REFERENCES suppliers(id),
  
  -- Entry details
  entry_date DATE NOT NULL,
  entry_time TIME DEFAULT CURRENT_TIME,
  quantity_received DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (
    quantity_received * COALESCE((
      SELECT unit_price FROM material_prices 
      WHERE material_id = material_entries.material_id 
      AND plant_id = material_entries.plant_id 
      AND is_active = true
      LIMIT 1
    ), 0)
  ) STORED,
  
  -- Documentation
  supplier_invoice VARCHAR(100),
  truck_number VARCHAR(50),
  driver_name VARCHAR(100),
  receipt_document_url TEXT,
  
  -- Inventory tracking
  inventory_before DECIMAL(10,2) NOT NULL,
  inventory_after DECIMAL(10,2) NOT NULL,
  
  -- Quality/Notes
  quality_status VARCHAR(20) DEFAULT 'approved' CHECK (quality_status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  
  -- Authorization
  entered_by UUID NOT NULL REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `material_adjustments` (Daily Manual Adjustments)
```sql
CREATE TABLE material_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number VARCHAR(100) UNIQUE NOT NULL,
  plant_id UUID NOT NULL REFERENCES plants(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  
  -- Adjustment details
  adjustment_date DATE NOT NULL,
  adjustment_time TIME DEFAULT CURRENT_TIME,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('consumption', 'waste', 'correction', 'transfer', 'loss')),
  
  -- Quantities
  quantity_adjusted DECIMAL(10,2) NOT NULL,
  
  -- Inventory tracking
  inventory_before DECIMAL(10,2) NOT NULL,
  inventory_after DECIMAL(10,2) NOT NULL,
  
  -- Reference information
  reference_type VARCHAR(50),
  reference_notes TEXT,
  
  -- Authorization
  adjusted_by UUID NOT NULL REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: `material_inventory` (Real-time Stock Levels)
```sql
CREATE TABLE material_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  
  -- Stock levels
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  maximum_stock DECIMAL(10,2),
  
  -- Status
  stock_status VARCHAR(20) GENERATED ALWAYS AS (
    CASE 
      WHEN current_stock <= minimum_stock THEN 'LOW'
      WHEN current_stock > COALESCE(maximum_stock, current_stock) THEN 'EXCESS'
      ELSE 'OK'
    END
  ) STORED,
  
  -- Last movement tracking
  last_entry_date DATE,
  last_adjustment_date DATE,
  last_consumption_date DATE,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plant_id, material_id)
);
```

#### Table: `daily_inventory_log` (Daily Activity Summary)
```sql
CREATE TABLE daily_inventory_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  log_date DATE NOT NULL,
  
  -- Daily summary
  total_entries INTEGER DEFAULT 0,
  total_adjustments INTEGER DEFAULT 0,
  total_consumption DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  is_closed BOOLEAN DEFAULT FALSE,
  closed_by UUID REFERENCES user_profiles(id),
  closed_at TIMESTAMPTZ,
  
  -- Notes
  daily_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plant_id, log_date)
);
```

### 1.2 Storage Bucket Configuration
```sql
-- Create storage bucket for inventory documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-documents',
  'inventory-documents', 
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf', 'text/csv']::text[]
);

-- RLS policies for inventory documents
CREATE POLICY "Plant users can upload inventory documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inventory-documents');

CREATE POLICY "Plant users can view their inventory documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'inventory-documents');
```

### 1.3 Automated Triggers & Functions

#### Function: Update Inventory from Entries
```sql
CREATE OR REPLACE FUNCTION update_inventory_from_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current stock
  UPDATE material_inventory 
  SET 
    current_stock = NEW.inventory_after,
    last_entry_date = NEW.entry_date,
    updated_at = NOW()
  WHERE material_id = NEW.material_id 
  AND plant_id = NEW.plant_id;
  
  -- Create if doesn't exist
  INSERT INTO material_inventory (plant_id, material_id, current_stock, minimum_stock, last_entry_date)
  VALUES (NEW.plant_id, NEW.material_id, NEW.inventory_after, 0, NEW.entry_date)
  ON CONFLICT (plant_id, material_id) DO UPDATE SET
    current_stock = NEW.inventory_after,
    last_entry_date = NEW.entry_date,
    updated_at = NOW();
  
  -- Update daily log
  INSERT INTO daily_inventory_log (plant_id, log_date, total_entries)
  VALUES (NEW.plant_id, NEW.entry_date, 1)
  ON CONFLICT (plant_id, log_date) DO UPDATE SET
    total_entries = daily_inventory_log.total_entries + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_entry
  AFTER INSERT OR UPDATE ON material_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_entry();
```

#### Function: Update Inventory from Adjustments
```sql
CREATE OR REPLACE FUNCTION update_inventory_from_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current stock
  UPDATE material_inventory 
  SET 
    current_stock = NEW.inventory_after,
    last_adjustment_date = NEW.adjustment_date,
    updated_at = NOW()
  WHERE material_id = NEW.material_id 
  AND plant_id = NEW.plant_id;
  
  -- Update daily log
  INSERT INTO daily_inventory_log (plant_id, log_date, total_adjustments)
  VALUES (NEW.plant_id, NEW.adjustment_date, 1)
  ON CONFLICT (plant_id, log_date) DO UPDATE SET
    total_adjustments = daily_inventory_log.total_adjustments + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_adjustment
  AFTER INSERT OR UPDATE ON material_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_adjustment();
```

#### Function: Update Inventory from Remisiones (Existing System)
```sql
CREATE OR REPLACE FUNCTION update_inventory_from_remision()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current stock when remision_materiales is inserted/updated
  UPDATE material_inventory 
  SET 
    current_stock = current_stock - NEW.cantidad_real,
    last_consumption_date = (SELECT fecha FROM remisiones WHERE id = NEW.remision_id),
    updated_at = NOW()
  WHERE material_id = NEW.material_id 
  AND plant_id = (SELECT plant_id FROM remisiones WHERE id = NEW.remision_id);
  
  -- Create inventory record if it doesn't exist
  INSERT INTO material_inventory (plant_id, material_id, current_stock, minimum_stock, last_consumption_date)
  SELECT 
    r.plant_id,
    NEW.material_id,
    -NEW.cantidad_real,
    0,
    r.fecha
  FROM remisiones r 
  WHERE r.id = NEW.remision_id
  AND NOT EXISTS (
    SELECT 1 FROM material_inventory mi 
    WHERE mi.material_id = NEW.material_id 
    AND mi.plant_id = r.plant_id
  );
  
  -- Update daily log consumption
  UPDATE daily_inventory_log 
  SET 
    total_consumption = total_consumption + NEW.cantidad_real,
    updated_at = NOW()
  WHERE plant_id = (SELECT plant_id FROM remisiones WHERE id = NEW.remision_id)
  AND log_date = (SELECT fecha FROM remisiones WHERE id = NEW.remision_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_consumption
  AFTER INSERT OR UPDATE ON remision_materiales
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_remision();
```

### 1.4 Management Views
```sql
-- Current Stock Status View
CREATE VIEW vw_current_stock_status AS
SELECT 
  p.name as plant_name,
  m.material_name,
  m.category,
  mi.current_stock,
  mi.minimum_stock,
  mi.stock_status,
  mi.last_entry_date,
  mi.last_adjustment_date,
  mi.last_consumption_date
FROM material_inventory mi
JOIN materials m ON mi.material_id = m.id
JOIN plants p ON mi.plant_id = p.id
WHERE m.is_active = true
ORDER BY p.name, mi.stock_status DESC, m.material_name;

-- Daily Activity Log View
CREATE VIEW vw_daily_inventory_activity AS
SELECT 
  'ENTRY' as activity_type,
  me.entry_date as activity_date,
  me.entry_time as activity_time,
  p.name as plant_name,
  m.material_name,
  me.quantity_received as quantity,
  me.inventory_before,
  me.inventory_after,
  up.first_name || ' ' || up.last_name as performed_by,
  me.notes
FROM material_entries me
JOIN materials m ON me.material_id = m.id
JOIN plants p ON me.plant_id = p.id
JOIN user_profiles up ON me.entered_by = up.id

UNION ALL

SELECT 
  'ADJUSTMENT' as activity_type,
  ma.adjustment_date as activity_date,
  ma.adjustment_time as activity_time,
  p.name as plant_name,
  m.material_name,
  ma.quantity_adjusted as quantity,
  ma.inventory_before,
  ma.inventory_after,
  up.first_name || ' ' || up.last_name as performed_by,
  ma.reference_notes as notes
FROM material_adjustments ma
JOIN materials m ON ma.material_id = m.id
JOIN plants p ON ma.plant_id = p.id
JOIN user_profiles up ON ma.adjusted_by = up.id

ORDER BY activity_date DESC, activity_time DESC;
```

---

## Phase 2: Backend API Development

### 2.1 New API Endpoints Structure

#### Inventory Management Routes
```typescript
// src/app/api/inventory/route.ts
export async function GET(request: Request) {
  // Get current inventory status for user's plant
}

export async function POST(request: Request) {
  // Create new inventory entry or adjustment
}
```

#### Daily Log Routes
```typescript
// src/app/api/inventory/daily-log/route.ts
export async function GET(request: Request) {
  // Get daily inventory log for specific date
}

export async function POST(request: Request) {
  // Create/update daily log entry
}

export async function PUT(request: Request) {
  // Close daily log
}
```

#### Material Entries Routes
```typescript
// src/app/api/inventory/entries/route.ts
export async function GET(request: Request) {
  // Get material entries for date range
}

export async function POST(request: Request) {
  // Create new material entry
}

export async function PUT(request: Request) {
  // Update material entry
}
```

#### Material Adjustments Routes
```typescript
// src/app/api/inventory/adjustments/route.ts
export async function GET(request: Request) {
  // Get material adjustments for date range
}

export async function POST(request: Request) {
  // Create new material adjustment
}

export async function PUT(request: Request) {
  // Update material adjustment
}
```

### 2.2 Database Service Layer
```typescript
// src/lib/services/inventoryService.ts
export class InventoryService {
  async getCurrentInventory(plantId: string): Promise<MaterialInventory[]>
  async createMaterialEntry(entry: MaterialEntryInput): Promise<MaterialEntry>
  async createMaterialAdjustment(adjustment: MaterialAdjustmentInput): Promise<MaterialAdjustment>
  async getDailyLog(plantId: string, date: string): Promise<DailyInventoryLog>
  async closeDailyLog(plantId: string, date: string): Promise<void>
  async uploadDocument(file: File, type: 'entry' | 'adjustment', id: string): Promise<string>
}
```

---

## Phase 3: Frontend Implementation

### 3.1 Dosificador Dashboard Layout

#### Main Dashboard Component
```typescript
// src/components/inventory/DosificadorDashboard.tsx
export default function DosificadorDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Dashboard de Dosificador
          </h1>
          <p className="mt-2 text-gray-600">
            Gestión diaria de inventario y materiales
          </p>
        </div>
        
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <QuickActionCard
            title="Entrada de Materiales"
            description="Registrar recepción de materiales del día"
            icon={InboxIcon}
            href="/inventory/entries"
            color="blue"
          />
          <QuickActionCard
            title="Ajustes de Inventario"
            description="Registrar salidas manuales y correcciones"
            icon={AdjustmentsIcon}
            href="/inventory/adjustments"
            color="orange"
          />
          <QuickActionCard
            title="Carga Arkik"
            description="Subir archivos de consumo Arkik"
            icon={UploadIcon}
            href="/inventory/arkik-upload"
            color="green"
          />
        </div>
        
        {/* Daily Summary */}
        <DailyInventorySummary />
        
        {/* Recent Activity */}
        <RecentInventoryActivity />
      </div>
    </div>
  )
}
```

### 3.2 Daily Inventory Management Interface

#### Daily Log Component
```typescript
// src/components/inventory/DailyInventoryLog.tsx
export default function DailyInventoryLog() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isEditing, setIsEditing] = useState(false)
  
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Bitácora Diaria - {format(selectedDate, 'dd/MM/yyyy')}
          </h2>
          <div className="flex items-center space-x-3">
            <DatePicker
              selected={selectedDate}
              onChange={setSelectedDate}
              className="rounded-md border-gray-300"
            />
            <Button
              variant={isEditing ? "destructive" : "default"}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Cancelar" : "Editar"}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {/* Daily Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <SummaryCard
            title="Entradas"
            value={dailyLog?.totalEntries || 0}
            icon={InboxIcon}
            color="blue"
          />
          <SummaryCard
            title="Ajustes"
            value={dailyLog?.totalAdjustments || 0}
            icon={AdjustmentsIcon}
            color="orange"
          />
          <SummaryCard
            title="Consumo Total"
            value={dailyLog?.totalConsumption || 0}
            icon={ConsumptionIcon}
            color="red"
          />
        </div>
        
        {/* Daily Activities Tabs */}
        <Tabs defaultValue="entries" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entries">Entradas del Día</TabsTrigger>
            <TabsTrigger value="adjustments">Ajustes del Día</TabsTrigger>
          </TabsList>
          
          <TabsContent value="entries">
            <MaterialEntriesList date={selectedDate} isEditing={isEditing} />
          </TabsContent>
          
          <TabsContent value="adjustments">
            <MaterialAdjustmentsList date={selectedDate} isEditing={isEditing} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

### 3.3 Material Entry Form
```typescript
// src/components/inventory/MaterialEntryForm.tsx
export default function MaterialEntryForm({ 
  date, 
  onSubmit, 
  initialData 
}: MaterialEntryFormProps) {
  const [formData, setFormData] = useState<MaterialEntryFormData>({
    materialId: '',
    quantity: 0,
    supplierInvoice: '',
    truckNumber: '',
    driverName: '',
    notes: '',
    documents: []
  })
  
  const [uploading, setUploading] = useState(false)
  
  const handleFileUpload = async (files: FileList) => {
    setUploading(true)
    try {
      const uploadedUrls = await Promise.all(
        Array.from(files).map(file => uploadDocument(file, 'entry'))
      )
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, ...uploadedUrls]
      }))
    } catch (error) {
      toast.error('Error al subir documentos')
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Material"
          required
        >
          <MaterialSelect
            value={formData.materialId}
            onChange={(value) => setFormData(prev => ({ ...prev, materialId: value }))}
          />
        </FormField>
        
        <FormField
          label="Cantidad Recibida"
          required
        >
          <Input
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) }))}
          />
        </FormField>
        
        <FormField
          label="Costo Unitario"
          description="Se calcula automáticamente desde la tabla de precios de materiales"
        >
          <Input
            type="text"
            value="Calculado automáticamente"
            disabled
            className="bg-gray-100"
          />
        </FormField>
        
        <FormField
          label="Factura del Proveedor"
        >
          <Input
            value={formData.supplierInvoice}
            onChange={(e) => setFormData(prev => ({ ...prev, supplierInvoice: e.target.value }))}
          />
        </FormField>
        
        <FormField
          label="Número de Camión"
        >
          <Input
            value={formData.truckNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, truckNumber: e.target.value }))}
          />
        </FormField>
        
        <FormField
          label="Nombre del Conductor"
        >
          <Input
            value={formData.driverName}
            onChange={(e) => setFormData(prev => ({ ...prev, driverName: e.target.value }))}
          />
        </FormField>
      </div>
      
      <FormField
        label="Notas"
      >
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          rows={3}
        />
      </FormField>
      
      <FormField
        label="Documentos de Evidencia"
      >
        <FileUpload
          onFileSelect={handleFileUpload}
          acceptedTypes={['image/*', 'application/pdf']}
          multiple
          uploading={uploading}
        />
        {formData.documents.length > 0 && (
          <div className="mt-2 space-y-2">
            {formData.documents.map((url, index) => (
              <DocumentPreview key={index} url={url} />
            ))}
          </div>
        )}
      </FormField>
      
      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline">
          Cancelar
        </Button>
        <Button type="submit" disabled={uploading}>
          {uploading ? 'Guardando...' : 'Guardar Entrada'}
        </Button>
      </div>
    </form>
  )
}
```

### 3.4 Material Adjustment Form
```typescript
// src/components/inventory/MaterialAdjustmentForm.tsx
export default function MaterialAdjustmentForm({ 
  date, 
  onSubmit, 
  initialData 
}: MaterialAdjustmentFormProps) {
  const [formData, setFormData] = useState<MaterialAdjustmentFormData>({
    materialId: '',
    adjustmentType: 'consumption',
    quantity: 0,
    referenceType: '',
    referenceNotes: '',
    documents: []
  })
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Material"
          required
        >
          <MaterialSelect
            value={formData.materialId}
            onChange={(value) => setFormData(prev => ({ ...prev, materialId: value }))}
          />
        </FormField>
        
        <FormField
          label="Tipo de Ajuste"
          required
        >
          <Select
            value={formData.adjustmentType}
            onValueChange={(value) => setFormData(prev => ({ ...prev, adjustmentType: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consumption">Consumo Manual</SelectItem>
              <SelectItem value="waste">Pérdida/Desecho</SelectItem>
              <SelectItem value="correction">Corrección</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="loss">Pérdida por Evento</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        
        <FormField
          label="Cantidad Ajustada"
          required
        >
          <Input
            type="number"
            step="0.01"
            value={formData.quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) }))}
          />
        </FormField>
        
        <FormField
          label="Tipo de Referencia"
        >
          <Input
            value={formData.referenceType}
            onChange={(e) => setFormData(prev => ({ ...prev, referenceType: e.target.value }))}
            placeholder="Mantenimiento, Limpieza, etc."
          />
        </FormField>
      </div>
      
      <FormField
        label="Notas de Referencia"
      >
        <Textarea
          value={formData.referenceNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, referenceNotes: e.target.value }))}
          rows={3}
        />
      </FormField>
      
      <FormField
        label="Documentos de Evidencia"
      >
        <FileUpload
          onFileSelect={handleFileUpload}
          acceptedTypes={['image/*', 'application/pdf']}
          multiple
        />
      </FormField>
      
      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline">
          Cancelar
        </Button>
        <Button type="submit">
          Guardar Ajuste
        </Button>
      </div>
    </form>
  )
}
```

---

## Phase 4: Arkik Integration Enhancement

### 4.1 Enhanced Arkik Upload Interface
```typescript
// src/components/inventory/ArkikUploadInterface.tsx
export default function ArkikUploadInterface() {
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<ArkikProcessingResult | null>(null)
  
  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('arkik_file', file)
      
      const response = await fetch('/api/inventory/arkik-upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) throw new Error('Error en la carga')
      
      const result = await response.json()
      setResults(result)
    } catch (error) {
      toast.error('Error al procesar archivo Arkik')
    } finally {
      setUploading(false)
    }
  }
  
  const handleProcessArkik = async () => {
    if (!results?.fileId) return
    
    setProcessing(true)
    try {
      const response = await fetch(`/api/inventory/arkik-upload/${results.fileId}/process`, {
        method: 'POST'
      })
      
      if (!response.ok) throw new Error('Error en el procesamiento')
      
      toast.success('Archivo Arkik procesado exitosamente')
      // Refresh inventory data
    } catch (error) {
      toast.error('Error al procesar datos Arkik')
    } finally {
      setProcessing(false)
    }
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Carga de Archivo Arkik
      </h2>
      
      <div className="space-y-6">
        <FileUpload
          onFileSelect={handleFileUpload}
          acceptedTypes={['.csv', '.xlsx', '.xls']}
          uploading={uploading}
          label="Seleccionar archivo Arkik"
        />
        
        {results && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-3">
              Resumen del Archivo
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Registros:</span> {results.totalRecords}
              </div>
              <div>
                <span className="font-medium">Fecha:</span> {results.date}
              </div>
              <div>
                <span className="font-medium">Planta:</span> {results.plant}
              </div>
              <div>
                <span className="font-medium">Estado:</span> {results.status}
              </div>
            </div>
            
            <div className="mt-4">
              <Button
                onClick={handleProcessArkik}
                disabled={processing}
                className="w-full"
              >
                {processing ? 'Procesando...' : 'Procesar Datos Arkik'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Phase 5: Navigation & Routing Updates

### 5.1 New Route Structure
```typescript
// src/app/inventory/layout.tsx
export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <InventorySidebar />
      <main className="lg:pl-72">
        <InventoryHeader />
        {children}
      </main>
    </div>
  )
}
```

### 5.2 Route Configuration
```typescript
// src/app/inventory/page.tsx - Main dashboard
// src/app/inventory/entries/page.tsx - Material entries
// src/app/inventory/adjustments/page.tsx - Material adjustments  
// src/app/inventory/arkik-upload/page.tsx - Arkik upload
// src/app/inventory/daily-log/page.tsx - Daily log view
// src/app/inventory/reports/page.tsx - Inventory reports
```

---

## Phase 6: Testing & Quality Assurance

### 6.1 Database Testing
- Test all triggers and functions with sample data
- Verify inventory calculations accuracy
- Test RLS policies and security
- Performance testing with large datasets

### 6.2 Frontend Testing
- Component unit tests
- Integration tests for forms
- E2E tests for complete workflows
- Accessibility testing

### 6.3 User Acceptance Testing
- Dosificador role testing
- Plant manager review process
- Document upload functionality
- Daily log closure workflow

---

## Phase 7: Deployment & Training

### 7.1 Database Migration
```bash
# Run migrations in order
supabase db push
# Verify all tables and functions created
supabase db diff
```

### 7.2 Frontend Deployment
```bash
# Build and deploy
npm run build
npm run deploy
```

### 7.3 User Training
- Create user manual for dosificadores
- Training sessions for plant managers
- Documentation for inventory procedures
- Troubleshooting guide

---

## Implementation Timeline

- **Week 1-2**: Database schema and triggers
- **Week 3-4**: Backend API development
- **Week 5-6**: Frontend components and forms
- **Week 7**: Arkik integration enhancement
- **Week 8**: Testing and bug fixes
- **Week 9**: User training and deployment
- **Week 10**: Monitoring and optimization

---

## Success Metrics

- ✅ Daily inventory accuracy within 1%
- ✅ Document upload success rate >95%
- ✅ User adoption rate >80%
- ✅ Inventory reconciliation time reduced by 70%
- ✅ Real-time stock level visibility
- ✅ Complete audit trail for all movements

This implementation provides a comprehensive, user-friendly inventory management system that integrates seamlessly with existing infrastructure while following modern development best practices.
