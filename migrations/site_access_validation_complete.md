# Site Access Validation - Database Migration Complete

## Migration Applied: `add_site_access_validation_tables`
**Date:** 2025-01-10  
**Project ID:** pkjqznogflgbnwzkzmpg

## Changes Applied

### 1. Column Added to `orders` Table
```sql
ALTER TABLE public.orders 
ADD COLUMN site_access_rating TEXT 
CHECK (site_access_rating IN ('green','yellow','red'));
```

**Status:** ✅ EXISTS

### 2. New Table: `order_site_validations`
```sql
CREATE TABLE public.order_site_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  road_type TEXT CHECK (road_type IN ('paved','gravel_good','gravel_rough')),
  road_slope TEXT CHECK (road_slope IN ('none','moderate','steep')),
  recent_weather_impact TEXT CHECK (recent_weather_impact IN ('dry','light_rain','heavy_rain')),
  route_incident_history TEXT CHECK (route_incident_history IN ('none','minor','major')),
  validation_notes TEXT,
  evidence_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX idx_order_site_validations_order_id 
ON public.order_site_validations(order_id);
```

**Status:** ✅ EXISTS with correct schema

### 3. New Table: `delivery_feedback`
```sql
CREATE TABLE public.delivery_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  access_rating_accurate BOOLEAN,
  actual_conditions TEXT CHECK (actual_conditions IN ('better','as_expected','worse')),
  encountered_issues TEXT[],
  operator_notes TEXT,
  feedback_photo_urls TEXT[] DEFAULT '{}',
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_feedback_order_id 
ON public.delivery_feedback(order_id);

CREATE INDEX idx_delivery_feedback_submitted_at 
ON public.delivery_feedback(submitted_at);
```

**Status:** ✅ EXISTS with correct schema

### 4. Supabase Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'site-validation-evidence', 
  'site-validation-evidence', 
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png']
);
```

**Status:** ✅ EXISTS

### 5. Storage RLS Policies
```sql
CREATE POLICY "site_validation_insert_policy" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'site-validation-evidence');

CREATE POLICY "site_validation_select_policy" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'site-validation-evidence');

CREATE POLICY "site_validation_delete_policy" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'site-validation-evidence');
```

**Status:** ✅ 3 policies created

## Frontend Implementation Status

### Files Modified/Created:
1. ✅ `src/services/orderService.ts` - Added `site_access_rating` and `site_validation` support
2. ✅ `src/components/common/PhotoUploadComponent.tsx` - New photo uploader with Supabase Storage
3. ✅ `src/components/orders/SiteAccessValidation.tsx` - Traffic light UI with conditional forms
4. ✅ `src/components/orders/ScheduleOrderForm.tsx` - Integrated validation step before date/time

### Workflow:
1. User selects client → construction site
2. **NEW:** User selects site access rating (Green/Yellow/Red)
   - Green: No additional validation required
   - Yellow: Full checklist + 2-3 photos required
   - Red: Simplified (auto-filled road_type) + 2-3 photos required
3. User enters delivery coordinates and date/time
4. User selects products and submits

### Data Flow:
- **Green orders:** Only `site_access_rating='green'` saved in orders table
- **Yellow/Red orders:** 
  - `site_access_rating` saved in orders table
  - Full validation details + photo URLs saved in `order_site_validations` table
  - Photos uploaded to `site-validation-evidence` bucket

## Testing Checklist

- [x] Database migration applied successfully
- [x] Storage bucket created
- [x] Storage policies created
- [ ] Test Green order creation (no validation record)
- [ ] Test Yellow order creation (with full validation record)
- [ ] Test Red order creation (with simplified validation record)
- [ ] Test photo upload to storage bucket
- [ ] Verify validation data retrieval
- [ ] Test form validation prevents submission with missing data
- [ ] Test order summary displays rating and photo count

## Next Steps

1. Test the full order creation flow in the UI
2. Verify photos upload correctly to storage
3. Verify validation records are created for Yellow/Red orders
4. Implement delivery feedback form (Phase 2)
5. Add nearby delivery history query (Optional enhancement)

## Migration Rollback (if needed)

```sql
-- Remove tables
DROP TABLE IF EXISTS public.delivery_feedback CASCADE;
DROP TABLE IF EXISTS public.order_site_validations CASCADE;

-- Remove column
ALTER TABLE public.orders DROP COLUMN IF EXISTS site_access_rating;

-- Remove storage policies
DROP POLICY IF EXISTS "site_validation_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "site_validation_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "site_validation_delete_policy" ON storage.objects;

-- Remove bucket
DELETE FROM storage.buckets WHERE id = 'site-validation-evidence';
```

