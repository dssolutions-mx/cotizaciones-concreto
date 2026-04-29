/**
 * Portal construction-site scope: unit checks (no DB).
 * Run: npx tsx tests/security/portal-site-scope.test.ts
 */
import assert from 'node:assert';
import {
  assertConstructionSiteAllowedForCreate,
  type PortalContext,
} from '../../src/lib/client-portal/resolvePortalContext';
import { appendPortalClientId } from '../../src/lib/client-portal/portalClientIdUrl';

const unrestricted: PortalContext = {
  clientId: 'c1',
  membershipId: 'm1',
  roleWithinClient: 'user',
  permissions: {},
  allowedSiteIds: null,
  sitesRestricted: false,
};

const restricted: PortalContext = {
  ...unrestricted,
  allowedSiteIds: ['site-a', 'site-b'],
  sitesRestricted: true,
};

assert.strictEqual(assertConstructionSiteAllowedForCreate(unrestricted, null).ok, true);
assert.strictEqual(assertConstructionSiteAllowedForCreate(restricted, 'site-a').ok, true);
assert.strictEqual(assertConstructionSiteAllowedForCreate(restricted, 'site-x').ok, false);

// appendPortalClientId without window (SSR / node): getStoredPortalClientId returns null
assert.strictEqual(
  appendPortalClientId('/api/client-portal/orders?x=1'),
  '/api/client-portal/orders?x=1'
);
assert.strictEqual(
  appendPortalClientId('/api/client-portal/orders'),
  '/api/client-portal/orders'
);

console.log('portal-site-scope tests: ok');
