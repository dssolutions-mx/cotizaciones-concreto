'use client'

import React from 'react'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import PlantContextDisplay from '@/components/plants/PlantContextDisplay'
import { Button } from '@/components/ui/button'
import { Bell, Menu } from 'lucide-react'

export default function InventoryHeader() {
  const { profile } = useAuthSelectors()

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button 
        type="button" 
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex items-center gap-x-4">
          <PlantContextDisplay />
        </div>
        
        <div className="flex items-center gap-x-4 lg:gap-x-6 ml-auto">
          {/* Notifications button */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-6 w-6" />
            <span className="sr-only">Ver notificaciones</span>
          </Button>

          {/* User info */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />
          <div className="flex items-center gap-x-4">
            <span className="text-sm font-medium text-gray-900">
              {profile?.first_name} {profile?.last_name}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {profile?.role === 'DOSIFICADOR' ? 'Dosificador' : 
               profile?.role === 'PLANT_MANAGER' ? 'Jefe de Planta' : 
               'Ejecutivo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
