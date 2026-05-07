/**
 * Portal order evidence: shared constants / plant gate used when serving evidence from order detail API.
 * Run: npx tsx tests/security/portal-order-evidence.test.ts
 */
import assert from 'node:assert';
import {
  PORTAL_REMISION_DOCUMENTS_OR_FILTER,
  PORTAL_VISIBLE_REMISION_DOCUMENT_CATEGORIES,
  labelPortalRemisionDocumentCategory,
} from '../../src/lib/client-portal/portalOrderEvidence';
import {
  assertPlantAllowedForPortal,
  type PortalContext,
} from '../../src/lib/client-portal/resolvePortalContext';

assert.ok(PORTAL_VISIBLE_REMISION_DOCUMENT_CATEGORIES.includes('pumping_remision'));
assert.ok(PORTAL_VISIBLE_REMISION_DOCUMENT_CATEGORIES.includes('concrete_remision'));
assert.ok(PORTAL_VISIBLE_REMISION_DOCUMENT_CATEGORIES.includes('general'));
assert.ok(PORTAL_REMISION_DOCUMENTS_OR_FILTER.includes('document_category.is.null'));

assert.strictEqual(labelPortalRemisionDocumentCategory('concrete_remision'), 'Remisión de concreto');
assert.strictEqual(labelPortalRemisionDocumentCategory('pumping_remision'), 'Remisión de bombeo');
assert.strictEqual(labelPortalRemisionDocumentCategory('general'), 'Documento general');
assert.strictEqual(labelPortalRemisionDocumentCategory(null), 'Documento');

const plantsRestricted: PortalContext = {
  clientId: 'c1',
  membershipId: 'm1',
  roleWithinClient: 'user',
  permissions: {},
  allowedSiteIds: null,
  sitesRestricted: false,
  allowedPlantIds: ['plant-a'],
  plantsRestricted: true,
};

assert.strictEqual(assertPlantAllowedForPortal(plantsRestricted, 'plant-x').ok, false);
assert.strictEqual(assertPlantAllowedForPortal(plantsRestricted, 'plant-a').ok, true);

console.log('portal-order-evidence tests: ok');
