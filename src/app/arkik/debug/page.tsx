'use client';

import React from 'react';
import DebugArkikRunner from '@/components/arkik/DebugArkikValidator';

export default function ArkikDebugPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <DebugArkikRunner />
    </div>
  );
}
