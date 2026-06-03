'use client';

import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import MaterialsCatalogManagement from '@/components/materials/MaterialsCatalogManagement';
import RoleGuard from '@/components/auth/RoleGuard';
import { MATERIAL_CATALOG_WRITE_ROLES } from '@/lib/auth/materialsCatalogRoles';

export default function QualityMaterialsCatalogPage() {
  return (
    <RoleGuard allowedRoles={[...MATERIAL_CATALOG_WRITE_ROLES]} redirectTo="/quality">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <QualityBreadcrumb
          hubName="Validaciones"
          hubHref="/quality/validaciones"
          items={[{ label: 'Catálogo de materiales' }]}
        />
        <MaterialsCatalogManagement
          title="Catálogo de materiales"
          className="px-0"
        />
      </div>
    </RoleGuard>
  );
}
