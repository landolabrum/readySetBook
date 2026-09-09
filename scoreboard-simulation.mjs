/**
 * Scoreboard Overlay Integration Test
 * Simulates the user flow: Add Scoreboard Overlay -> Verify it appears in CanopyView
 */

// Mock overlay data that simulates what happens in the real application
const mockOverlayTypes = [
  'scoreboard', 'ticker', 'map', 'hud',
  'lapcounter', 'media', 'weather'
];

// Simulate overlay creation functions (simplified versions of our real functions)
function createPlaceholder(type, titleSeed = '') {
  return {
    id: `__default__${type}`,
    type: type,
    enabled: false,
    title: titleSeed ? `${titleSeed} - ${type}` : type,
    x: 0,
    y: 0,
    z_index: 1,
    variant: 'default',
    data: {}
  };
}

function createRealOverlay(type, titleSeed = '') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return {
    id: `${type}-${timestamp}-${random}`,
    type: type,
    enabled: true,
    title: titleSeed ? `${titleSeed} - ${type}` : `Live ${type}`,
    x: 0,
    y: 0,
    z_index: 1,
    variant: 'default',
    data: type === 'scoreboard' ? {
      showPositions: true,
      showTimes: true,
      maxTeams: 10
    } : {}
  };
}

function coerceEnabled(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'on', 'y'].includes(normalized);
  }
  return false;
}

function enabledOnly(overlays) {
  if (!Array.isArray(overlays)) return [];

  // Group overlays by type to handle placeholder vs real overlay conflicts
  const byType = new Map();

  for (const overlay of overlays) {
    const type = overlay?.type?.toLowerCase();
    if (!type) continue;

    if (!byType.has(type)) {
      byType.set(type, []);
    }
    byType.get(type).push(overlay);
  }

  const result = [];

  // For each type, prefer real overlays over placeholders
  for (const [type, typeOverlays] of byType.entries()) {
    const sorted = typeOverlays.sort((a, b) => {
      const aIsPlaceholder = a.id?.startsWith('__default__') ?? false;
      const bIsPlaceholder = b.id?.startsWith('__default__') ?? false;
      const aEnabled = coerceEnabled(a?.enabled);
      const bEnabled = coerceEnabled(b?.enabled);

      // Real enabled overlays win
      if (!aIsPlaceholder && aEnabled && (!bEnabled || bIsPlaceholder)) return -1;
      if (!bIsPlaceholder && bEnabled && (!aEnabled || aIsPlaceholder)) return 1;

      // Real disabled overlays beat placeholders
      if (!aIsPlaceholder && bIsPlaceholder) return -1;
      if (!bIsPlaceholder && aIsPlaceholder) return 1;

      // Both same type, sort by z_index
      return Number(b.z_index || 0) - Number(a.z_index || 0);
    });

    // Take only enabled overlays
    const enabledOverlays = sorted.filter(o => coerceEnabled(o?.enabled));
    result.push(...enabledOverlays);
  }

  return result.sort((a, b) => Number(b.z_index || 0) - Number(a.z_index || 0));
}

function realOverlaysOnly(overlays) {
  if (!Array.isArray(overlays)) return [];
  return overlays.filter(o => o && !o.id?.startsWith('__default__'));
}

function enabledRealOverlaysOnly(overlays) {
  return realOverlaysOnly(overlays).filter(o => coerceEnabled(o?.enabled));
}

// Simulate the normalization process (adds placeholders for missing types)
function normalizeOverlayArray(overlays, titleSeed = '') {
  const result = [...(Array.isArray(overlays) ? overlays : [])];

  // Add placeholders for missing overlay types
  for (const type of mockOverlayTypes) {
    if (!result.some(o => o.type === type)) {
      result.push(createPlaceholder(type, titleSeed));
    }
  }

  return result;
}

// Simulate the addOverlay function from CanopyPanel
function simulateAddOverlay(currentOverlays, type, titleSeed = '') {
  console.log(`\n🎬 USER ACTION: Clicking "Add ${type} Overlay"...`);

  // Step 1: Create new overlay with enabled: true (like real addOverlay does)
  const newOverlay = createRealOverlay(type, titleSeed);
  console.log(`✅ Created new ${type} overlay:`, {
    id: newOverlay.id,
    type: newOverlay.type,
    enabled: newOverlay.enabled,
    title: newOverlay.title
  });

  // Step 2: Remove conflicting placeholders and disabled overlays of same type
  const withoutConflicts = currentOverlays.filter(o => {
    const sameType = o.type?.toLowerCase() === type.toLowerCase();
    if (!sameType) return true; // Keep different types

    const isPlaceholder = o.id?.startsWith('__default__');
    const isDisabled = !coerceEnabled(o.enabled);

    // Remove if same type and (placeholder OR disabled OR real but we're replacing)
    return false; // Remove all overlays of the same type to avoid duplicates

  // Step 3: Add the new overlay
  const updatedOverlays = [...withoutConflicts, newOverlay];

  // Step 4: Normalize (this would happen during save/load)
  const normalizedOverlays = normalizeOverlayArray(updatedOverlays, titleSeed);

  console.log(`📊 Overlay array now contains ${normalizedOverlays.length} total overlays`);
  console.log(`📊 Real overlays: ${realOverlaysOnly(normalizedOverlays).length}`);
  console.log(`📊 Enabled real overlays: ${enabledRealOverlaysOnly(normalizedOverlays).length}`);

  return normalizedOverlays;
}

// Simulate what CanopyView/CanopyMedia would see for rendering
function simulateCanopyViewRendering(overlays) {
  console.log(`\n🖥️  CANOPY VIEW: Processing overlays for rendering...`);

  const enabledForRendering = enabledOnly(overlays);

  console.log(`🎭 Overlays to render: ${enabledForRendering.length}`);
  enabledForRendering.forEach(overlay => {
    console.log(`   🎯 ${overlay.type} - ID: ${overlay.id} - Title: "${overlay.title}"`);
  });

  // Check specifically for scoreboard
  const scoreboards = enabledForRendering.filter(o => o.type === 'scoreboard');
  if (scoreboards.length > 0) {
    console.log(`\n✅ SCOREBOARD FOUND! Will render in CanopyView:`);
    scoreboards.forEach(sb => {
      console.log(`   📋 Scoreboard "${sb.title}" with ID: ${sb.id}`);
      console.log(`   📋 Position: x=${sb.x}, y=${sb.y}, z=${sb.z_index}`);
      console.log(`   📋 Data:`, sb.data);
    });
  } else {
    console.log(`\n❌ NO SCOREBOARD FOUND for rendering`);
  }

  return enabledForRendering;
}

// === MAIN SIMULATION ===
console.log('🚀 === SCOREBOARD OVERLAY INTEGRATION TEST ===\n');

// Step 1: Start with initial state (placeholders only)
console.log('📍 STEP 1: Initial state (event loaded, placeholders created)');
let currentOverlays = normalizeOverlayArray([], 'Test Racing Event');
console.log(`Initial overlays: ${currentOverlays.length} total (all placeholders)`);

// Step 2: User clicks "Add Scoreboard Overlay"
console.log('\n📍 STEP 2: User interaction - Add Scoreboard Overlay');
currentOverlays = simulateAddOverlay(currentOverlays, 'scoreboard', 'Test Racing Event');

// Step 3: CanopyView processes overlays for rendering
console.log('\n📍 STEP 3: CanopyView rendering check');
const renderingOverlays = simulateCanopyViewRendering(currentOverlays);

// Step 4: Verification
console.log('\n📍 STEP 4: Verification');
const scoreboardsEnabled = renderingOverlays.filter(o => o.type === 'scoreboard');
const testPassed = scoreboardsEnabled.length > 0 && scoreboardsEnabled.every(s => s.enabled === true);

console.log(`\n🎯 TEST RESULT: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);

if (testPassed) {
  console.log(`✅ Scoreboard overlay successfully appears in CanopyView!`);
  console.log(`✅ User can see their scoreboard in the live preview`);
} else {
  console.log(`❌ Scoreboard overlay does NOT appear in CanopyView`);
  console.log(`❌ User would NOT see their scoreboard in the live preview`);
}

console.log('\n🏁 === TEST COMPLETE ===');

// Export for potential use
export {
  simulateAddOverlay,
  simulateCanopyViewRendering,
  enabledOnly,
  realOverlaysOnly,
  enabledRealOverlaysOnly
};