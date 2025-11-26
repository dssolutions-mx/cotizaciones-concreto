'use client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN_OPERATIONS']} redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-large-title text-gray-900 mb-2">Administración</h1>
          <p className="text-body text-gray-600">
            Panel de control para gestionar usuarios, plantas y configuraciones del sistema
          </p>
        </div>
        <AdminDashboard />
      </div>
    </RoleGuard>
  );
}

