import {
  classifySwingQuality,
  classifyInstitutionalConviction,
  classifyEarlyExplosionConviction,
  classifyOptionsConviction,
  classifyCatalystConviction,
} from '../lib/classify-intelligence.js';

const tests = { passed: 0, failed: 0, errors: [] };

function assert(condition, message) {
  if (condition) {
    tests.passed++;
  } else {
    tests.failed++;
    tests.errors.push(message);
  }
}

function assertEqual(actual, expected, message) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    tests.passed++;
  } else {
    tests.failed++;
    tests.errors.push(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('========================================');
console.log('D12 CONSISTENCY & BOUNDARY TESTS');
console.log('========================================');

// ===== SWING QUALITY (MEDIUM at 55) =====
console.log('\n--- Swing Quality: MEDIUM at 55 ---');
assertEqual(classifySwingQuality(55), 'MEDIUM', 'Swing 55 is MEDIUM');
assertEqual(classifySwingQuality(70), 'STRONG', 'Swing 70 is STRONG');
assertEqual(classifySwingQuality(85), 'TOP', 'Swing 85 is TOP');
assertEqual(classifySwingQuality(40), 'WEAK', 'Swing 40 is WEAK');
assertEqual(classifySwingQuality(null), 'UNAVAILABLE', 'Swing null is UNAVAILABLE');

// ===== INSTITUTIONAL CONVICTION (MEDIUM at 55) =====
console.log('\n--- Institutional Conviction: MEDIUM at 55 ---');
assertEqual(classifyInstitutionalConviction(55, 'partial'), 'MEDIUM', 'Institutional 55 partial is MEDIUM');
assertEqual(classifyInstitutionalConviction(55, 'complete'), 'MEDIUM', 'Institutional 55 complete is MEDIUM');
assertEqual(classifyInstitutionalConviction(65, 'partial'), 'STRONG', 'Institutional 65 partial is STRONG');
assertEqual(classifyInstitutionalConviction(45, 'complete'), 'MEDIUM', 'Institutional 45 complete is MEDIUM');

// ===== EARLY EXPLOSION CONVICTION (MEDIUM at 55) =====
console.log('\n--- Early Explosion Conviction: MEDIUM at 55 ---');
assertEqual(classifyEarlyExplosionConviction(55), 'MEDIUM', 'Early Explosion 55 is MEDIUM');
assertEqual(classifyEarlyExplosionConviction(80), 'STRONG', 'Early Explosion 80 is STRONG');
assertEqual(classifyEarlyExplosionConviction(40), 'WEAK', 'Early Explosion 40 is WEAK');
assertEqual(classifyEarlyExplosionConviction(null), 'UNAVAILABLE', 'Early Explosion null is UNAVAILABLE');

// ===== OPTIONS CONVICTION (MEDIUM at 55) =====
console.log('\n--- Options Conviction: MEDIUM at 55 ---');
assertEqual(classifyOptionsConviction(55), 'MEDIUM', 'Options 55 is MEDIUM');
assertEqual(classifyOptionsConviction(80), 'STRONG', 'Options 80 is STRONG');
assertEqual(classifyOptionsConviction(30), 'WEAK', 'Options 30 is WEAK');
assertEqual(classifyOptionsConviction(null), 'UNAVAILABLE', 'Options null is UNAVAILABLE');

// ===== CATALYST CONVICTION (MEDIUM at 55) =====
console.log('\n--- Catalyst Conviction: MEDIUM at 55 ---');
assertEqual(classifyCatalystConviction(55), 'MEDIUM', 'Catalyst 55 is MEDIUM');
assertEqual(classifyCatalystConviction(90), 'STRONG', 'Catalyst 90 is STRONG');
assertEqual(classifyCatalystConviction(35), 'WEAK', 'Catalyst 35 is WEAK');
assertEqual(classifyCatalystConviction(null), 'UNAVAILABLE', 'Catalyst null is UNAVAILABLE');

// ===== D12 CONSISTENCY TESTS =====
console.log('\n--- D12 Consistency Tests ---');
const allMediums = [
  classifySwingQuality(55),
  classifyInstitutionalConviction(55, 'partial'),
  classifyEarlyExplosionConviction(55),
  classifyOptionsConviction(55),
  classifyCatalystConviction(55),
];

assert(allMediums.every(m => m === 'MEDIUM'), 'All classifications at 55 should be MEDIUM');
assert(!allMediums.includes('STRONG') && !allMediums.includes('TOP') && !allMediums.includes('WEAK') && !allMediums.includes('UNAVAILABLE'), 'No other categories at 55');

// ===== BOUNDARY TESTS =====
console.log('\n--- Boundary Tests ---');
// Test below 55
assert(classifySwingQuality(54) === 'WATCH', 'Swing 54 is WATCH');
assert(classifyEarlyExplosionConviction(54) === 'WEAK', 'Early Explosion 54 is WEAK');
assert(classifyOptionsConviction(54) === 'WEAK', 'Options 54 is WEAK');
assert(classifyCatalystConviction(54) === 'WEAK', 'Catalyst 54 is WEAK');

// Test above 55
assert(classifySwingQuality(56) === 'STRONG', 'Swing 56 is STRONG');
assert(classifyEarlyExplosionConviction(56) === 'MEDIUM', 'Early Explosion 56 is MEDIUM');
assert(classifyOptionsConviction(56) === 'MEDIUM', 'Options 56 is MEDIUM');
assert(classifyCatalystConviction(56) === 'MEDIUM', 'Catalyst 56 is MEDIUM');

console.log('\n' + '='.repeat(60));
console.log('D12 CONSISTENCY & BOUNDARY TEST RESULTS');
console.log('='.repeat(60));
console.log(`Passed: ${tests.passed}`);
console.log(`Failed: ${tests.failed}`);
console.log(`Total: ${tests.passed + tests.failed}`);

if (tests.errors.length > 0) {
  console.log('\nErrors:');
  tests.errors.forEach(e => console.log(`  - ${e}`));
}

process.exit(tests.failed > 0 ? 1 : 0);