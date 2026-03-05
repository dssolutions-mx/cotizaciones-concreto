/**
 * Backfill product_prices for APPROVED quotes that have none.
 * Uses the fix-product-prices API with BACKFILL_SECRET to bypass auth (for script use).
 *
 * Prerequisites:
 * 1. Add to .env.local: BACKFILL_SECRET=<pick-any-random-string>
 * 2. Run: npm run dev (in one terminal)
 * 3. Run: npm run backfill:product-prices (in another terminal)
 *
 * Or run with --start-server to spawn the dev server automatically.
 */

import * as http from 'http';
import * as child_process from 'child_process';

const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const FIX_URL = `${API_URL.replace(/\/$/, '')}/api/quotes/fix-product-prices`;

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  const target = new URL(url);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`${target.origin}/`, (res) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(3000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

async function main() {
  const secret = process.env.BACKFILL_SECRET;
  if (!secret) {
    console.error(
      'Missing BACKFILL_SECRET. Add to .env.local:\n  BACKFILL_SECRET=any-random-string-you-choose\n\nThen run: node --env-file=.env.local --import tsx scripts/backfill-product-prices.ts'
    );
    process.exit(1);
  }

  const startServer = process.argv.includes('--start-server');
  let serverProcess: child_process.ChildProcess | null = null;

  if (startServer) {
    console.log('Starting Next.js dev server...');
    serverProcess = child_process.spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, BACKFILL_SECRET: secret },
    });
    const ok = await waitForServer(API_URL);
    if (!ok) {
      console.error('Server did not become ready in time.');
      serverProcess?.kill();
      process.exit(1);
    }
    console.log('Server ready.');
  } else {
    const ok = await waitForServer(API_URL, 3);
    if (!ok) {
      console.error(
        'Could not reach the dev server. Run "npm run dev" in another terminal first, then run this script again.'
      );
      process.exit(1);
    }
  }

  try {
    console.log('Calling fix-product-prices API (fixAll: true)...');
    const res = await fetch(FIX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Backfill-Secret': secret,
      },
      body: JSON.stringify({ fixAll: true, sinceDays: 20 }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error('API error:', json.error || res.statusText);
      process.exit(1);
    }

    const { results } = json as {
      results: {
        success_count: number;
        failed_count: number;
        success: Array<{ quote_number: string; prices_created: number }>;
        failed: Array<{ quote_number: string; error: string }>;
      };
    };

    console.log('\n--- Backfill result ---');
    console.log(`Success: ${results.success_count} quotes`);
    console.log(`Failed:  ${results.failed_count} quotes`);

    if (results.success.length > 0) {
      console.log('\nFixed quotes:');
      results.success.forEach((s) =>
        console.log(`  ${s.quote_number}: ${s.prices_created} product_price(s) created`)
      );
    }
    if (results.failed.length > 0) {
      console.log('\nFailed quotes:');
      results.failed.forEach((f) => console.log(`  ${f.quote_number}: ${f.error}`));
    }

    process.exit(results.failed_count > 0 ? 1 : 0);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

main();
