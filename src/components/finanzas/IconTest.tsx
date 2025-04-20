'use client';

import React from 'react';
import { Wallet, CreditCard, Users, ClipboardList } from 'lucide-react';

export default function IconTest() {
  return (
    <div className="flex gap-4 p-4">
      <div>
        <Wallet size={24} />
        <p>Wallet</p>
      </div>
      <div>
        <CreditCard size={24} />
        <p>Credit Card</p>
      </div>
      <div>
        <Users size={24} />
        <p>Users</p>
      </div>
      <div>
        <ClipboardList size={24} />
        <p>Clipboard List</p>
      </div>
    </div>
  );
} 