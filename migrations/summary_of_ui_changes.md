# Resumen de Cambios en la Interfaz de Usuario para Nuevos Roles

## Roles Implementados
- **CREDIT_VALIDATOR**: Rol encargado de validar el crédito de las órdenes
- **DOSIFICADOR**: Rol que solo visualiza órdenes pero no puede editarlas

## Cambios en Componentes

### Autenticación y Permisos
- **AuthContext.tsx**: Actualizado para incluir los nuevos roles `CREDIT_VALIDATOR` y `DOSIFICADOR` en la definición de `UserRole`
- **ProfileMenu.tsx**: Actualizado para mostrar los nombres apropiados para los nuevos roles

### Navegación
- **layout.tsx**: Modificado para mostrar opciones de navegación específicas para cada rol
  - `CREDIT_VALIDATOR`: Acceso al módulo de validación de crédito
  - `DOSIFICADOR`: Acceso a vistas de órdenes sin capacidad de edición

### Órdenes
- **OrdersList.tsx**: 
  - Modificado para ocultar el botón "Crear Orden" para usuarios con rol `DOSIFICADOR`
  - Vista de solo lectura implementada para el rol `DOSIFICADOR`

- **OrdersCalendarView.tsx**:
  - Preparado para filtros específicos de rol en el futuro
  - Vista ya en modo de solo lectura

- **OrderDetails.tsx**:
  - Deshabilitada la capacidad de edición para el rol `DOSIFICADOR`
  - La condición `canEditOrder` ahora verifica que el usuario no sea `DOSIFICADOR`

- **CreditValidationTab.tsx**:
  - Implementada lógica específica para el rol `CREDIT_VALIDATOR`
  - Los validadores solo pueden ver órdenes pendientes
  - Gerentes pueden ver tanto órdenes pendientes como rechazadas por validadores

- **orders/page.tsx**:
  - Actualizado `RoleGuard` para permitir que el rol `CREDIT_VALIDATOR` acceda a la pestaña de validación de crédito

### Servicio de Órdenes
- **orderService.ts**:
  - Implementadas nuevas funciones:
    - `rejectCreditByValidator`: Para rechazar crédito por validadores
    - `getOrdersForManagerValidation`: Para obtener órdenes que requieren validación de gerencia
    - `getRejectedOrders`: Para listar órdenes rechazadas
    - `canUserApproveOrder`: Para verificar si un usuario puede aprobar una orden basado en su rol

## Flujo de Validación de Crédito
1. Los validadores de crédito (`CREDIT_VALIDATOR`) pueden aprobar o rechazar órdenes pendientes
2. Si un validador rechaza una orden, se marca como `rejected_by_validator` y se envía para revisión de gerencia
3. Los gerentes (`EXECUTIVE`, `PLANT_MANAGER`) pueden aprobar órdenes rechazadas por validadores
4. El rol `DOSIFICADOR` solo puede ver órdenes sin editarlas

## Consideraciones de Seguridad
- Row Level Security (RLS) implementado en la base de datos para limitar acceso según roles
- Webhooks implementados para notificaciones según cambios de estado
- Verificaciones de rol en frontend y backend para asegurar acceso adecuado 