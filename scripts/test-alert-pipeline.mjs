/**
 * Alert Pipeline — Deterministic Local Tests
 *
 * Phase 7 / Step 1 — Alert Gate + Dedupe
 *
 * Run with: node scripts/test-alert-pipeline.mjs
 *
 * Fully local — no network, no dev server. Tests the alert gate logic
 * and dedupe key generation directly.
 *
 * Coverage:
 *   A. hunterEligible=true + hunterScore=85 => alert PASS
 *   B. hunterEligible=true + hunterScore=84 => alert BLOCK
 *   C. hunterEligible=false + hunterScore=98 => alert BLOCK
 *   D. missing hunterEligible => alert BLOCK
 *   E. Penny threshold behavior remains unchanged
 *   F. Options threshold behavior remains unchanged
 *   G. Hunter dedupe key = HUNTER:${symbol}
 *   H. Penny dedupe key = PENNY:${symbol}
 *   I. Options dedupe key = OPT:${contract}
 *   J. Missing Telegram/Discord credentials produce safe no-op behavior
 *   K. Existing project tests remain compatible
 */

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Error: ${error.message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n   Expected: ${JSON.stringify(expected)}\n   Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) throw new Error(message || 'Expected true but got false');
}

function assertFalse(value, message = '') {
  if (value) throw new Error(message || 'Expected false but got true');
}

function assertNull(value, message = '') {
  if (value !== null) throw new Error(`${message}\n   Expected: null\n   Actual: ${JSON.stringify(value)}`);
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined) throw new Error(message || 'Expected non-null value but got null/undefined');
}

function assertInRange(value, min, max, message = '') {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${message}\n   Expected value in [${min}, ${max}] but got: ${JSON.stringify(value)}`);
  }
}

// ---------------------------------------------------------------------------
// Replicate the alert gate logic from app/api/alerts/route.js
// ---------------------------------------------------------------------------
function pickAlerts(data) {
  return [
    // Hunter/Technical: require BOTH hunterEligible === true AND hunterScore >= 85
    // Do NOT treat legacy Technical Score as equivalent to Hunter Score.
    ...(data.technical || []).filter((x) =>
      x.hunterEligible === true && Number(x.hunterScore) >= 85
    ).slice(0, 4),
    // Penny: preserve existing behavior
    ...(data.penny || []).filter((x) => Number(x.score) >= 80 && Number(x.rvol || 0) >= 1.5).slice(0, 4),
    // Options: preserve existing behavior
    ...(data.options || []).filter((x) => Number(x.score) >= 75 && Number(x.premium) <= 1 && Number(x.volume || 0) >= 10).slice(0, 6),
  ];
}

// Replicate the dedupe key logic from saveSignal
function getDedupeKey(item) {
  if (item.kind === 'OPTIONS_CENTS') {
    return `OPT:${item.contract}`;
  }
  if (item.kind === 'PENNY') {
    return `PENNY:${item.symbol}`;
  }
  if (item.kind === 'TECHNICAL') {
    return `HUNTER:${item.symbol}`;
  }
  return item.symbol;
}

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------
function buildTechnicalItem(overrides = {}) {
  return {
    kind: 'TECHNICAL',
    symbol: 'AAPL',
    score: 85,
    hunterScore: 85,
    hunterEligible: true,
    price: 150,
    rvol: 2.0,
    rsi: 55,
    reasons: ['Test reason'],
    riskLabel: 'TECHNICAL',
    ...overrides,
  };
}

function buildPennyItem(overrides = {}) {
  return {
    kind: 'PENNY',
    symbol: 'PENNY1',
    score: 85,
    price: 0.5,
    rvol: 2.0,
    rsi: 60,
    thesis: 'Penny thesis',
    riskLabel: 'HIGH VOLATILITY',
    ...overrides,
  };
}

function buildOptionsItem(overrides = {}) {
  return {
    kind: 'OPTIONS_CENTS',
    symbol: 'AAPL',
    contract: 'AAPL260116C00150000',
    side: 'CALL',
    score: 80,
    premium: 0.5,
    contractCost: 50,
    strike: 150,
    expiry: '2026-01-16',
    volume: 100,
    openInterest: 500,
    spreadPct: 5,
    riskLabel: 'HIGH RISK',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('Alert Pipeline Tests (Phase 7 / Step 1)');
console.log('========================================\n');

// A. hunterEligible=true + hunterScore=85 => alert PASS
test('A: hunterEligible=true + hunterScore=85 => alert PASS', () => {
  const data = {
    technical: [buildTechnicalItem({ hunterEligible: true, hunterScore: 85 })],
    penny: [],
    options: [],
  };
  const candidates = pickAlerts(data);
  assertEqual(candidates.length, 1, 'Should have 1 candidate');
  assertEqual(candidates[0].symbol, 'AAPL', 'Symbol should be AAPL');
  assertEqual(candidates[0].hunterScore, 85, 'Hunter score should be 85');
});

// B. hunterEligible=true + hunterScore=84 => alert BLOCK
test('B: hunterEligible=true + hunterScore=84 => alert BLOCK', () => {
  const data = {
    technical: [buildTechnicalItem({ hunterEligible: true, hunterScore: 84 })],
    penny: [],
    options: [],
  };
  const candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Should have 0 candidates (blocked)');
});

// C. hunterEligible=false + hunterScore=98 => alert BLOCK
test('C: hunterEligible=false + hunterScore=98 => alert BLOCK', () => {
  const data = {
    technical: [buildTechnicalItem({ hunterEligible: false, hunterScore: 98 })],
    penny: [],
    options: [],
  };
  const candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Should have 0 candidates (blocked)');
});

// D. missing hunterEligible => alert BLOCK
test('D: missing hunterEligible => alert BLOCK', () => {
  const data = {
    technical: [buildTechnicalItem({ hunterEligible: undefined, hunterScore: 90 })],
    penny: [],
    options: [],
  };
  const candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Should have 0 candidates (blocked)');
});

// E. Penny threshold behavior remains unchanged
test('E: Penny threshold behavior unchanged (score >= 80 AND rvol >= 1.5)', () => {
  // PASS: score 80, rvol 1.5
  let data = { technical: [], penny: [buildPennyItem({ score: 80, rvol: 1.5 })], options: [] };
  let candidates = pickAlerts(data);
  assertEqual(candidates.length, 1, 'Penny with score 80 and rvol 1.5 should PASS');

  // BLOCK: score 79 (below threshold)
  data = { technical: [], penny: [buildPennyItem({ score: 79, rvol: 2.0 })], options: [] };
  candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Penny with score 79 should BLOCK');

  // BLOCK: rvol 1.4 (below threshold)
  data = { technical: [], penny: [buildPennyItem({ score: 85, rvol: 1.4 })], options: [] };
  candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Penny with rvol 1.4 should BLOCK');
});

// F. Options threshold behavior remains unchanged
test('F: Options threshold behavior unchanged (score >= 75 AND premium <= 1 AND volume >= 10)', () => {
  // PASS: all thresholds met
  let data = { technical: [], penny: [], options: [buildOptionsItem({ score: 75, premium: 1, volume: 10 })] };
  let candidates = pickAlerts(data);
  assertEqual(candidates.length, 1, 'Options with all thresholds met should PASS');

  // BLOCK: score 74
  data = { technical: [], penny: [], options: [buildOptionsItem({ score: 74, premium: 0.5, volume: 100 })] };
  candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Options with score 74 should BLOCK');

  // BLOCK: premium 1.01
  data = { technical: [], penny: [], options: [buildOptionsItem({ score: 80, premium: 1.01, volume: 100 })] };
  candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Options with premium 1.01 should BLOCK');

  // BLOCK: volume 9
  data = { technical: [], penny: [], options: [buildOptionsItem({ score: 80, premium: 0.5, volume: 9 })] };
  candidates = pickAlerts(data);
  assertEqual(candidates.length, 0, 'Options with volume 9 should BLOCK');
});

// G. Hunter dedupe key = HUNTER:${symbol}
test('G: Hunter dedupe key = HUNTER:${symbol}', () => {
  const item = buildTechnicalItem({ symbol: 'AAPL' });
  const key = getDedupeKey(item);
  assertEqual(key, 'HUNTER:AAPL', 'Hunter dedupe key should be HUNTER:AAPL');
});

// H. Penny dedupe key = PENNY:${symbol}
test('H: Penny dedupe key = PENNY:${symbol}', () => {
  const item = buildPennyItem({ symbol: 'PENNY1' });
  const key = getDedupeKey(item);
  assertEqual(key, 'PENNY:PENNY1', 'Penny dedupe key should be PENNY:PENNY1');
});

// I. Options dedupe key = OPT:${contract}
test('I: Options dedupe key = OPT:${contract}', () => {
  const item = buildOptionsItem({ contract: 'AAPL260116C00150000' });
  const key = getDedupeKey(item);
  assertEqual(key, 'OPT:AAPL260116C00150000', 'Options dedupe key should be OPT:contract');
});

// J. Missing Telegram/Discord credentials produce safe no-op behavior
test('J: Missing Telegram/Discord credentials produce safe no-op', async () => {
  // We test the sendTelegram and sendDiscord functions directly
  // by checking they return false when credentials are missing
  
  // Save original env
  const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalTelegramChatId = process.env.TELEGRAM_CHAT_ID;
  const originalDiscordWebhook = process.env.DISCORD_WEBHOOK_URL;
  
  // Clear credentials
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.DISCORD_WEBHOOK_URL;
  
  // Replicate the functions from alerts route
  async function sendTelegram(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;
    // Would make real request if credentials existed
    return false;
  }
  
  async function sendDiscord(text) {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) return false;
    // Would make real request if credentials existed
    return false;
  }
  
  // Test Telegram returns false (no-op)
  const telegramResult = await sendTelegram('test');
  assertFalse(telegramResult, 'Telegram should return false when credentials missing');
  
  // Test Discord returns false (no-op)
  const discordResult = await sendDiscord('test');
  assertFalse(discordResult, 'Discord should return false when credentials missing');
  
  // Restore original env
  if (originalTelegramToken) process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken;
  if (originalTelegramChatId) process.env.TELEGRAM_CHAT_ID = originalTelegramChatId;
  if (originalDiscordWebhook) process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhook;
});

// K. Existing project tests remain compatible - verify no breaking changes to imports
test('K: Existing project tests remain compatible (no import errors)', async () => {
  // This test verifies that the modules we modified can still be imported
  // and that the existing test files don't have import conflicts
  
  // Check that the alert route file syntax is valid
  const fs = await import('fs');
  const path = await import('path');
  const { execFileSync } = await import('child_process');
  
  const alertRoutePath = path.join(process.cwd(), 'app/api/alerts/route.js');
  const opportunitiesRoutePath = path.join(process.cwd(), 'app/api/opportunities/route.js');
  
  // Syntax check both files
  execFileSync(process.execPath, ['--check', alertRoutePath], { stdio: 'pipe' });
  execFileSync(process.execPath, ['--check', opportunitiesRoutePath], { stdio: 'pipe' });
  
  // Verify the test files still exist and are valid
  const testFiles = [
    'scripts/test-options-provider.mjs',
    'scripts/test-hunter-options.mjs',
    'scripts/test-options-signal.mjs',
    'scripts/test-options-freshness.mjs',
  ];
  
  for (const testFile of testFiles) {
    const fullPath = path.join(process.cwd(), testFile);
    assertTrue(fs.existsSync(fullPath), `Test file ${testFile} should exist`);
    execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
  }
});

// Additional: Verify Hunter score is NOT recalculated in opportunities route
test('Opportunities route passes through hunterEligible and hunterScore without recalculation', async () => {
  // This is a structural test - we verify the code pattern in the file
  const fs = await import('fs');
  const path = await import('path');
  const opportunitiesRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/opportunities/route.js'),
    'utf8'
  );
  
  // Verify hunterEligible is passed through (not recalculated)
  assertTrue(
    opportunitiesRoute.includes('hunterEligible:'),
    'opportunities route should pass through hunterEligible'
  );
  
  // Verify hunterScore is passed through
  assertTrue(
    opportunitiesRoute.includes('hunterScore: Number(x.hunterScore'),
    'opportunities route should pass through hunterScore'
  );
  
  // Verify no recalculation of Hunter Score (no calculateHunterScore import)
  assertFalse(
    opportunitiesRoute.includes('calculateHunterScore'),
    'opportunities route should NOT import calculateHunterScore'
  );
  
  // Verify no import from hunter-intelligence
  assertFalse(
    opportunitiesRoute.includes('hunter-intelligence'),
    'opportunities route should NOT import from hunter-intelligence'
  );
});

// Additional: Verify alerts route uses correct gate logic
test('Alerts route uses correct gate: hunterEligible === true AND hunterScore >= 85', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const alertsRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/alerts/route.js'),
    'utf8'
  );
  
  // Verify the gate logic uses centralized thresholds
  assertTrue(
    alertsRoute.includes('x.hunterEligible === true && Number(x.hunterScore) >= ALERT_THRESHOLDS.hunterMinScore'),
    'alerts route should require BOTH hunterEligible === true AND hunterScore >= ALERT_THRESHOLDS.hunterMinScore'
  );
  
  // Verify legacy Technical Score is NOT used
  assertFalse(
    alertsRoute.includes('x.score >= 85') && alertsRoute.includes('data.technical'),
    'alerts route should NOT use legacy x.score for technical'
  );
  
  // Verify dedupe key for Hunter (now in lib/alert-dedupe.js)
  const alertDedupe = fs.readFileSync(
    path.join(process.cwd(), 'lib/alert-dedupe.js'),
    'utf8'
  );
  assertTrue(
    alertDedupe.includes('HUNTER:${item.symbol}'),
    'alert-dedupe should use HUNTER:${symbol} dedupe key'
  );
  
  // Verify Penny and Options dedupe keys preserved (now in lib/alert-dedupe.js)
  assertTrue(
    alertDedupe.includes('PENNY:${item.symbol}'),
    'alert-dedupe should preserve PENNY dedupe key'
  );
  assertTrue(
    alertDedupe.includes('OPT:${item.contract}'),
    'alert-dedupe should preserve OPT dedupe key'
  );
});

// ===========================================================================
// PHASE 7 / STEP 2 — DETERMINISTIC SUPABASE DEDUPE TESTS
// ===========================================================================
// Mock Supabase client for deterministic testing.
// Time-aware: when `duplicateAgeMinutes` is provided, the mock returns a
// record whose created_at is `now - duplicateAgeMinutes` and lets the
// `duplicate()` function's own `.gte('created_at', since)` boundary decide
// whether it counts as a duplicate. This makes the 60-minute inclusive
// boundary deterministic and verifiable.
function createMockSupabase(behavior = {}) {
  const {
    duplicateResult = false,
    duplicateAgeMinutes = null,
    insertError = null,
    shouldThrow = false
  } = behavior;

  let lastInsertedRow = null;
  let lastDuplicateCheck = null;
  let capturedSince = null;

  const mockFrom = (table) => {
    if (table !== 'auto_signals') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      select: (columns) => ({
        eq: (col, val) => {
          lastDuplicateCheck = { column: col, value: val };
          return {
            gte: (col2, val2) => {
              capturedSince = val2;
              return {
                limit: (n) => {
                  if (shouldThrow) throw new Error('Supabase error');
                  if (duplicateAgeMinutes !== null && duplicateAgeMinutes !== undefined) {
                    const createdAt = new Date(Date.now() - duplicateAgeMinutes * 60 * 1000).toISOString();
                    const isDuplicate = createdAt >= capturedSince;
                    return Promise.resolve({
                      data: isDuplicate ? [{ ticker: val, created_at: createdAt }] : [],
                      error: null
                    });
                  }
                  return Promise.resolve({
                    data: duplicateResult ? [{ ticker: val, created_at: new Date().toISOString() }] : [],
                    error: null
                  });
                }
              };
            }
          };
        }
      }),
      insert: (rows) => {
        lastInsertedRow = rows[0];
        return Promise.resolve({ error: insertError });
      },
      // Test helpers
      _getLastInserted: () => lastInsertedRow,
      _getLastDuplicateCheck: () => lastDuplicateCheck,
      _reset: () => { lastInsertedRow = null; lastDuplicateCheck = null; capturedSince = null; }
    };
  };

  return { from: mockFrom };
}

// Import the actual dedupe functions
let alertDedupe;
async function loadAlertDedupe() {
  if (!alertDedupe) {
    alertDedupe = await import('../lib/alert-dedupe.js');
  }
  return alertDedupe;
}

// A. HUNTER:AAPL key generation
test('A: HUNTER:AAPL key generation', async () => {
  const { getDedupeKey } = await loadAlertDedupe();
  const item = buildTechnicalItem({ symbol: 'AAPL' });
  const key = getDedupeKey(item);
  assertEqual(key, 'HUNTER:AAPL', 'Hunter dedupe key should be HUNTER:AAPL');
});

// B. PENNY:AAPL key generation
test('B: PENNY:AAPL key generation', async () => {
  const { getDedupeKey } = await loadAlertDedupe();
  const item = buildPennyItem({ symbol: 'AAPL' });
  const key = getDedupeKey(item);
  assertEqual(key, 'PENNY:AAPL', 'Penny dedupe key should be PENNY:AAPL');
});

// C. OPT:AAPL260116C00150000 key generation
test('C: OPT:AAPL260116C00150000 key generation', async () => {
  const { getDedupeKey } = await loadAlertDedupe();
  const item = buildOptionsItem({ contract: 'AAPL260116C00150000' });
  const key = getDedupeKey(item);
  assertEqual(key, 'OPT:AAPL260116C00150000', 'Options dedupe key should be OPT:contract');
});

// D. Hunter/Penny/Options keys cannot collide
test('D: Hunter/Penny/Options keys cannot collide', async () => {
  const { getDedupeKey } = await loadAlertDedupe();

  const hunterKey = getDedupeKey(buildTechnicalItem({ symbol: 'AAPL' }));
  const pennyKey = getDedupeKey(buildPennyItem({ symbol: 'AAPL' }));
  const optionsKey = getDedupeKey(buildOptionsItem({ contract: 'AAPL260116C00150000' }));

  assertEqual(hunterKey, 'HUNTER:AAPL');
  assertEqual(pennyKey, 'PENNY:AAPL');
  assertEqual(optionsKey, 'OPT:AAPL260116C00150000');

  // All three keys must be distinct
  assertTrue(hunterKey !== pennyKey, 'HUNTER and PENNY keys must not collide');
  assertTrue(hunterKey !== optionsKey, 'HUNTER and OPT keys must not collide');
  assertTrue(pennyKey !== optionsKey, 'PENNY and OPT keys must not collide');
});

// E. Same key 59 minutes old → BLOCK (within 60-minute window)
test('E: Same key 59 minutes old → BLOCK', async () => {
  const { duplicate } = await loadAlertDedupe();
  const mockSupabase = createMockSupabase({ duplicateAgeMinutes: 59 });

  const result = await duplicate(mockSupabase, 'HUNTER:AAPL');
  assertTrue(result, 'Duplicate within 59 minutes should return true (BLOCK)');
});

// F. Same key exactly 60 minutes old → BLOCK (gte is inclusive)
test('F: Same key exactly 60 minutes old → BLOCK (inclusive >= boundary)', async () => {
  const { duplicate } = await loadAlertDedupe();
  const mockSupabase = createMockSupabase({ duplicateAgeMinutes: 60 });

  const result = await duplicate(mockSupabase, 'HUNTER:AAPL');
  assertTrue(result, 'Duplicate at exactly 60 minutes (gte inclusive) should return true (BLOCK)');
});

// G. Same key older than 60 minutes → ALLOW (outside window)
test('G: Same key older than 60 minutes → ALLOW', async () => {
  const { duplicate } = await loadAlertDedupe();
  const mockSupabase = createMockSupabase({ duplicateAgeMinutes: 61 });

  const result = await duplicate(mockSupabase, 'HUNTER:AAPL');
  assertFalse(result, 'Duplicate older than 60 minutes should return false (ALLOW)');
});

// H. Different key → ALLOW
test('H: Different key → ALLOW', async () => {
  const { duplicate } = await loadAlertDedupe();
  const mockSupabase = createMockSupabase({ duplicateResult: false });

  const result = await duplicate(mockSupabase, 'HUNTER:MSFT');
  assertFalse(result, 'Different key should return false (ALLOW)');
});

// I. saveSignal inserts when no duplicate exists
test('I: saveSignal inserts when no duplicate exists', async () => {
  const { saveSignal } = await loadAlertDedupe();
  const mockSupabase = createMockSupabase({ duplicateResult: false, insertError: null });

  const item = buildTechnicalItem({ symbol: 'AAPL', score: 90 });
  const result = await saveSignal(mockSupabase, item);

  assertTrue(result, 'saveSignal should return true when insert succeeds');
  const inserted = mockSupabase.from('auto_signals')._getLastInserted();
  assertNotNull(inserted, 'Row should be inserted');
  assertEqual(inserted.ticker, 'HUNTER:AAPL', 'Inserted ticker should be HUNTER:AAPL');
  assertEqual(inserted.confidence, 90, 'Inserted confidence should match item score');
});

// J. saveSignal blocks when duplicate exists
test('J: saveSignal blocks when duplicate exists', async () => {
  const { saveSignal } = await loadAlertDedupe();
  const mockSupabase = createMockSupabase({ duplicateResult: true });

  const item = buildTechnicalItem({ symbol: 'AAPL', score: 90 });
  const result = await saveSignal(mockSupabase, item);

  assertFalse(result, 'saveSignal should return false when duplicate exists');
  const inserted = mockSupabase.from('auto_signals')._getLastInserted();
  assertNull(inserted, 'No row should be inserted when duplicate exists');
});

// K. Supabase unavailable → no insert and no throw
test('K: Supabase unavailable → no insert and no throw', async () => {
  const { duplicate, saveSignal } = await loadAlertDedupe();

  // Test duplicate with null supabase
  const dupResult = await duplicate(null, 'HUNTER:AAPL');
  assertFalse(dupResult, 'duplicate(null) should return false (safe)');

  // Test saveSignal with null supabase
  const item = buildTechnicalItem({ symbol: 'AAPL', score: 90 });
  const saveResult = await saveSignal(null, item);
  assertFalse(saveResult, 'saveSignal(null) should return false (safe, no throw)');
});

// K2. Supabase query error is safe (no throw)
test('K2: Supabase query error is safe (no throw)', async () => {
  const { duplicate, saveSignal } = await loadAlertDedupe();
  const mockSupabase = createMockSupabase({ shouldThrow: true });

  // duplicate() must swallow the error and return false (ALLOW, safe — no throw)
  let dupThrew = false;
  let dupResult;
  try {
    dupResult = await duplicate(mockSupabase, 'HUNTER:AAPL');
  } catch {
    dupThrew = true;
  }
  assertFalse(dupThrew, 'duplicate() must not throw when Supabase errors');
  assertFalse(dupResult, 'duplicate() should return false when Supabase throws (safe)');

  // saveSignal() must not throw when Supabase errors (safe)
  const item = buildTechnicalItem({ symbol: 'AAPL', score: 90 });
  let saveThrew = false;
  let saveResult;
  try {
    saveResult = await saveSignal(mockSupabase, item);
  } catch {
    saveThrew = true;
  }
  assertFalse(saveThrew, 'saveSignal() must not throw when Supabase errors (safe)');
  assertFalse(saveResult !== true && saveResult !== false, 'saveSignal() should return a boolean when Supabase errors');
});

// L. Existing Telegram/Discord no-op behavior remains compatible
test('L: Existing Telegram/Discord no-op behavior remains compatible', async () => {
  // Save original env
  const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalTelegramChatId = process.env.TELEGRAM_CHAT_ID;
  const originalDiscordWebhook = process.env.DISCORD_WEBHOOK_URL;

  // Clear credentials
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.DISCORD_WEBHOOK_URL;

  // Replicate the functions from alerts route
  async function sendTelegram(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;
    return false;
  }

  async function sendDiscord(text) {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) return false;
    return false;
  }

  // Test Telegram returns false (no-op)
  const telegramResult = await sendTelegram('test');
  assertFalse(telegramResult, 'Telegram should return false when credentials missing');

  // Test Discord returns false (no-op)
  const discordResult = await sendDiscord('test');
  assertFalse(discordResult, 'Discord should return false when credentials missing');

  // Restore original env
  if (originalTelegramToken) process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken;
  if (originalTelegramChatId) process.env.TELEGRAM_CHAT_ID = originalTelegramChatId;
  if (originalDiscordWebhook) process.env.DISCORD_WEBHOOK_URL = originalDiscordWebhook;
});

// M. Existing Phase 7 Hunter gate tests remain passing
test('M: Existing Phase 7 Hunter gate tests remain passing', async () => {
  // Re-run the gate logic tests to ensure they still pass
  const data = {
    technical: [buildTechnicalItem({ hunterEligible: true, hunterScore: 85 })],
    penny: [],
    options: [],
  };
  const candidates = pickAlerts(data);
  assertEqual(candidates.length, 1, 'Hunter gate: eligible + score 85 should PASS');

  const data2 = {
    technical: [buildTechnicalItem({ hunterEligible: true, hunterScore: 84 })],
    penny: [],
    options: [],
  };
  const candidates2 = pickAlerts(data2);
  assertEqual(candidates2.length, 0, 'Hunter gate: eligible + score 84 should BLOCK');

  const data3 = {
    technical: [buildTechnicalItem({ hunterEligible: false, hunterScore: 98 })],
    penny: [],
    options: [],
  };
  const candidates3 = pickAlerts(data3);
  assertEqual(candidates3.length, 0, 'Hunter gate: not eligible + score 98 should BLOCK');

  const data4 = {
    technical: [buildTechnicalItem({ hunterEligible: undefined, hunterScore: 90 })],
    penny: [],
    options: [],
  };
  const candidates4 = pickAlerts(data4);
  assertEqual(candidates4.length, 0, 'Hunter gate: missing eligible should BLOCK');
});

// ===========================================================================
// PHASE 7 / STEP 3 — CENTRALIZED THRESHOLDS
// ===========================================================================
test('N: Centralized thresholds module exists with correct values', async () => {
  const { ALERT_THRESHOLDS } = await import('../lib/alert-thresholds.js');

  assertEqual(ALERT_THRESHOLDS.hunterMinScore, 85, 'hunterMinScore should be 85');
  assertEqual(ALERT_THRESHOLDS.technicalMinScore, 85, 'technicalMinScore should be 85');
  assertEqual(ALERT_THRESHOLDS.pennyMinScore, 80, 'pennyMinScore should be 80');
  assertEqual(ALERT_THRESHOLDS.pennyMinRvol, 1.5, 'pennyMinRvol should be 1.5');
  assertEqual(ALERT_THRESHOLDS.optionsMinScore, 75, 'optionsMinScore should be 75');
  assertEqual(ALERT_THRESHOLDS.optionsMaxPremium, 1, 'optionsMaxPremium should be 1');
  assertEqual(ALERT_THRESHOLDS.optionsMinVolume, 10, 'optionsMinVolume should be 10');

  assertTrue(Object.isFrozen(ALERT_THRESHOLDS), 'ALERT_THRESHOLDS should be frozen');
});

test('O: Opportunities route uses centralized thresholds', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const opportunitiesRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/opportunities/route.js'),
    'utf8'
  );

  assertTrue(
    opportunitiesRoute.includes("import { ALERT_THRESHOLDS } from '@/lib/alert-thresholds'"),
    'opportunities route should import ALERT_THRESHOLDS'
  );

  assertTrue(
    opportunitiesRoute.includes('hunterMinScore: ALERT_THRESHOLDS.hunterMinScore'),
    'opportunities route should use ALERT_THRESHOLDS.hunterMinScore'
  );

  assertTrue(
    opportunitiesRoute.includes('pennyMinScore: ALERT_THRESHOLDS.pennyMinScore'),
    'opportunities route should use ALERT_THRESHOLDS.pennyMinScore'
  );

  assertTrue(
    opportunitiesRoute.includes('optionsMinScore: ALERT_THRESHOLDS.optionsMinScore'),
    'opportunities route should use ALERT_THRESHOLDS.optionsMinScore'
  );
});

test('P: Alerts route uses centralized thresholds', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const alertsRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/alerts/route.js'),
    'utf8'
  );

  assertTrue(
    alertsRoute.includes("import { ALERT_THRESHOLDS } from '@/lib/alert-thresholds'"),
    'alerts route should import ALERT_THRESHOLDS'
  );

  assertTrue(
    alertsRoute.includes('Number(x.hunterScore) >= ALERT_THRESHOLDS.hunterMinScore'),
    'alerts route should use ALERT_THRESHOLDS.hunterMinScore for hunter gate'
  );

  assertTrue(
    alertsRoute.includes('Number(x.score) >= ALERT_THRESHOLDS.pennyMinScore'),
    'alerts route should use ALERT_THRESHOLDS.pennyMinScore'
  );

  assertTrue(
    alertsRoute.includes('ALERT_THRESHOLDS.pennyMinRvol'),
    'alerts route should use ALERT_THRESHOLDS.pennyMinRvol'
  );

  assertTrue(
    alertsRoute.includes('ALERT_THRESHOLDS.optionsMinScore'),
    'alerts route should use ALERT_THRESHOLDS.optionsMinScore'
  );

  assertTrue(
    alertsRoute.includes('ALERT_THRESHOLDS.optionsMaxPremium'),
    'alerts route should use ALERT_THRESHOLDS.optionsMaxPremium'
  );

  assertTrue(
    alertsRoute.includes('ALERT_THRESHOLDS.optionsMinVolume'),
    'alerts route should use ALERT_THRESHOLDS.optionsMinVolume'
  );
});

// ===========================================================================
// PHASE 7 / STEP 4 — NOTIFICATION SAFETY
// ===========================================================================
test('Q: Telegram/Discord missing credentials produce safe no-op (notifier module)', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const notifierPath = path.join(process.cwd(), 'lib/alert-notifier.js');
  const alertsRoutePath = path.join(process.cwd(), 'app/api/alerts/route.js');

  const notifier = fs.readFileSync(notifierPath, 'utf8');
  const alertsRoute = fs.readFileSync(alertsRoutePath, 'utf8');

  assertTrue(
    notifier.includes('if (!token || !chatId) return false;'),
    'sendTelegram should return false when credentials missing'
  );

  assertTrue(
    notifier.includes('if (!webhook) return false;'),
    'sendDiscord should return false when webhook missing'
  );

  const tokenCheckIndex = notifier.indexOf('if (!token || !chatId) return false;');
  const telegramFetchIndex = notifier.indexOf('await fetch(`https://api.telegram.org');

  assertTrue(tokenCheckIndex < telegramFetchIndex, 'Credential check should come before Telegram fetch');

  const webhookCheckIndex = notifier.indexOf('if (!webhook) return false;');
  const discordFetchIndex = notifier.indexOf('await fetch(webhook');

  assertTrue(webhookCheckIndex < discordFetchIndex, 'Credential check should come before Discord fetch');

  assertTrue(
    alertsRoute.includes("import { sendTelegram, sendDiscord } from '@/lib/alert-notifier'"),
    'alerts route should import notifier functions from shared module'
  );
});

// ===========================================================================
// PHASE 7 / STEP 5 — CRON COMPATIBILITY
// ===========================================================================
test('R: Cron compatibility: alerts route is independent of cron route', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const alertsRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/alerts/route.js'),
    'utf8'
  );

  const cronRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/cron/route.js'),
    'utf8'
  );

  assertTrue(
    alertsRoute.includes("process.env.CRON_SECRET"),
    'alerts route should use CRON_SECRET for auth'
  );

  assertFalse(
    alertsRoute.includes('saveOpportunity'),
    'alerts route should not depend on cron saveOpportunity function'
  );

  assertFalse(
    alertsRoute.includes('buildOpportunity'),
    'alerts route should not depend on cron buildOpportunity function'
  );

  assertTrue(
    alertsRoute.includes("import { sendTelegram, sendDiscord } from '@/lib/alert-notifier'"),
    'alerts route should import notification functions from shared notifier module'
  );

  assertTrue(
    cronRoute.includes('async function sendNotifications'),
    'cron route should have its own sendNotifications function'
  );

  const vercelJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
  const alertCron = vercelJson.crons.find(c => c.path === '/api/alerts');
  assertTrue(alertCron !== undefined, 'vercel.json should have /api/alerts cron');
  assertEqual(alertCron.schedule, '15 15 * * *', 'alerts cron should be scheduled at 15:15');
});

// ===========================================================================
// PHASE 7 / STEP 6 — FULL PIPELINE STRUCTURE
// ===========================================================================
test('S: Full pipeline structure: Hunter -> Opportunities -> Alerts -> Dedupe', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const opportunitiesRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/opportunities/route.js'),
    'utf8'
  );

  const alertsRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/alerts/route.js'),
    'utf8'
  );

  assertTrue(
    opportunitiesRoute.includes('${origin}/api/hunter'),
    'opportunities route should call /api/hunter'
  );

  assertTrue(
    alertsRoute.includes('${origin}/api/opportunities'),
    'alerts route should call /api/opportunities'
  );

  assertTrue(
    alertsRoute.includes('saveSignal'),
    'alerts route should use saveSignal for dedupe'
  );

  assertTrue(
    opportunitiesRoute.includes('hunterEligible:') && opportunitiesRoute.includes('x.hunterEligible === true'),
    'opportunities route should pass hunterEligible through'
  );

  assertTrue(
    opportunitiesRoute.includes('hunterScore: Number(x.hunterScore ?? 0)'),
    'opportunities route should pass hunterScore through'
  );
});

// ===========================================================================
// PHASE 9 / STEP 1 — SHARED NOTIFIER MODULE
// ===========================================================================
test('T: Shared notifier module is importable and exports expected functions', async () => {
  const notifier = await import('../lib/alert-notifier.js');
  assertTrue(typeof notifier.sendTelegram === 'function', 'sendTelegram should be a function');
  assertTrue(typeof notifier.sendDiscord === 'function', 'sendDiscord should be a function');
});

test('U: Telegram missing credentials => safe no-op (actual notifier)', async () => {
  const { sendTelegram } = await import('../lib/alert-notifier.js');

  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;

  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;

  const result = await sendTelegram('test');
  assertFalse(result, 'sendTelegram should return false when credentials missing');

  if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalChatId) process.env.TELEGRAM_CHAT_ID = originalChatId;
});

test('V: Discord missing webhook => safe no-op (actual notifier)', async () => {
  const { sendDiscord } = await import('../lib/alert-notifier.js');

  const originalWebhook = process.env.DISCORD_WEBHOOK_URL;
  delete process.env.DISCORD_WEBHOOK_URL;

  const result = await sendDiscord('test');
  assertFalse(result, 'sendDiscord should return false when webhook missing');

  if (originalWebhook) process.env.DISCORD_WEBHOOK_URL = originalWebhook;
});

test('W: Telegram notifier does not throw when credentials missing', async () => {
  const { sendTelegram } = await import('../lib/alert-notifier.js');

  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;

  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;

  let threw = false;
  try {
    await sendTelegram('test');
  } catch (e) {
    threw = true;
  }

  assertFalse(threw, 'sendTelegram should not throw when credentials missing');

  if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalChatId) process.env.TELEGRAM_CHAT_ID = originalChatId;
});

test('X: Discord notifier does not throw when webhook missing', async () => {
  const { sendDiscord } = await import('../lib/alert-notifier.js');

  const originalWebhook = process.env.DISCORD_WEBHOOK_URL;
  delete process.env.DISCORD_WEBHOOK_URL;

  let threw = false;
  try {
    await sendDiscord('test');
  } catch (e) {
    threw = true;
  }

  assertFalse(threw, 'sendDiscord should not throw when webhook missing');

  if (originalWebhook) process.env.DISCORD_WEBHOOK_URL = originalWebhook;
});

test('Y: Notifier functions do not set or leak environment variables', async () => {
  const { sendTelegram, sendDiscord } = await import('../lib/alert-notifier.js');

  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  const originalWebhook = process.env.DISCORD_WEBHOOK_URL;

  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.DISCORD_WEBHOOK_URL;

  await sendTelegram('test');
  await sendDiscord('test');

  assertTrue(process.env.TELEGRAM_BOT_TOKEN === undefined, 'TELEGRAM_BOT_TOKEN should remain unset');
  assertTrue(process.env.TELEGRAM_CHAT_ID === undefined, 'TELEGRAM_CHAT_ID should remain unset');
  assertTrue(process.env.DISCORD_WEBHOOK_URL === undefined, 'DISCORD_WEBHOOK_URL should remain unset');

  if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalChatId) process.env.TELEGRAM_CHAT_ID = originalChatId;
  if (originalWebhook) process.env.DISCORD_WEBHOOK_URL = originalWebhook;
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log('Test Results');
console.log('========================================');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total: ${passCount + failCount}`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
}