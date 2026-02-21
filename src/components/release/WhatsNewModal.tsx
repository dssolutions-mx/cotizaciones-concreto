'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  LayoutDashboard,
  BriefcaseBusiness,
  PackagePlus,
  ShieldCheck,
  Crown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getReleaseAnnouncementConfig } from '@/config/releaseAnnouncement';

interface WhatsNewModalProps {
  open: boolean;
  onClose: () => void;
  role?: string;
}

export function WhatsNewModal({ open, onClose, role }: WhatsNewModalProps) {
  const config = getReleaseAnnouncementConfig(role);
  const blockIcons = [LayoutDashboard, BriefcaseBusiness, PackagePlus, ShieldCheck];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-primary/20 bg-white/95 p-0 sm:max-w-2xl">
        <DialogHeader className="rounded-t-lg border-b border-primary/10 bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-6 py-5">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles size={18} />
          </div>
          <DialogTitle className="text-2xl font-semibold tracking-tight text-gray-900">
            {config.title}
          </DialogTitle>
          <p className="text-sm text-gray-600">{config.subtitle}</p>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {config.blocks.map((block, idx) => (
            <div key={idx} className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-xs">
              <div className="mb-2 flex items-center gap-2">
                {React.createElement(blockIcons[idx] || LayoutDashboard, {
                  size: 16,
                  className: 'text-primary',
                })}
                <h4 className="font-medium text-gray-900">{block.title}</h4>
              </div>
              <ul className="list-disc list-inside text-sm leading-6 text-gray-700">
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}

          {config.roleEmphasis.length > 0 && (
            <div className="rounded-xl border border-primary/25 bg-primary/8 p-4">
              <h4 className="mb-2 flex items-center gap-2 font-medium text-primary-700">
                <Crown size={16} />
                Lo más relevante para tu rol
              </h4>
              <ul className="list-disc list-inside text-sm leading-6 text-gray-700">
                {config.roleEmphasis.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-gray-100 px-6 py-4 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={onClose} className="w-full border-gray-300 text-gray-700 sm:w-auto">
            Entendido
          </Button>
          <Button variant="solid" asChild className="w-full sm:w-auto">
            <Link href="/dashboard" onClick={onClose}>
              Ver novedades
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
