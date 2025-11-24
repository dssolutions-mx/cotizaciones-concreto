# Frontend Architecture - Multi-User Client Portal

## 📐 Architecture Overview

### Core Principles (Apple HIG)
1. **Clarity** - Clear visual hierarchy, readable typography, precise icons
2. **Deference** - Content-first design, subtle UI elements
3. **Depth** - Layered interface with smooth transitions
4. **Consistency** - Familiar patterns across the application
5. **Feedback** - Immediate, clear responses to all actions
6. **User Control** - Reversible actions, clear states, predictable behavior

---

## 🏗️ Component Architecture

### Directory Structure
```
/src
├── /app
│   ├── /api
│   │   └── /client-portal
│   │       ├── /team                    # Team management APIs
│   │       │   ├── route.ts             # GET (list), POST (invite)
│   │       │   └── /[userId]
│   │       │       ├── route.ts         # PATCH (update role/perms), DELETE (deactivate)
│   │       │       └── /permissions
│   │       │           └── route.ts     # PATCH (update permissions)
│   │       └── /orders
│   │           ├── /pending-approval
│   │           │   └── route.ts         # GET (pending orders)
│   │           └── /[orderId]
│   │               ├── /approve
│   │               │   └── route.ts     # POST (approve order)
│   │               └── /reject
│   │                   └── route.ts     # POST (reject order)
│   └── /client-portal
│       ├── /team
│       │   └── page.tsx                 # Team management dashboard
│       ├── /approvals
│       │   └── page.tsx                 # Order approval dashboard
│       └── /orders
│           └── page.tsx                 # Updated with approval UI
├── /components
│   └── /client-portal
│       ├── /team
│       │   ├── TeamMemberList.tsx       # Team member table/grid
│       │   ├── InviteUserModal.tsx      # Invite user dialog
│       │   ├── EditUserRoleModal.tsx    # Change role dialog
│       │   ├── EditPermissionsModal.tsx # Edit permissions dialog
│       │   ├── DeactivateUserDialog.tsx # Deactivate confirmation
│       │   ├── UserRoleBadge.tsx        # Role badge component
│       │   └── PermissionsList.tsx      # Permissions display
│       ├── /approvals
│       │   ├── PendingOrdersGrid.tsx    # Pending orders grid
│       │   ├── OrderApprovalCard.tsx    # Order card component
│       │   ├── ApproveOrderDialog.tsx   # Approve confirmation
│       │   ├── RejectOrderModal.tsx     # Reject with reason
│       │   └── BulkApproveDialog.tsx    # Bulk approve confirmation
│       ├── /orders
│       │   ├── OrderStatusBadge.tsx     # Enhanced status badges
│       │   ├── ApprovalInfoSection.tsx  # Approval info display
│       │   └── CreateOrderBanner.tsx    # Info banner for non-executives
│       └── /shared
│           ├── PermissionGate.tsx       # Permission-based rendering
│           ├── EmptyState.tsx           # Reusable empty states
│           ├── LoadingState.tsx         # Reusable loading states
│           └── NotificationBell.tsx     # Notification center
├── /hooks
│   ├── /client-portal
│   │   ├── useTeamMembers.ts            # SWR hook for team data
│   │   ├── usePendingApprovals.ts       # SWR hook for pending orders
│   │   ├── useUserPermissions.ts        # Hook for permission checks
│   │   ├── useClientRole.ts             # Hook for user's role
│   │   └── useApprovalActions.ts        # Hook for approve/reject actions
└── /lib
    └── /client-portal
        ├── teamService.ts               # Team management service
        ├── approvalService.ts           # Approval workflow service
        └── permissionTemplates.ts       # Permission preset definitions
```

---

## 🎨 Design System

### Color Palette (Status & Roles)

#### Role Colors
- **Executive** - Amber/Gold: `bg-amber-100 text-amber-800 border-amber-300`
- **User** - Blue: `bg-blue-100 text-blue-800 border-blue-300`
- **Inactive** - Gray: `bg-gray-100 text-gray-600 border-gray-300`

#### Status Colors
- **Pending Approval** - Yellow/Orange: `bg-yellow-100 text-yellow-800`
- **Approved** - Green: `bg-green-100 text-green-800`
- **Rejected** - Red: `bg-red-100 text-red-800`
- **Not Required** - Gray: `bg-gray-100 text-gray-600`

### Typography
- **Headings**: `font-semibold text-gray-900`
- **Body**: `text-gray-700`
- **Labels**: `text-sm font-medium text-gray-600`
- **Metadata**: `text-xs text-gray-500`

### Spacing (Tailwind)
- **Sections**: `space-y-6`
- **Cards**: `p-6`
- **Forms**: `space-y-4`
- **Button groups**: `space-x-2`

### Icons (Lucide React)
- **Team**: `Users`
- **Executive**: `Crown` or `Shield`
- **Approve**: `CheckCircle`
- **Reject**: `XCircle`
- **Pending**: `Clock`
- **Settings**: `Settings`
- **Invite**: `UserPlus`
- **Permissions**: `Key`

---

## 📊 State Management

### Zustand Store Extension

Create new store slice: `/src/store/client-portal/team-slice.ts`

```typescript
interface TeamSliceState {
  // Team members cache
  teamMembers: TeamMember[] | null;
  selectedMember: TeamMember | null;

  // Approval queue cache
  pendingApprovals: Order[] | null;

  // User's role and permissions for current client
  userRole: 'executive' | 'user' | null;
  userPermissions: Permissions | null;

  // Actions
  loadTeamMembers: () => Promise<void>;
  inviteTeamMember: (data: InviteData) => Promise<Result>;
  updateMemberRole: (userId: string, role: string) => Promise<Result>;
  updateMemberPermissions: (userId: string, perms: Permissions) => Promise<Result>;
  deactivateMember: (userId: string) => Promise<Result>;

  loadPendingApprovals: () => Promise<void>;
  approveOrder: (orderId: string) => Promise<Result>;
  rejectOrder: (orderId: string, reason: string) => Promise<Result>;
  bulkApprove: (orderIds: string[]) => Promise<Result>;
}
```

### SWR Data Fetching

Use SWR for real-time data synchronization:

```typescript
// /src/hooks/client-portal/useTeamMembers.ts
export function useTeamMembers() {
  const { data, error, mutate } = useSWR('/api/client-portal/team', fetcher);

  return {
    teamMembers: data,
    isLoading: !data && !error,
    isError: error,
    refresh: mutate
  };
}
```

---

## 🔐 Permission System

### Permission Keys
```typescript
type PermissionKey =
  | 'create_orders'
  | 'view_orders'
  | 'create_quotes'
  | 'view_quotes'
  | 'view_materials'
  | 'view_quality_data'
  | 'manage_team'
  | 'approve_orders';
```

### Permission Templates
```typescript
export const PERMISSION_TEMPLATES = {
  FULL_ACCESS: {
    create_orders: true,
    view_orders: true,
    create_quotes: true,
    view_quotes: true,
    view_materials: true,
    view_quality_data: true,
  },
  ORDER_MANAGER: {
    create_orders: true,
    view_orders: true,
    view_materials: true,
  },
  VIEW_ONLY: {
    view_orders: true,
    view_quotes: true,
    view_materials: true,
  },
  QUOTE_MANAGER: {
    create_quotes: true,
    view_quotes: true,
    view_materials: true,
  },
};
```

### Permission Gate Component
```typescript
<PermissionGate requires="create_orders">
  <Button>Create Order</Button>
</PermissionGate>

<PermissionGate requires="create_orders" fallback={<LockedButton />}>
  <Button>Create Order</Button>
</PermissionGate>
```

---

## 🔄 Data Flow

### Team Invitation Flow
```
1. Executive clicks "Invite User" → Opens InviteUserModal
2. Fills form (email, role, permissions) → Validates with Zod
3. Submits → POST /api/client-portal/team
4. API creates user in client_portal_users → Sends invitation email
5. Success → Closes modal → Refreshes team list via SWR mutate
6. Shows toast notification
```

### Order Approval Flow
```
1. Non-executive creates order → client_approval_status = 'pending_client'
2. Executive receives email notification
3. Executive views /client-portal/approvals → Loads pending orders
4. Clicks "Approve" → Opens confirmation dialog
5. Confirms → POST /api/client-portal/orders/[id]/approve
6. API updates order → Triggers credit validation webhook
7. Success → Order removed from pending list → Optimistic UI update
8. Creator receives approval email notification
```

---

## 🧪 Testing Strategy

### Unit Tests
- Permission template calculations
- Permission gate logic
- Data transformation utilities

### Component Tests (React Testing Library)
- Team member list rendering
- Invite modal form validation
- Approval card interactions
- Empty states display

### Integration Tests
- Team invitation workflow
- Order approval/rejection flow
- Permission updates propagation

### E2E Tests (Playwright/Cypress)
- Complete user invitation journey
- Complete order approval journey
- Multi-user permission verification
- Notification delivery

---

## 🚀 Performance Optimizations

1. **SWR Caching** - Reduce redundant API calls
2. **Optimistic Updates** - Immediate UI feedback
3. **Lazy Loading** - Code split heavy components
4. **Memoization** - React.memo for expensive components
5. **Virtualization** - For large team/order lists (if needed)
6. **Debouncing** - Search and filter inputs

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 640px - Stacked layout, full-width cards
- **Tablet**: 640px - 1024px - 2-column grid
- **Desktop**: > 1024px - Multi-column layout with sidebar

### Mobile Adaptations
- Team table → Stacked cards
- Multi-column forms → Single column
- Side-by-side buttons → Stacked buttons
- Dropdown actions for row operations

---

## ♿ Accessibility

1. **Keyboard Navigation** - All interactive elements accessible via keyboard
2. **ARIA Labels** - Proper labeling for screen readers
3. **Focus Management** - Clear focus states, trap focus in modals
4. **Color Contrast** - WCAG AA compliant (4.5:1 minimum)
5. **Error Messaging** - Clear, actionable error messages
6. **Loading States** - Announce state changes to screen readers

---

## 🔔 Notification System

### Types
- **In-App** - Bell icon with badge count
- **Email** - SendGrid via edge function
- **Toast** - Temporary success/error messages

### Notification Events
- Team member invited
- Team member role changed
- Order pending approval (executive)
- Order approved (creator)
- Order rejected (creator)

---

## 📝 Form Validation

### Zod Schemas

```typescript
const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name required').optional(),
  lastName: z.string().min(1, 'Last name required').optional(),
  role: z.enum(['executive', 'user']),
  permissions: z.record(z.boolean()).optional(),
});

const rejectOrderSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason (min 10 characters)'),
});
```

---

## 🎯 Success Metrics

### Key Performance Indicators
- Team invitation completion rate
- Average approval time
- User adoption rate (executive vs user ratio)
- Permission configuration usage
- Notification delivery success rate
- Page load times < 2s
- API response times < 500ms

---

## 🔗 API Contract

### Endpoints

#### GET /api/client-portal/team
```typescript
Response: {
  success: boolean;
  data: TeamMember[];
}

TeamMember: {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_within_client: 'executive' | 'user';
  permissions: Record<string, boolean>;
  is_active: boolean;
  invited_at: string;
  last_login: string | null;
}
```

#### POST /api/client-portal/team
```typescript
Request: {
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'executive' | 'user';
  permissions?: Record<string, boolean>;
}

Response: {
  success: boolean;
  data: { userId: string; invitationSent: boolean };
  error?: string;
}
```

#### PATCH /api/client-portal/team/[userId]
```typescript
Request: {
  role?: 'executive' | 'user';
}

Response: {
  success: boolean;
  data: TeamMember;
}
```

#### PATCH /api/client-portal/team/[userId]/permissions
```typescript
Request: {
  permissions: Record<string, boolean>;
}

Response: {
  success: boolean;
  data: { permissions: Record<string, boolean> };
}
```

#### DELETE /api/client-portal/team/[userId]
```typescript
Response: {
  success: boolean;
  message: string;
}
```

#### GET /api/client-portal/orders/pending-approval
```typescript
Response: {
  success: boolean;
  data: Order[];
}
```

#### POST /api/client-portal/orders/[orderId]/approve
```typescript
Response: {
  success: boolean;
  data: Order;
}
```

#### POST /api/client-portal/orders/[orderId]/reject
```typescript
Request: {
  reason: string;
}

Response: {
  success: boolean;
  data: Order;
}
```

---

This architecture follows senior-level development practices with:
- Clear separation of concerns
- Type safety throughout
- Consistent patterns
- Scalable structure
- Comprehensive error handling
- Performance optimization
- Accessibility compliance
- Apple HIG principles
