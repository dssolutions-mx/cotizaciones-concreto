# Site Access Validation - Implementation Plan (REVISED)

## Overview
Add order-level site access validation to prevent concrete mixer losses due to poor site access conditions. Uses traffic light system (Green/Yellow/Red) with conditional checklists and photo evidence.

**KEY CHANGES:**
- Separate table for validation details to manage data volume
- Mandatory photo evidence (2-3 photos) for Yellow/Red orders
- Red rating = Fixed definition (gravel + moderate slope)
- Support for operator feedback after delivery

---

## Database Changes

### 1. Minimal changes to `orders` table
```sql
-- Only store the rating itself in orders table
ALTER TABLE orders ADD COLUMN site_access_rating TEXT CHECK (site_access_rating IN ('green', 'yellow', 'red'));
```

### 2. NEW TABLE: `order_site_validations`
```sql
CREATE TABLE order_site_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Validation details (Yellow/Red only)
  road_type TEXT CHECK (road_type IN ('paved', 'gravel_good', 'gravel_rough')),
  road_slope TEXT CHECK (road_slope IN ('none', 'moderate', 'steep')),
  recent_weather_impact TEXT CHECK (recent_weather_impact IN ('dry', 'light_rain', 'heavy_rain')),
  route_incident_history TEXT CHECK (route_incident_history IN ('none', 'minor', 'major')),
  
  -- Evidence and notes
  validation_notes TEXT,
  evidence_photo_urls TEXT[] NOT NULL DEFAULT '{}', -- Array of Supabase Storage URLs
  
  -- Audit fields
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one validation per order
  UNIQUE(order_id)
);

-- Index for quick lookup
CREATE INDEX idx_order_site_validations_order_id ON order_site_validations(order_id);
```

### 3. NEW TABLE: `delivery_feedback`
```sql
CREATE TABLE delivery_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Operator assessment
  access_rating_accurate BOOLEAN, -- Was the pre-delivery rating correct?
  actual_conditions TEXT CHECK (actual_conditions IN ('better', 'as_expected', 'worse')),
  encountered_issues TEXT[], -- Array: ['mud', 'narrow_access', 'steep_grade', 'soft_ground', 'obstacles']
  
  -- Operator notes and evidence
  operator_notes TEXT,
  feedback_photo_urls TEXT[] DEFAULT '{}', -- Photos from actual delivery
  
  -- Audit fields
  submitted_by UUID REFERENCES auth.users(id), -- Driver/operator
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for reporting and analysis
CREATE INDEX idx_delivery_feedback_order_id ON delivery_feedback(order_id);
CREATE INDEX idx_delivery_feedback_submitted_at ON delivery_feedback(submitted_at);
```

### 4. Supabase Storage Bucket
```sql
-- Create storage bucket for site validation photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('site-validation-evidence', 'site-validation-evidence', false);

-- RLS policies for storage (authenticated users can upload/view)
CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'site-validation-evidence');

CREATE POLICY "Authenticated users can view evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'site-validation-evidence');
```

**Note:** `delivery_latitude`, `delivery_longitude`, and `delivery_google_maps_url` already exist in orders table.

---

## UI Integration

### Location: `src/components/orders/ScheduleOrderForm.tsx`

**Add new step between location entry and date/time selection:**

1. User enters Google Maps URL (existing step)
2. **NEW: Site Access Validation step** ← Insert here
3. User selects delivery date/time (existing step)
4. User selects products (existing step)
5. Submit order (existing step)

### Validation Component Requirements

**Step 1: Traffic Light Selection**
- Three buttons: Green, Yellow, Red
- Visual: color-coded with icons

**Rating Definitions:**
- **Green:** Paved access, no slope concerns → No additional questions, proceed directly
- **Yellow:** Mixed conditions requiring assessment → Show checklist + require photos
- **Red:** Gravel with moderate/steep slope (FIXED DEFINITION) → Require photos + weather check

**Step 2: Conditional Validation (Yellow/Red only)**

**For YELLOW orders:**
Required fields:
- Road Type (paved, gravel_good, gravel_rough)
- Road Slope (none, moderate, steep)
- Recent Weather (dry, light_rain, heavy_rain)
- Incident History (none, minor, major)
- **2-3 Evidence Photos** (showing access path + turnaround space)
- Validation Notes (optional textarea)

**For RED orders:**
System auto-fills:
- Road Type: `gravel_rough` (fixed)
- Road Slope: `moderate` or `steep` (agent selects which)

Agent must provide:
- Recent Weather (dry, light_rain, heavy_rain) - **CRITICAL for red**
- Incident History (none, minor, major)
- **2-3 Evidence Photos** (showing access path + turnaround space)
- Validation Notes (optional textarea)

**Photo Requirements (Yellow/Red):**
- Minimum 2 photos, maximum 3 photos
- Must show: (1) access road/path, (2) delivery point with turnaround space
- Optional 3rd photo: any obstacles or narrow sections
- Max file size: 5MB per photo
- Accepted formats: JPEG, PNG

**Form Submission:**
- Green: Create order record only (no validation table entry)
- Yellow/Red: Create order record + validation record with photo URLs

---

## Optional Enhancement: Historical Context

**Feature:** Show nearby previous deliveries when user enters coordinates.

### Query Logic
```sql
-- Find orders within 150m radius of current coordinates
SELECT 
  site_access_rating,
  road_type,
  recent_weather_impact,
  delivery_date,
  access_validation_notes
FROM orders
WHERE 
  delivery_latitude IS NOT NULL 
  AND delivery_longitude IS NOT NULL
  AND ST_DWithin(
    ST_MakePoint(delivery_longitude, delivery_latitude)::geography,
    ST_MakePoint($current_lng, $current_lat)::geography,
    150  -- radius in meters
  )
  AND site_access_rating IS NOT NULL
ORDER BY delivery_date DESC
LIMIT 5;
```

**Requires:** PostGIS extension (check if already enabled in Supabase)

**Display:** Show as info panel above validation form:
> "📍 3 nearby deliveries found within 150m:
> - 2 rated GREEN (most recent: 15 days ago)
> - 1 rated YELLOW (gravel, 45 days ago)
> - No reported incidents"

---

## Workflow Summary

```
User fills order form
  ↓
Enters delivery location (Google Maps URL)
  ↓
[NEW] Selects access rating (Green/Yellow/Red)
  ↓
If Yellow/Red → Complete checklist
  ↓
System validates required fields
  ↓
Order created with validation data
```

---

## Validation Rules Summary

| Rating | Orders Table | Validation Table Required? | Photo Evidence | Checklist Fields |
|--------|--------------|---------------------------|----------------|------------------|
| GREEN  | `site_access_rating` = 'green' | ❌ No | ❌ No photos | None |
| YELLOW | `site_access_rating` = 'yellow' | ✅ Yes | ✅ 2-3 photos required | All fields (road_type, road_slope, weather, history) |
| RED    | `site_access_rating` = 'red' | ✅ Yes | ✅ 2-3 photos required | Auto-filled: road_type='gravel_rough'<br>Agent fills: road_slope, weather, history |

---

## Data Flow

**Creating GREEN order:**
```
1. Agent selects Green rating
2. System creates order record with site_access_rating='green'
3. No validation table entry needed
4. Proceed to date/time selection
```

**Creating YELLOW order:**
```
1. Agent selects Yellow rating
2. Agent completes checklist (all fields)
3. Agent uploads 2-3 photos → Supabase Storage
4. System creates:
   - orders record with site_access_rating='yellow'
   - order_site_validations record with checklist + photo URLs
5. Proceed to date/time selection
```

**Creating RED order:**
```
1. Agent selects Red rating
2. System auto-fills: road_type='gravel_rough', road_slope (agent selects moderate/steep)
3. Agent fills: weather (CRITICAL), incident history
4. Agent uploads 2-3 photos → Supabase Storage
5. System creates:
   - orders record with site_access_rating='red'
   - order_site_validations record with data + photo URLs
6. Proceed to date/time selection (consider approval step - see questions below)
```

**After Delivery (Operator Feedback):**
```
1. Operator completes delivery
2. Operator submits feedback form:
   - Was rating accurate?
   - Actual vs expected conditions
   - Any issues encountered
   - Optional photos
3. System creates delivery_feedback record
4. Data used for future risk assessment and agent training
```

---

## UI Component Reference

The original `SiteAccessValidation.jsx` provides the foundation, but requires these modifications:

**Required Changes:**
1. ✅ Remove road type options for Red (auto-fill as 'gravel_rough')
2. ✅ Add photo upload component (2-3 photos for Yellow/Red)
3. ✅ Add road slope selector for Red (only moderate/steep options)
4. ✅ Mark weather as CRITICAL for Red rating
5. ✅ Add photo preview thumbnails
6. ✅ Implement upload progress indicators

**New Component Needed:**
- `PhotoUploadComponent.tsx` - Handles Supabase Storage upload with preview

**Key features to implement:**
- ✅ Traffic light button selection
- ✅ Conditional checklist display (Yellow = full, Red = simplified)
- ✅ Photo upload with 2-3 image limit
- ✅ Form validation
- ✅ Visual feedback (colors, icons)
- ✅ Error handling
- ✅ Success confirmation with photo thumbnails

**To integrate:**
1. Build PhotoUploadComponent first
2. Modify SiteAccessValidation to use simplified Red logic
3. Import into ScheduleOrderForm
4. Add as new step in form wizard after location entry
5. Wire up multi-table submission (orders + order_site_validations)

---

## Simplified Validation Flow

```
┌─────────────────────────────────────────────────────────┐
│  Agent Selects Access Rating                            │
└─────────────────────────────────────────────────────────┘
                          ↓
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
      [ GREEN ]       [ YELLOW ]       [ RED ]
          ↓               ↓               ↓
    No questions    Full Checklist   Simplified
          ↓               ↓               ↓
          │         ┌─────────────┐  ┌──────────────┐
          │         │ Road Type   │  │ Road Type:   │
          │         │ Road Slope  │  │ gravel_rough │
          │         │ Weather     │  │ (auto-fill)  │
          │         │ History     │  └──────────────┘
          │         └─────────────┘        ↓
          │               ↓           ┌──────────────┐
          │         ┌─────────────┐  │ Road Slope:  │
          │         │ Upload      │  │ moderate OR  │
          │         │ 2-3 Photos  │  │ steep ONLY   │
          │         └─────────────┘  └──────────────┘
          │               ↓                 ↓
          │               ↓           ┌──────────────┐
          │               ↓           │ Weather:     │
          │               ↓           │ REQUIRED ⚠️  │
          │               ↓           └──────────────┘
          │               ↓                 ↓
          │               ↓           ┌──────────────┐
          │               ↓           │ History      │
          │               ↓           └──────────────┘
          │               ↓                 ↓
          │               ↓           ┌──────────────┐
          │               ↓           │ Upload       │
          │               ↓           │ 2-3 Photos   │
          │               ↓           └──────────────┘
          ↓               ↓                 ↓
    ┌──────────────────────────────────────────┐
    │  Create Order + Validation Record        │
    └──────────────────────────────────────────┘
```

---

## Testing Checklist

**Database & Storage:**
- [ ] All tables created successfully
- [ ] Storage bucket created with correct permissions
- [ ] RLS policies allow authenticated uploads
- [ ] Foreign key constraints work correctly
- [ ] Cascade deletes work (delete order → deletes validation record)

**Photo Upload:**
- [ ] Photos upload to Supabase Storage successfully
- [ ] File size validation (max 5MB) works
- [ ] Format validation (JPEG/PNG only) works
- [ ] 2-3 photo limit enforced
- [ ] Upload progress indicator works
- [ ] Photo preview shows uploaded images
- [ ] Failed uploads show error messages

**Green Rating Path:**
- [ ] Orders created without validation table entry
- [ ] No photos required
- [ ] Form proceeds directly to next step

**Yellow Rating Path:**
- [ ] Checklist fields required and enforced
- [ ] 2-3 photos required and enforced
- [ ] Validation record created in separate table
- [ ] Photo URLs correctly stored in validation record
- [ ] All fields saved correctly

**Red Rating Path:**
- [ ] Road type auto-filled as 'gravel_rough'
- [ ] Road slope selector shows only moderate/steep
- [ ] Weather field marked as CRITICAL and required
- [ ] 2-3 photos required and enforced
- [ ] Validation record created with correct data
- [ ] Photo URLs correctly stored

**General:**
- [ ] Form state persists if user goes back to previous step (but photos remain uploaded)
- [ ] Validation prevents submission with incomplete data
- [ ] Success confirmation shows correct rating summary
- [ ] Created orders viewable with validation data
- [ ] Photo URLs accessible and images load correctly

**Performance:**
- [ ] Multiple photo uploads don't block UI
- [ ] Large photos (near 5MB) upload without timeout
- [ ] Form submission completes within 3 seconds
- [ ] Order list loads quickly (validation data joined efficiently)

**Edge Cases:**
- [ ] Network failure during photo upload handled gracefully
- [ ] Duplicate photo upload prevented
- [ ] Order creation fails but photos already uploaded (cleanup handling)
- [ ] User closes browser during upload (orphaned photos handled)

---

## API Changes

### 1. Photo Upload Endpoint

**`POST /api/upload/site-validation-evidence`**

Upload photos to Supabase Storage before order creation.

**Request:** multipart/form-data with 2-3 image files

**Response:**
```json
{
  "urls": [
    "site-validation-evidence/abc123.jpg",
    "site-validation-evidence/def456.jpg"
  ]
}
```

**Implementation:**
```typescript
// Upload to Supabase Storage bucket
const { data, error } = await supabase.storage
  .from('site-validation-evidence')
  .upload(`${orderId}-${timestamp}-${index}.jpg`, file);

// Return public URL or signed URL
```

### 2. Order Creation Endpoint

**`POST /api/orders`**

**Request body for GREEN:**
```typescript
{
  // ... existing order fields
  site_access_rating: 'green'
  // No validation record needed
}
```

**Request body for YELLOW:**
```typescript
{
  // ... existing order fields
  site_access_rating: 'yellow',
  site_validation: {
    road_type: 'gravel_good',
    road_slope: 'moderate',
    recent_weather_impact: 'dry',
    route_incident_history: 'none',
    validation_notes: 'Access via north entrance',
    evidence_photo_urls: [
      'site-validation-evidence/abc123.jpg',
      'site-validation-evidence/def456.jpg'
    ]
  }
}
```

**Request body for RED:**
```typescript
{
  // ... existing order fields
  site_access_rating: 'red',
  site_validation: {
    road_type: 'gravel_rough', // Auto-filled
    road_slope: 'steep', // Agent selects moderate or steep
    recent_weather_impact: 'light_rain', // REQUIRED
    route_incident_history: 'minor',
    validation_notes: 'Recent rain, use 4x4 escort',
    evidence_photo_urls: [
      'site-validation-evidence/abc123.jpg',
      'site-validation-evidence/def456.jpg',
      'site-validation-evidence/ghi789.jpg'
    ]
  }
}
```

**Backend Logic:**
```typescript
// 1. Create order record
const order = await createOrder({ ...orderData, site_access_rating });

// 2. If Yellow/Red, create validation record
if (site_access_rating !== 'green') {
  await supabase
    .from('order_site_validations')
    .insert({
      order_id: order.id,
      ...site_validation,
      validated_by: currentUser.id,
      validated_at: new Date()
    });
}
```

### 3. Operator Feedback Endpoint (Future)

**`POST /api/delivery-feedback`**

**Request body:**
```typescript
{
  order_id: 'uuid',
  access_rating_accurate: true,
  actual_conditions: 'as_expected',
  encountered_issues: ['narrow_access'],
  operator_notes: 'Tight turn at entrance, but manageable',
  feedback_photo_urls: ['site-validation-evidence/post-xyz.jpg']
}
```

---

## Rollout Plan

**Phase 1: Database & Storage Setup** (1 day)
- Create migration for new tables
- Set up Supabase Storage bucket
- Configure RLS policies
- Test data insertion/retrieval

**Phase 2: Photo Upload Component** (1-2 days)
- Build reusable photo upload component
- Implement Supabase Storage integration
- Add image preview and validation
- Test upload flow

**Phase 3: Validation UI Component** (2-3 days)
- Build traffic light selector
- Build conditional checklist for Yellow/Red
- Integrate photo upload component
- Add form validation logic
- Build operator feedback form (optional for v1)

**Phase 4: ScheduleOrderForm Integration** (1-2 days)
- Add validation step to form wizard
- Wire up state management
- Implement multi-table order creation
- Handle photo URL persistence

**Phase 5: Testing & Refinement** (3-5 days)
- End-to-end testing with real photos
- Test all three rating paths (Green/Yellow/Red)
- Validate data storage and retrieval
- Performance testing with image uploads

**Phase 6: Pilot Rollout** (1 week)
- Deploy to 2-3 sales agents
- Monitor photo upload performance
- Collect feedback on workflow
- Measure validation completion rates

**Phase 7: Full Rollout** (1 week)
- Training for all sales agents (include photo guidelines)
- Deploy to production
- Monitor adoption and issues

**Total estimated time:** 2-3 sprints

---

## Questions for Product Team

1. **RED Rating Approval:** Should RED orders require manager approval before submission? Or just proceed with documented warning?

2. **Photo Storage Cost:** With 2-3 photos per Yellow/Red order, estimate ~50-150KB per photo. If 30% of orders are Yellow/Red and you create 1000 orders/month, that's ~90MB-450MB/month. Acceptable?

3. **Photo Retention:** How long should validation photos be kept? Archive after 1 year? Delete after 2 years?

4. **Operator Feedback:** Should driver feedback be implemented in v1 or deferred to v2? (Affects rollout timeline)

5. **Nearby Deliveries Context:** Still useful with photo evidence? Or is that information sufficient on its own?

6. **Mobile Upload:** Sales agents creating orders from mobile devices - does photo upload need to work on mobile browsers or just desktop?

7. **Photo Guidelines:** Who creates the training material showing what constitutes good evidence photos?

---

---

## Why Separate Tables? (Addressing Data Volume Concerns)

Your concern about keeping all validation data in the orders table is **100% valid**. Here's why the multi-table approach is essential:

### Data Volume Over Time

**Scenario:** 1,000 orders/month over 2 years
- Orders table: 24,000 rows
- With inline validation data: Each row contains checklist fields + photo URLs
- With separate tables: 
  - Orders: 24,000 rows (lean)
  - Validations: ~7,200 rows (only Yellow/Red)
  - Delivery feedback: Grows independently

### Query Performance

**Problem with inline approach:**
```sql
-- Every order query pulls validation data even when not needed
SELECT * FROM orders WHERE order_date > '2025-01-01';
-- Returns all validation fields for all orders (bloat)
```

**Solution with separate tables:**
```sql
-- Fast: Only get order essentials
SELECT id, order_number, client_id, delivery_date, site_access_rating 
FROM orders 
WHERE order_date > '2025-01-01';

-- Detailed: Join only when needed
SELECT o.*, v.validation_notes, v.evidence_photo_urls
FROM orders o
LEFT JOIN order_site_validations v ON o.id = v.order_id
WHERE o.site_access_rating IN ('yellow', 'red');
```

### Data Lifecycle Management

**Archival:** After 1-2 years, you may want to archive old orders but keep validation data for analysis:
- Archive old orders → Keep validation records for trend analysis
- Analyze incident patterns → Don't need full order details

**Feedback accumulation:** Operators might submit multiple feedback entries per problematic order:
- Order 123 → 3 feedback records (initial delivery, followup, resolution)
- Keeps order table clean while tracking full incident history

### Storage Costs

**Photo storage in orders table (inline JSONB):**
- Each order row grows with photo URLs
- Database bloat affects ALL queries
- Difficult to implement photo retention policies

**Photo storage in separate table:**
- Orders table stays constant size
- Can implement photo archival independently
- Easy to calculate storage costs separately

### Real-World Example

After 2 years with inline approach:
- Orders table: 200MB (bloated with validation data)
- Every query scans validation fields even for Green orders

After 2 years with separate tables:
- Orders table: 50MB (just essential order data)
- Validations table: 30MB (7,200 Yellow/Red validations)
- Feedback table: 20MB (operator reports)
- **Total same**, but queries 4x faster because orders table is lean

### Recommendation

✅ **Use separate tables** - It adds minimal complexity now but saves significant performance and maintenance issues later as your data grows.

---

## Data Architecture Benefits

✅ **Scalability:** Validation details and photos separated from orders table
✅ **Performance:** Orders table stays lean for fast queries
✅ **Archival:** Can archive old validation records independently
✅ **Analytics:** Dedicated feedback table enables trend analysis
✅ **Flexibility:** Can add new validation fields without altering orders table

## Storage Estimate

**Assumptions:**
- 1,000 orders/month
- 30% require validation (Yellow/Red) = 300 orders
- 2.5 photos average per validation = 750 photos/month
- 100KB average per photo = 75MB/month = ~900MB/year

**Supabase Free Tier:** 1GB storage (upgrade to Pro for $25/mo = 100GB)

---

## Supabase Project ID
`pkjqznogflgbnwzkzmpg`

Use this for all database operations and testing.
