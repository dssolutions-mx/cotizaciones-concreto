# Client Portal Quality Enhancement - Testing Checklist

## Pre-Testing Setup
- [ ] Ensure Supabase is running and accessible
- [ ] Verify RLS policies are properly configured for client portal access
- [ ] Create test client user with valid `client_id` in `user_profiles`
- [ ] Ensure test client has remisiones with quality data (muestreos, muestras, ensayos)

## API Endpoint Testing

### Authentication & Authorization
- [ ] Test `/api/client-portal/quality` without authentication → Should return 401
- [ ] Test with authenticated user without `client_id` → Should return 404
- [ ] Test with valid client user → Should return data successfully

### Data Retrieval
- [ ] Verify API returns all required fields in `ClientQualityData`:
  - [ ] `clientInfo` with business_name, client_code, rfc
  - [ ] `summary` with totals, averages, performance, alerts
  - [ ] `remisiones` array with nested data
  - [ ] `monthlyStats` aggregated by month
  - [ ] `qualityByRecipe` grouped by recipe code
  - [ ] `qualityByConstructionSite` grouped by construction site

### Date Range Filtering
- [ ] Test default date range (last 6 months)
- [ ] Test custom date range with `from` and `to` parameters
- [ ] Test edge cases: same start/end date, future dates, very old dates

### Data Transformation
- [ ] Verify remisiones include all nested muestreos
- [ ] Verify muestreos include all nested muestras
- [ ] Verify muestras include all nested ensayos
- [ ] Verify `concrete_specs` is included in muestreos
- [ ] Verify materials are properly transformed to expected type
- [ ] Check `complianceStatus` is correctly calculated

### Statistical Calculations
- [ ] Verify totals are accurate (remisiones, muestreos, ensayos, volume)
- [ ] Verify averages are correct (resistance, compliance, unit mass, yield)
- [ ] Verify performance metrics (on-time testing rate)
- [ ] Verify alerts are generated for quality issues

## UI Testing

### Page Load & Authentication
- [ ] Navigate to `/client-portal/quality` as authenticated client user
- [ ] Page loads without errors
- [ ] Loading spinner displays while fetching data
- [ ] Client business name displays in header

### Empty State
- [ ] Test with client that has no quality data
- [ ] Empty state message displays correctly
- [ ] UI remains functional

### Header Section
- [ ] Client name displays correctly
- [ ] Date range inputs are functional
- [ ] "Aplicar Filtros" button triggers data refresh
- [ ] "Exportar PDF" button is visible (even if placeholder)

### Metrics Dashboard
- [ ] All metric cards display with correct values:
  - [ ] Volume Total
  - [ ] Cumplimiento
  - [ ] Resistencia Promedio
  - [ ] Ensayos a Tiempo
- [ ] Coverage percentages display correctly
- [ ] Badges show appropriate colors based on values
- [ ] Alerts section displays warnings/errors if applicable

### Tabs Navigation
- [ ] All 4 tabs are visible: Resumen General, Análisis Estadístico, Muestreos, Remisiones
- [ ] Clicking each tab switches content correctly
- [ ] Tab content loads without errors

### Tab: Resumen General (Overview)
- [ ] Resistance vs Compliance scatter plot renders (via QualityChartSection)
- [ ] Recipe performance bar chart displays
- [ ] Chart tooltips work on hover
- [ ] Summary statistics cards show correct values
- [ ] Charts are responsive on different screen sizes

### Tab: Análisis Estadístico (Statistical Analysis)
- [ ] Quality level assessment card displays
- [ ] CV (Coefficient of Variation) is calculated and displayed
- [ ] Radar chart for multidimensional quality renders
- [ ] Compliance distribution histogram displays
- [ ] Grouped analysis table shows data by strength and age
- [ ] Statistical summary cards show mean, std deviation
- [ ] Recommendations section appears if quality issues exist

### Tab: Muestreos (Samplings)
- [ ] Samplings table renders with all columns
- [ ] Data includes: date, remision, site, recipe, volume
- [ ] Measurements display: unit mass, temperatures, slump
- [ ] Compliance badges show correct colors
- [ ] "Ver Ensayo" button opens test details (new tab)
- [ ] "Ver Remisión" button opens remision details (new tab)
- [ ] Legend section explains sampling types

### Tab: Remisiones
- [ ] Remisiones table renders with sortable columns
- [ ] Search functionality works
- [ ] Filtering by remision number, site, or recipe works
- [ ] Sort by date, remision number, or volume works
- [ ] Expandable rows show detailed sampling data
- [ ] Export CSV button works
- [ ] CSV contains all expected columns

### Responsive Design
- [ ] Test on desktop (1920x1080, 1440x900)
- [ ] Test on tablet (iPad portrait/landscape)
- [ ] Test on mobile (iPhone 13/14)
- [ ] All components remain accessible
- [ ] No horizontal scrolling on mobile
- [ ] Touch targets are appropriately sized

### Animations
- [ ] Page transitions are smooth
- [ ] Loading spinner animates correctly
- [ ] Tab switches have smooth transitions
- [ ] No animation performance issues

## Edge Cases & Error Handling

### Data Edge Cases
- [ ] Client with no remisiones → Shows empty state
- [ ] Client with remisiones but no muestreos → Displays appropriately
- [ ] Client with muestreos but no ensayos → Shows "Site Check" status
- [ ] Remision with missing recipe → Shows "SIN-RECETA"
- [ ] Remision with missing construction site → Shows "Sin obra"
- [ ] Ensayos with zero resistance → Filtered out correctly
- [ ] Ensayos outside guarantee age → Filtered out correctly

### API Error Scenarios
- [ ] Network error → Shows error message gracefully
- [ ] Timeout → Handles appropriately
- [ ] 500 server error → Shows user-friendly message
- [ ] Invalid date range → Handles gracefully

### Performance
- [ ] Page loads within 2 seconds with typical data
- [ ] Large datasets (1000+ remisiones) render acceptably
- [ ] Charts render without lag
- [ ] No memory leaks on repeated navigation
- [ ] Table sorting/filtering is responsive

## Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Security Testing
- [ ] Verify RLS policies prevent cross-client data access
- [ ] Test with different client users to ensure data isolation
- [ ] Verify no sensitive data leaks in API responses
- [ ] Check that materials and recipes don't expose proprietary info

## Accessibility
- [ ] Keyboard navigation works throughout
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader compatibility (basic check)
- [ ] Labels and ARIA attributes are present

## Final Checks
- [ ] No console errors in browser
- [ ] No TypeScript errors in code
- [ ] No linting errors
- [ ] Documentation is complete
- [ ] Code is committed with clear message

## Known Limitations
- PDF export is not yet implemented (placeholder only)
- Real-time updates require manual refresh
- Historical trends limited to available data range

## Notes
Add any observations, bugs found, or improvements needed:

---

