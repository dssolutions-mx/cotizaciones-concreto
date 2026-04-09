'use client';

import dynamic from 'next/dynamic';

const BotIdClient = dynamic(
  () => import('botid/client').then((mod) => mod.BotIdClient),
  { ssr: false }
);

type ProtectRoute = {
  path: string;
  method: string;
  advancedOptions?: { checkLevel?: 'deepAnalysis' | 'basic' };
};

/** BotID renders a script tag; load client-only and after body so React 19 / SSR stay happy. */
export function BotIdClientGate({ protect }: { protect: ProtectRoute[] }) {
  return <BotIdClient protect={protect} />;
}
