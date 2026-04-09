'use client';

import { useEffect } from 'react';

type ProtectRoute = {
  path: string;
  method: string;
  advancedOptions?: { checkLevel?: 'deepAnalysis' | 'basic' };
};

/** One init per page load; survives React Strict Mode double-mount. */
let botIdInitStarted = false;

/** Use `initBotId` instead of `BotIdClient` so React 19 does not warn about script tags in the tree. */
export function BotIdClientGate({ protect }: { protect: ProtectRoute[] }) {
  useEffect(() => {
    if (botIdInitStarted) return;
    botIdInitStarted = true;
    void import('botid/client/core')
      .then(({ initBotId }) => {
        initBotId({ protect });
      })
      .catch((err) => {
        console.error('BotID init failed:', err);
        botIdInitStarted = false;
      });
  }, [protect]);

  return null;
}
