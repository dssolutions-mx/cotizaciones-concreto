'use client';

import React from "react";
import { useAuthBridge } from "@/adapters/auth-context-bridge";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function FinanzasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, profile, isLoading } = useAuthBridge();
  const router = useRouter();

  useEffect(() => {
    // Redirect if not authenticated
    if (!isLoading && !session) {
      router.push("/login");
      return;
    }

    // Redirect if no finance permissions
    if (!isLoading && profile) {
      const canAccessFinanzas = 
        profile.role === "EXECUTIVE" || 
        profile.role === "PLANT_MANAGER" || 
        profile.role === "CREDIT_VALIDATOR";
      
      if (!canAccessFinanzas) {
        router.push("/dashboard");
      }
    }
  }, [session, profile, isLoading, router]);

  // If still loading or redirecting, return nothing or a loading state
  if (isLoading || !session || !profile) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  // Render children directly as the main layout handles header and sidebar
  return <>{children}</>;
} 