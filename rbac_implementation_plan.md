# Role-Based Access Control Implementation Plan

## Overview

This document outlines a comprehensive plan to improve role-based access control (RBAC) throughout the application. The goal is to ensure that UI elements and functionality are consistently protected based on user roles, providing a better user experience and maintaining security.

## Phase 1: Critical UI Components (Completed)

✅ Added RoleGuard to PendingApprovalTab
✅ Added role-based conditional rendering for approval/reject buttons
✅ Modified the Quotes page to filter tabs based on user role

## Phase 2: Standardize RBAC Across All Components

### 2.1 Audit and Protect Recipe Management Pages

**Target Files:**
- `src/app/recipes/page.tsx`
- `src/components/recipes/*`

**Changes Required:**
- Add RoleGuard to recipe management pages to restrict access to QUALITY_TEAM and EXECUTIVE roles
- Add conditional rendering for edit/delete buttons based on user roles
- Create role-specific views for recipe pages

**Implementation Steps:**
1. Wrap recipe management pages with RoleGuard
2. Add hasRole checks for edit/delete actions
3. Create a read-only view for non-QUALITY_TEAM users

### 2.2 Audit and Protect Price Management Pages

**Target Files:**
- `src/app/prices/page.tsx`
- `src/components/prices/*`

**Changes Required:**
- Add RoleGuard to price management pages to restrict access to QUALITY_TEAM and EXECUTIVE roles
- Add conditional rendering for edit/delete buttons based on user roles
- Create role-specific views for price pages

**Implementation Steps:**
1. Wrap price management pages with RoleGuard
2. Add hasRole checks for edit/delete actions
3. Create a read-only view for non-QUALITY_TEAM users

### 2.3 Audit and Protect Client Management

**Target Files:**
- `src/app/clients/page.tsx`
- `src/components/clients/*` (if exists)

**Changes Required:**
- Add role-based conditional rendering for client management actions
- Ensure only SALES_AGENT, PLANT_MANAGER, and EXECUTIVE can manage clients

**Implementation Steps:**
1. Add hasRole checks for client management actions
2. Create appropriate UI feedback for unauthorized actions

### 2.4 Create Common RBAC Helper Components

**Target Files:**
- `src/components/auth/RoleProtectedButton.tsx` (new)
- `src/components/auth/RoleProtectedSection.tsx` (new)

**Implementation Steps:**
1. Create reusable components for common RBAC patterns
2. Implement RoleProtectedButton component:
```tsx
export function RoleProtectedButton({
  allowedRoles,
  onClick,
  children,
  ...props
}: {
  allowedRoles: UserRole | UserRole[];
  onClick: () => void;
  children: React.ReactNode;
  [key: string]: any;
}) {
  const { hasRole } = useAuth();
  
  if (!hasRole(allowedRoles)) {
    return null;
  }
  
  return (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  );
}
```

3. Implement RoleProtectedSection component for larger UI sections

## Phase 3: Improve User Experience

### 3.1 Add Informative Messages for Unauthorized Actions

**Target Files:**
- `src/components/ui/AccessDeniedMessage.tsx` (new)
- Various component files

**Implementation Steps:**
1. Create a reusable AccessDeniedMessage component:
```tsx
export function AccessDeniedMessage({ 
  action, 
  requiredRoles 
}: { 
  action: string; 
  requiredRoles: UserRole[] 
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg text-center">
      <h3 className="text-lg font-medium mb-2">Acceso Restringido</h3>
      <p className="text-gray-600">
        No tienes permiso para {action}.
        {requiredRoles.length > 0 && (
          <span> Esta acción requiere uno de los siguientes roles: {requiredRoles.join(', ')}.</span>
        )}
      </p>
    </div>
  );
}
```

2. Use this component throughout the application where actions are restricted

### 3.2 Create Role-Optimized Views

**Target Files:**
- Various component files

**Implementation Steps:**
1. Identify components that need role-specific views
2. Create role-optimized versions of these components
3. Use conditional rendering based on user role to show the appropriate view

### 3.3 Add Visual Indicators for Permissions

**Target Files:**
- `src/components/ui/RoleIndicator.tsx` (new)
- Various component files

**Implementation Steps:**
1. Create a RoleIndicator component to visually show permission status
2. Add tooltips to explain why certain actions are unavailable
3. Use consistent visual language for permission-related UI elements

## Testing Plan

1. Create test accounts for each user role
2. Verify that each role can only access appropriate UI elements
3. Test edge cases like:
   - Switching between roles
   - Direct URL access to restricted pages
   - API access to restricted endpoints

## Rollout Strategy

1. Implement changes in a development environment
2. Conduct thorough testing with all user roles
3. Deploy changes in phases, starting with non-critical components
4. Monitor for any issues or unexpected behavior
5. Gather user feedback and make adjustments as needed

## Success Criteria

- All UI elements are consistently protected based on user roles
- Users only see actions they have permission to perform
- Clear feedback is provided when access is denied
- The application maintains a clean, intuitive interface for all user roles 