'use client';

import React from 'react';
import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb';
import RoleGuard from '@/components/auth/RoleGuard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['EXECUTIVE']} redirectTo="/access-denied">
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <AdminBreadcrumb />
          {children}
        </div>
      </div>
    </RoleGuard>
  );
}

