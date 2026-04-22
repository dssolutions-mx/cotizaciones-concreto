'use client';

import React from 'react';
import RoleGuard from '@/components/auth/RoleGuard';
import Link from 'next/link';
import { UserCreationWizard } from '@/components/admin/users/UserCreationWizard';
import { ArrowLeft } from 'lucide-react';

export default function CreateUserPage() {
  return (
    <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN_OPERATIONS']} redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Link
            href="/admin/users"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a la lista
          </Link>
          <h1 className="text-2xl font-bold">Crear Usuario</h1>
          <p className="text-sm text-gray-600 mt-1">
            Crea un nuevo usuario o envía una invitación por correo
          </p>
        </div>
        <UserCreationWizard />
      </div>
    </RoleGuard>
  );
}
