# Role-Based Access Control Improvements

## Current Implementation Analysis

After reviewing the codebase, I've identified several inconsistencies and areas for improvement in the role-based access control (RBAC) implementation. While the database policies have been cleaned up, there are UI-level inconsistencies that should be addressed.

## Issues and Recommendations

### 1. Inconsistent Protection of UI Elements

**Issue:** The application lacks a consistent approach to protecting UI elements based on user roles. Some components may directly check `userProfile.role`, while others don't implement role-based restrictions at all.

**Example:** In the quotes page, all tabs (Draft, Pending Approval, Approved, Create Quote) are shown to all users, which contradicts the database policies where only certain roles should approve quotes.

**Recommendation:** 
- Implement consistent role-based UI protection across all components
- Hide or disable UI elements based on user roles
- Use the RoleGuard component that already exists in the codebase

### 2. Missing Role-Based Access Controls on Critical Pages

**Issue:** The admin users page has proper role protection with RoleGuard, but this pattern isn't consistently applied across other sensitive pages.

**Recommendation:**
- Protect all sensitive pages with the RoleGuard component
- Apply RoleGuard to the following pages:
  - PendingApprovalTab (only PLANT_MANAGER and EXECUTIVE should access)
  - Price management pages (only QUALITY_TEAM and EXECUTIVE should access)
  - Recipe management pages (only QUALITY_TEAM and EXECUTIVE should access)

### 3. Quote Approval UI Inconsistencies

**Issue:** The PendingApprovalTab does not restrict the approve/reject buttons based on user roles. While the database will enforce policies, users should not see UI elements they don't have permission to use.

**Recommendation:**
- In the PendingApprovalTab component, add role-based conditional rendering:
```jsx
{hasRole(['PLANT_MANAGER', 'EXECUTIVE']) && (
  <button onClick={() => approveQuote(quote.id)}>
    Approve
  </button>
)}
```

### 4. Missing Tab-Level Access Control in Quotes Page

**Issue:** All users can see all tabs in the Quotes page, even if they don't have permission to use them.

**Recommendation:**
- Modify the TABS array in quotes/page.tsx to be role-aware:
```jsx
const getRoleTabs = (userRole) => {
  const baseTabs = [
    { id: 'draft', name: 'Cotizaciones Borrador', component: DraftQuotesTab },
    { id: 'create', name: 'Crear Cotización', component: QuoteBuilder }
  ];
  
  if (userRole === 'PLANT_MANAGER' || userRole === 'EXECUTIVE') {
    baseTabs.push(
      { id: 'pending', name: 'Pendientes de Aprobación', component: PendingApprovalTab },
      { id: 'approved', name: 'Cotizaciones Aprobadas', component: ApprovedQuotesTab }
    );
  } else {
    baseTabs.push(
      { id: 'approved', name: 'Cotizaciones Aprobadas', component: ApprovedQuotesTab }
    );
  }
  
  return baseTabs;
};
```

### 5. Underutilization of RoleGuard Component

**Issue:** The codebase includes a well-designed RoleGuard component, but it's not consistently used throughout the app.

**Recommendation:**
- Use RoleGuard for all role-protected content
- Add a standard pattern for component-level role protection:
```jsx
export function SensitiveComponent() {
  return (
    <RoleGuard allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}>
      {/* Component content */}
    </RoleGuard>
  );
}
```

### 6. Misleading UI Experiences for Different Roles

**Issue:** Some components render UI elements that users can see but not use due to backend policies, leading to a poor user experience.

**Recommendation:**
- Create role-specific views for shared pages
- Add clear visual indicators for disabled functionality
- Include informative messages explaining why certain actions are unavailable

## Implementation Plan

### Phase 1: Protect Critical UI Components
1. Add RoleGuard to PendingApprovalTab
2. Add role-based conditional rendering for approval/reject buttons
3. Modify the Quotes page to filter tabs based on user role

### Phase 2: Standardize RBAC Across All Components
1. Audit all components for missing role checks
2. Create helper components for common role-based UI patterns
3. Implement consistent role-based visibility rules

### Phase 3: Improve User Experience
1. Add informative messages for unauthorized actions
2. Create custom views optimized for each role
3. Add visual indicators for permissions throughout the UI 