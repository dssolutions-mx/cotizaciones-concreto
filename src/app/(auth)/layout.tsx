import AuthInitializer from '@/components/auth/auth-initializer';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <AuthInitializer />
      {children}
    </div>
  );
}
