'use client'

import React from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import RoleGuard from '@/components/auth/RoleGuard'
import PlantSelectionGuard from '@/components/auth/PlantSelectionGuard'
import InventorySidebar from '@/components/inventory/InventorySidebar'
import InventoryHeader from '@/components/inventory/InventoryHeader'

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard allowedRoles={['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR']}>
      <PlantSelectionGuard>
        <div className="min-h-screen bg-gray-50">
          <InventorySidebar />
          <main className="lg:pl-72">
            <InventoryHeader />
            <div className="p-4 lg:p-6">
              {children}
            </div>
          </main>
        </div>
      </PlantSelectionGuard>
    </RoleGuard>
  )
}
