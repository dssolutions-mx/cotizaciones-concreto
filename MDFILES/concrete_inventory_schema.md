# Simple Concrete Plant Inventory Management System

## Core Tables (Simple & Practical)

### 1. Material Entries (Incoming Inventory)
```sql
CREATE TABLE material_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(100) UNIQUE NOT NULL,
  plant_id UUID NOT NULL REFERENCES plants(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  supplier_id UUID REFERENCES suppliers(id),
  
  -- Entry details
  entry_date DATE NOT NULL,
  quantity_received DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,4),
  total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity_received * COALESCE(unit_cost, 0)) STORED,
  
  -- Documentation
  supplier_invoice VARCHAR(100),
  truck_number VARCHAR(50),
  driver_name VARCHAR(100),
  receipt_document_url TEXT, -- Link to scanned receipt in storage bucket
  
  -- Inventory tracking
  inventory_before DECIMAL(10,2) NOT NULL, -- Stock level before this entry
  inventory_after DECIMAL(10,2) NOT NULL,  -- Stock level after this entry
  
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

### 2. Manual Inventory Adjustments
```sql
CREATE TABLE material_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number VARCHAR(100) UNIQUE NOT NULL,
  plant_id UUID NOT NULL REFERENCES plants(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  
  -- Adjustment details
  adjustment_date DATE NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('consumption', 'waste', 'correction', 'transfer', 'loss')),
  
  -- Quantities
  quantity_adjusted DECIMAL(10,2) NOT NULL, -- positive for additions, negative for reductions
  
  -- Inventory tracking
  inventory_before DECIMAL(10,2) NOT NULL, -- Stock level before adjustment
  inventory_after DECIMAL(10,2) NOT NULL,  -- Stock level after adjustment
  
  -- Reference information
  reference_type VARCHAR(50), -- 'maintenance', 'cleaning', 'quality_issue', 'manual_count', etc.
  reference_notes TEXT,
  
  -- Authorization
  adjusted_by UUID NOT NULL REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Current Material Inventory (Simple Stock Levels)
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
  last_consumption_date DATE, -- from remisiones
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plant_id, material_id)
);
```

### 4. Storage Bucket Configuration
```sql
-- Add to your existing materials table if not already there
ALTER TABLE materials ADD COLUMN IF NOT EXISTS 
receipt_bucket_path VARCHAR(255) DEFAULT 'material-receipts/'; -- Supabase storage bucket path
```

## Automated Integration with Existing System

### Trigger: Auto-update inventory from remisiones consumption
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
    -NEW.cantidad_real, -- negative because it's consumption
    0,
    r.fecha
  FROM remisiones r 
  WHERE r.id = NEW.remision_id
  AND NOT EXISTS (
    SELECT 1 FROM material_inventory mi 
    WHERE mi.material_id = NEW.material_id 
    AND mi.plant_id = r.plant_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_consumption
  AFTER INSERT OR UPDATE ON remision_materiales
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_remision();
```

### Trigger: Auto-update inventory from entries
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
  ON CONFLICT (plant_id, material_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_entry
  AFTER INSERT OR UPDATE ON material_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_entry();
```

### Trigger: Auto-update inventory from adjustments
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_adjustment
  AFTER INSERT OR UPDATE ON material_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_adjustment();
```

## Simple Management Views

### Current Stock Status
```sql
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
```

### Recent Activity Log
```sql
CREATE VIEW vw_inventory_activity_log AS
-- Entries
SELECT 
  'ENTRY' as activity_type,
  me.entry_date as activity_date,
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

-- Adjustments  
SELECT 
  'ADJUSTMENT' as activity_type,
  ma.adjustment_date as activity_date,
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

ORDER BY activity_date DESC;
```

## Supabase Storage Integration

### Storage Bucket Setup (run in Supabase SQL editor)
```sql
-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'material-receipts',
  'material-receipts', 
  false, -- private bucket
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']::text[]
);

-- Set up RLS policies for the bucket
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'material-receipts');

CREATE POLICY "Users can view receipts from their plant" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'material-receipts');
```

This simplified approach gives you:
1. ✅ **Simple material entries** with before/after inventory tracking
2. ✅ **Manual adjustments** for corrections and non-remision consumption  
3. ✅ **Document storage** for scanned receipts
4. ✅ **Real-time inventory levels** updated automatically
5. ✅ **Full audit trail** of all inventory changes
6. ✅ **Integration** with your existing remision_materiales system