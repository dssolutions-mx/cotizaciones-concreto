'use client';

import React from 'react';
import ArkikProcessor from '@/components/arkik/ArkikProcessor';
import Link from 'next/link';
import { Bug, Cpu } from 'lucide-react';

export default function ArkikPage() {
  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Arkik Processing Modes</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Production Mode</h3>
            </div>
            <p className="text-blue-700 text-sm mb-3">
              Full-featured processor with enhanced UI and complete workflow
            </p>
            <div className="text-blue-900 font-medium">← Current Mode</div>
          </div>
          
          <Link href="/arkik/debug" className="block">
            <div className="p-4 border-2 border-orange-200 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-orange-900">Debug Mode</h3>
              </div>
              <p className="text-orange-700 text-sm mb-3">
                Simple step-by-step validator with detailed logging
              </p>
              <div className="text-orange-600 font-medium">Switch to Debug →</div>
            </div>
          </Link>
        </div>
      </div>

      <ArkikProcessor />
    </div>
  );
}


