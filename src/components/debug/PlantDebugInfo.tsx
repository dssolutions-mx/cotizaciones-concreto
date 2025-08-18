'use client';

import React from 'react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { isQualityTeamInRestrictedPlant } from '@/app/layout';

export default function PlantDebugInfo() {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();

  if (profile?.role !== 'QUALITY_TEAM') return null;

  const isRestricted = isQualityTeamInRestrictedPlant(profile?.role, currentPlant?.code);

  return (
    <div className="fixed top-4 right-4 bg-blue-100 border border-blue-300 p-4 rounded-lg text-xs z-50">
      <h3 className="font-bold mb-2">Debug Info (QUALITY_TEAM)</h3>
      <div>Role: {profile?.role}</div>
      <div>Plant Code: {currentPlant?.code || 'undefined'}</div>
      <div>Plant Name: {currentPlant?.name || 'undefined'}</div>
      <div>Plant ID: {currentPlant?.id || 'undefined'}</div>
      <div>Is Restricted: {isRestricted ? 'YES' : 'NO'}</div>
      <div>Restricted Plants: P2, P3, P4</div>
    </div>
  );
}
