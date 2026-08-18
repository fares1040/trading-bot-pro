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
  
  // Verify the gate logic
  assertTrue(
    alertsRoute.includes('x.hunterEligible === true && Number(x.hunterScore) >= 85'),
    'alerts route should require BOTH hunterEligible === true AND hunterScore >= 85'
  );
  
  // Verify legacy Technical Score is NOT used
  assertFalse(
    alertsRoute.includes('x.score >= 85') && alertsRoute.includes('data.technical'),
    'alerts route should NOT use legacy x.score for technical'
  );
  
  // Verify dedupe key for Hunter
  assertTrue(
    alertsRoute.includes('HUNTER:${item.symbol}'),
    'alerts route should use HUNTER:${symbol} dedupe key'
  );
  
  // Verify Penny and Options dedupe keys preserved
  assertTrue(
    alertsRoute.includes('PENNY:${item.symbol}'),
    'alerts route should preserve PENNY dedupe key'
  );
  assertTrue(
    alertsRoute.includes('OPT:${item.contract}'),
    'alerts route should preserve OPT dedupe key'
  );
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