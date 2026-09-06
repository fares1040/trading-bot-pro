import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  isProviderConfigured,
  getInstitutionalProviderStatus,
  fetchInstitutionalData,
  calculateInstitutionalScore,
  recordFinraVerificationSuccess,
  isFinraVerified,
  resetFinraVerification,
  clearCaches,
  buildInstitutionalContext,
} from '../lib/institutional-provider.js';

describe('institutional-provider', () => {
  beforeEach(() => {
    resetFinraVerification();
    clearCaches();
  });

  describe('unverified state behavior', () => {
    it('isProviderConfigured reflects current environment', () => {
      const configured = isProviderConfigured();
      assert.strictEqual(typeof configured, 'boolean');
    });

    it('getInstitutionalProviderStatus returns unavailable when not configured', () => {
      const status = getInstitutionalProviderStatus();
      assert.strictEqual(status.available, false);
      assert.strictEqual(status.provider, null);
      assert.strictEqual(status.configured, false);
    });

    it('getInstitutionalProviderStatus returns configured but not verified when credentials exist but verification has not succeeded', () => {
      // When FINRA creds are configured in the test environment:
      const status = getInstitutionalProviderStatus();
      if (status.configured) {
        assert.strictEqual(status.available, false);
        assert.strictEqual(status.verified, false);
        assert.strictEqual(status.provider, 'finra');
      } else {
        // When not configured, status should show unconfigured
        assert.strictEqual(status.configured, false);
      }
    });

    it('isFinraVerified returns false by default', () => {
      assert.strictEqual(isFinraVerified(), false);
    });

    it('buildInstitutionalContext reflects unverified state', () => {
      const ctx = buildInstitutionalContext();
      assert.strictEqual(ctx.available, false);
    });
  });

  describe('verified state behavior', () => {
    it('recordFinraVerificationSuccess flips isFinraVerified to true', () => {
      recordFinraVerificationSuccess();
      assert.strictEqual(isFinraVerified(), true);
    });

    it('getInstitutionalProviderStatus returns available after verification when configured', () => {
      const statusBefore = getInstitutionalProviderStatus();
      if (!statusBefore.configured) {
        // Cannot test verification without configured credentials
        return;
      }
      recordFinraVerificationSuccess();
      const status = getInstitutionalProviderStatus();
      assert.strictEqual(status.available, true);
      assert.strictEqual(status.verified, true);
    });

    it('buildInstitutionalContext reflects verified state when configured', () => {
      const statusBefore = getInstitutionalProviderStatus();
      if (!statusBefore.configured) {
        return;
      }
      recordFinraVerificationSuccess();
      const ctx = buildInstitutionalContext();
      assert.strictEqual(ctx.available, true);
    });
  });

  describe('serverless/cold-start behavior', () => {
    it('resetFinraVerification simulates cold start by reverting to unverified', () => {
      recordFinraVerificationSuccess();
      assert.strictEqual(isFinraVerified(), true);
      resetFinraVerification();
      assert.strictEqual(isFinraVerified(), false);
      const status = getInstitutionalProviderStatus();
      assert.strictEqual(status.available, false);
    });
  });

  describe('health reporting truthfulness', () => {
    it('provider status does not claim verified without recordFinraVerificationSuccess', () => {
      const status = getInstitutionalProviderStatus();
      if (status.configured) {
        assert.strictEqual(status.verified, false);
        assert.strictEqual(status.available, false);
      }
    });

    it('provider status reflects verified state after recordFinraVerificationSuccess', () => {
      const statusBefore = getInstitutionalProviderStatus();
      if (!statusBefore.configured) {
        return;
      }
      recordFinraVerificationSuccess();
      const status = getInstitutionalProviderStatus();
      assert.strictEqual(status.verified, true);
      assert.strictEqual(status.available, true);
    });
  });

  describe('no credential leakage', () => {
    it('provider status does not contain actual credential values', () => {
      const status = getInstitutionalProviderStatus();
      const statusStr = JSON.stringify(status);
      // Should not contain actual secret values - check that the reason text
      // only contains env var names in documentation context, not values
      assert.ok(!statusStr.includes('my-super-secret'));
      assert.ok(!statusStr.includes('AKIAIOSFODNN7EXAMPLE'));
    });

    it('buildInstitutionalContext does not contain actual credential values', () => {
      const ctx = buildInstitutionalContext();
      const ctxStr = JSON.stringify(ctx);
      assert.ok(!ctxStr.includes('my-super-secret'));
      assert.ok(!ctxStr.includes('AKIAIOSFODNN7EXAMPLE'));
    });
  });

  describe('calculateInstitutionalScore', () => {
    it('returns null for unverified data', () => {
      const result = calculateInstitutionalScore({
        provider: 'finra',
        available: true,
        verified: false,
        atsShareQuantity: 1000000,
        atsTradeCount: 500,
        weekStartDate: new Date().toISOString(),
      });
      assert.strictEqual(result, null);
    });

    it('returns null for unavailable data', () => {
      const result = calculateInstitutionalScore({
        provider: 'finra',
        available: false,
        verified: true,
        atsShareQuantity: 1000000,
        atsTradeCount: 500,
        weekStartDate: new Date().toISOString(),
      });
      assert.strictEqual(result, null);
    });

    it('returns a score for verified and available data', () => {
      const result = calculateInstitutionalScore({
        provider: 'finra',
        available: true,
        verified: true,
        atsShareQuantity: 1000000,
        atsTradeCount: 500,
        weekStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
      assert.ok(result !== null);
      assert.ok(typeof result.score === 'number');
      assert.ok(result.score >= 0 && result.score <= 100);
    });
  });

  describe('fetchInstitutionalData', () => {
    it('returns null when not configured', async () => {
      const result = await fetchInstitutionalData('AAPL');
      assert.strictEqual(result, null);
    });

    it('returns null when not configured even with a symbol', async () => {
      const status = getInstitutionalProviderStatus();
      if (status.configured) {
        return;
      }
      const result = await fetchInstitutionalData('AAPL');
      assert.strictEqual(result, null);
    });
  });
});
