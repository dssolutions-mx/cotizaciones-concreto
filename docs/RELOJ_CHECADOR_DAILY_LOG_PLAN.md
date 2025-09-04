### Daily Log - Reloj Checador (Upload-Only) Plan

Objective: Enable users to upload the daily "reloj checador" file, record upload timestamp (and optional selected date), store securely, and view/download files with dynamically generated signed URLs. No parsing/analysis yet.

---

## Scope (Phase 1 - Upload Only)
- Upload a file (CSV/PDF/Image) related to daily attendance.
- Save metadata: uploader, upload time (server), optional user-selected date, plant context (if applicable).
- Store files in a private Supabase Storage bucket with RLS.
- Provide list and view actions with dynamically created signed URLs (no public links, no expirations stored).

Out of scope: Any data extraction/validation/processing from the uploaded file.

---

## Storage Strategy (align with existing buckets and policies)

We will follow the same private storage and dynamic signed URL best practices used in:
- `remision-documents` flow: API-driven uploads and on-demand signed URL generation (`src/app/api/remisiones/documents/route.ts`).
- `inventory-documents` flow: similar API-driven upload/list and URL creation (`src/app/api/inventory/documents/route.ts`).
- Client-side signed URL caching pattern via `useSignedUrls` (`src/hooks/useSignedUrls.ts`).

### Bucket
- Name: `attendance-logs` (private)
- File types: CSV, PDF, images (JPEG/PNG)
- Max size: 10MB (same as inventory/remisiones documents)

### SQL for Bucket and Policies (run in Supabase SQL editor)
```sql
-- Create private bucket for attendance logs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attendance-logs',
  'attendance-logs',
  false,
  10485760, -- 10MB
  ARRAY['text/csv', 'application/pdf', 'image/jpeg', 'image/png']::text[]
);

-- RLS policies mirroring existing patterns (authenticated only)
CREATE POLICY "Authenticated users can upload attendance logs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attendance-logs');

CREATE POLICY "Authenticated users can view attendance logs" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'attendance-logs');

CREATE POLICY "Authenticated users can update attendance logs" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'attendance-logs');

CREATE POLICY "Authenticated users can delete attendance logs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'attendance-logs');
```

Note: If plant-level scoping is required later, we can extend policies to assert folder prefixes (e.g., path starting with `plant_id/`). For Phase 1, bucket-level policy is sufficient with application-level checks.

---

## Database Table (metadata)

Create a minimal table to list and audit uploads:

```sql
CREATE TABLE IF NOT EXISTS attendance_log_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NULL REFERENCES plants(id),
  upload_date DATE GENERATED ALWAYS AS (DATE_TRUNC('day', uploaded_at AT TIME ZONE 'UTC')) STORED,
  selected_date DATE NULL, -- optional date chosen by user when uploading
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES user_profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_log_uploads_selected_date ON attendance_log_uploads(selected_date);
CREATE INDEX IF NOT EXISTS idx_attendance_log_uploads_uploaded_at ON attendance_log_uploads(uploaded_at DESC);
```

Notes:
- `selected_date` is optional; requirement is to mark upload date/time. We store both server `uploaded_at` and optional `selected_date` for future reporting.
- `plant_id` can be populated from user profile context or an explicit selection in the UI.

---

## Listing Format (like Entradas system)

We will present a list mirroring the entradas format with clear metadata columns and actions.

- Columns:
  - Fecha de carga (date): derived from `uploaded_at` (local date)
  - Hora de carga (time): derived from `uploaded_at` (local time)
  - Subido por: user full name from `user_profiles` (e.g., `first_name || ' ' || last_name`)
  - Planta: `plants.name`
  - Archivo: `original_name` with size badge
  - Tipo: mime short label (CSV, PDF, JPG/PNG)
  - Acciones: Ver (signed URL), Descargar (signed URL), Eliminar (if allowed)

Optional view to simplify joins:
```sql
CREATE OR REPLACE VIEW v_attendance_log_uploads AS
SELECT a.id,
       a.selected_date,
       a.uploaded_at,
       a.file_name,
       a.original_name,
       a.file_path,
       a.file_size,
       a.mime_type,
       a.plant_id,
       p.name AS plant_name,
       a.uploaded_by,
       up.first_name || ' ' || up.last_name AS uploaded_by_name
FROM attendance_log_uploads a
LEFT JOIN plants p ON p.id = a.plant_id
JOIN user_profiles up ON up.id = a.uploaded_by;
```

UI behavior:
- Default sort by `uploaded_at DESC`.
- Filters: `selected_date`, `plant_id`, search by `original_name`.
- Pagination: page/limit with total count.
- View action uses dynamic signed URL with `useSignedUrls('attendance-logs')`.

---

## API Design (Next.js Route Handlers)

Route group: `src/app/api/attendance/logs/route.ts`

- POST: Upload one file via `multipart/form-data`.
  - Fields: `file`, optional `selected_date`, optional `plant_id`.
  - Server validates size/type, resolves current user, optionally checks plant access (reuse pattern from inventory/remisiones routes).
  - Filename pattern: `${plantId || 'general'}/daily_logs/${timestamp}_${random}.${ext}`.
  - Upload to `attendance-logs` with `cacheControl: '3600', upsert: false`.
  - Insert row into `attendance_log_uploads`.
  - Return minimal metadata (do NOT return long-lived URLs).

- GET: List uploads with optional filters.
  - Query params: `selected_date`, `plant_id`, `search`, `page`, `limit`.
  - Join `plants` and `user_profiles` (or query `v_attendance_log_uploads`) to return entradas-like rows.
  - Response shape:
    ```json
    {
      "data": [
        {
          "id": "...",
          "selected_date": "YYYY-MM-DD",
          "uploaded_at": "ISO",
          "uploaded_by": "uuid",
          "uploaded_by_name": "Nombre Apellido",
          "plant_id": "uuid",
          "plant_name": "Planta X",
          "original_name": "archivo.csv",
          "file_path": "plantId/daily_logs/...",
          "file_size": 12345,
          "mime_type": "text/csv"
        }
      ],
      "pagination": { "page": 1, "limit": 50, "total": 0, "totalPages": 0 }
    }
    ```
  - Do not return permanent URLs; either omit URL or attach short-lived signed URLs (1 hour) similar to remisiones GET.

- DELETE (optional): Remove an upload by id.
  - Deletes DB row then removes storage object.

Security/Access:
- Require authenticated user (as done in existing routes).
- Reuse plant access checks if we gate by plant.

References:
- Remisiones docs API: `src/app/api/remisiones/documents/route.ts` (upload, list, dynamic signed URLs)
- Inventory docs API: `src/app/api/inventory/documents/route.ts`

---

## Client UI

Location: `src/app/production-control/reloj-checador/page.tsx` (or `src/app/inventory/daily-log/` depending on navigation). Minimal form and entradas-style table:

- Form fields:
  - File input (accept: `.csv, .pdf, image/*`)
  - Optional date picker for `selected_date`
  - Optional plant selector (from `usePlantContext`) if needed
- Submit posts to `/api/attendance/logs` via `FormData`.
- Show upload success toast.
- Below form: entradas-style table with columns Fecha, Hora, Subido por, Planta, Archivo (nombre + tamaño), Tipo, Acciones (Ver/Descargar/Eliminar).
- View/Download buttons use `useSignedUrls('attendance-logs')` to generate on-demand signed URLs for `file_path` and open in new tab.

Patterns to copy:
- Evidence viewing in `PumpingServiceForm.tsx` using `useSignedUrls('remision-documents', 3600)` and `getCachedUrl`/`getSignedUrl`.
- Admin listing in `PumpingRemisionesAdmin.tsx` showing evidence count and dynamic view actions.

---

## Signed URLs (avoid expired static links)

- Do not store static signed URLs in DB.
- For listing endpoints (GET), either:
  1) Return only metadata with `file_path`, and the client generates signed URLs on click using `useSignedUrls('attendance-logs')` (preferred, reduces server cost), or
  2) Attach 1-hour signed URLs server-side for immediate rendering (as in remisiones GET). For Phase 1, Option 1 is preferred.

Client API:
```ts
const { getSignedUrl, isLoading, getCachedUrl } = useSignedUrls('attendance-logs', 3600);
// When user clicks View:
const cached = getCachedUrl(filePath);
const url = cached || await getSignedUrl(filePath);
window.open(url, '_blank', 'noopener,noreferrer');
```

---

## Validation & Limits
- Max file size: 10MB.
- Allowed types: `text/csv`, `application/pdf`, `image/jpeg`, `image/png`.
- Reject missing file; respond with clear error.
- Record `uploaded_at` from server clock.

---

## Minimal DX Checklist
- [ ] Create bucket `attendance-logs` and RLS policies.
- [ ] Create table `attendance_log_uploads`.
- [ ] Implement `/api/attendance/logs` (POST, GET, optional DELETE).
- [ ] Build simple page `production-control/reloj-checador` with upload form and list.
- [ ] Use `useSignedUrls('attendance-logs')` for dynamic viewing.

---

## Future (Phase 2+ - Not in this scope)
- Parse CSV and persist normalized attendance data.
- Enforce plant-level path prefixes and plant-based RLS refinements.
- Add bulk CSV validations, previews, and error reporting.
- Role-based access to view/delete uploads.


