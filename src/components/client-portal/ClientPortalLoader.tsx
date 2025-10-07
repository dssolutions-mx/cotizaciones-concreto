'use client';

import { motion } from 'framer-motion';
import { Branding } from '@/components/ui/Branding';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ClientPortalLoaderProps {
  message?: string;
  stage?: string;
}

export default function ClientPortalLoader({ message = 'Cargando...', stage }: ClientPortalLoaderProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          setIsLogoLoaded(true);
          return;
        }

        const { data: client } = await supabase
          .from('clients')
          .select('logo_path')
          .eq('portal_user_id', userId)
          .maybeSingle();

        const path = (client as any)?.logo_path as string | null;
        if (!path) {
          setIsLogoLoaded(true);
          return;
        }

        const { data: publicUrl } = supabase.storage
          .from('client-logos')
          .getPublicUrl(path);

        if (isMounted) {
          setLogoUrl(publicUrl.publicUrl || null);
          setIsLogoLoaded(true);
        }
      } catch (err) {
        console.warn('ClientPortalLoader: unable to load client logo');
        if (isMounted) setIsLogoLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-primary">
      <div className="flex flex-col items-center gap-8">
        {/* Logo Container with Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {/* Combined Logo Display */}
          <div className="relative flex items-center gap-6 bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            {/* Subtle Background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-gray-50 via-white to-gray-50"
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                backgroundSize: '200% 200%'
              }}
            />

            {/* Show both logos only when client logo is loaded */}
            {!isLogoLoaded ? (
              // Loading state - show placeholders for both
              <>
                <div className="relative z-10 w-40 h-[67px] rounded-lg bg-slate-200/50 animate-pulse" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="w-px h-20 bg-gray-300" />
                </div>
                <div className="relative z-10 w-40 h-[67px] rounded-lg bg-slate-200/50 animate-pulse" />
              </>
            ) : (
              // Both logos loaded - show them together with synchronized animation
              <>
                {/* Company Logo */}
                <motion.div
                  className="relative z-10"
                  initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    rotate: 0,
                    y: [0, -8, 0],
                  }}
                  transition={{ 
                    opacity: { duration: 0.5 },
                    scale: { duration: 0.5 },
                    rotate: { duration: 0.5 },
                    y: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5
                    }
                  }}
                >
                  <Branding variant="client-portal" size="xl" className="drop-shadow-lg" />
                </motion.div>

                {/* Divider with Pulse */}
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <motion.div
                    className="w-px h-20 bg-gradient-to-b from-transparent via-gray-400 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: [0.3, 0.7, 0.3],
                    }}
                    transition={{ 
                      opacity: { duration: 0.5 },
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </div>

                {/* Client Logo */}
                {logoUrl ? (
                  <motion.div
                    className="relative z-10"
                    initial={{ opacity: 0, scale: 0.5, rotate: 10 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1, 
                      rotate: 0,
                      y: [0, -8, 0],
                    }}
                    transition={{ 
                      opacity: { duration: 0.5 },
                      scale: { duration: 0.5 },
                      rotate: { duration: 0.5 },
                      y: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5
                      }
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt="Logo del Cliente"
                      className="h-[67px] w-auto object-contain drop-shadow-lg"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                      y: [0, -8, 0],
                    }}
                    transition={{ 
                      opacity: { duration: 0.5 },
                      scale: { duration: 0.5 },
                      y: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5
                      }
                    }}
                    className="relative z-10 w-40 h-[67px] rounded-lg bg-gradient-to-br from-slate-200/80 to-slate-300/80 flex items-center justify-center backdrop-blur-sm"
                  >
                    <span className="text-xs text-slate-500 font-medium">Cliente</span>
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* Subtle Shadow Effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gray-300/20 blur-xl -z-10"
            animate={{
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </motion.div>

        {/* Loading Indicator */}
        <div className="flex flex-col items-center gap-4">
          {/* Progress Bar */}
          <div className="relative w-64 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            {/* Main progress bar */}
            <motion.div
              className="absolute inset-0 bg-gray-800"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>

          {/* Loading Text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <p className="text-body font-medium text-label-primary">
              {message}
            </p>
            {stage && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-footnote text-label-secondary mt-1"
              >
                {stage}
              </motion.p>
            )}
          </motion.div>

          {/* Animated Dots */}
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-gray-700"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

