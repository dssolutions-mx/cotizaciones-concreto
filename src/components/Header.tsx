'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut, User, Menu } from "lucide-react";
import { useAuthBridge } from "@/adapters/auth-context-bridge";

export default function Header() {
  const { session, profile, isLoading } = useAuthBridge();

  return (
    <header className="h-16 border-b bg-white fixed top-0 left-0 right-0 z-10">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="font-semibold text-xl">
            Concretos DC
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {!isLoading && session && profile && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white">
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium hidden md:block">
                {profile.first_name || session.user?.email}
              </span>
              <Link href="/api/auth/signout">
                <Button variant="ghost" size="icon">
                  <LogOut className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 