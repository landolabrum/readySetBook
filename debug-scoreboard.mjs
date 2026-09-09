#!/usr/bin/env node

/**
 * Debug script to test scoreboard overlay creation and enablement
 */

// Simulate the overlay creation flow to debug the issue
const defaultOverlayFor = (type, titleSeed = '', enabled = false) => ({
  id: `${type}-${Date.now()}-${Math.random()}`,
  type: type,
  enabled: enabled,
  x: 1,
  y: 2.5,
  z_index: 1,
  variant: 'default',
  animation: 'none',
  title: type === 'scoreboard' ? titleSeed || 'Scoreboard' : null,
  description: null,
  data: { teams: [] }
});

const coerceEnabled = (raw) => {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'y'].includes(t)) return true;
    if (['false', '0', 'no', 'off', 'n', ''].includes(t)) return false;
  }
  return false;
};

const isPlaceholderOverlay = (ov) => {
  return typeof ov?.id === 'string' && ov.id.startsWith('__default__');
};

console.log('🧪 Testing Scoreboard Overlay Creation Flow...\n');

// Test 1: Default creation
console.log('Test 1: Default overlay creation');
const defaultScoreboard = defaultOverlayFor('scoreboard', 'Test Event');
console.log('Default scoreboard:', defaultScoreboard);
console.log('Coerced enabled:', coerceEnabled(defaultScoreboard.enabled));
console.log('Is placeholder:', isPlaceholderOverlay(defaultScoreboard));
console.log('');

// Test 2: Explicit enabled creation
console.log('Test 2: Explicit enabled overlay creation');
const enabledScoreboard = defaultOverlayFor('scoreboard', 'Test Event', true);
console.log('Enabled scoreboard:', enabledScoreboard);
console.log('Coerced enabled:', coerceEnabled(enabledScoreboard.enabled));
console.log('Is placeholder:', isPlaceholderOverlay(enabledScoreboard));
console.log('');

// Test 3: Override after creation
console.log('Test 3: Override after creation');
const overriddenScoreboard = { ...defaultOverlayFor('scoreboard', 'Test Event'), enabled: true };
console.log('Overridden scoreboard:', overriddenScoreboard);
console.log('Coerced enabled:', coerceEnabled(overriddenScoreboard.enabled));
console.log('Is placeholder:', isPlaceholderOverlay(overriddenScoreboard));
console.log('');

// Test 4: Table filter logic
console.log('Test 4: Table filter logic');
const testOverlays = [
  { id: '__default__scoreboard', type: 'scoreboard', enabled: false },
  enabledScoreboard,
  { id: '__default__ticker', type: 'ticker', enabled: false },
  { id: 'ticker-1', type: 'ticker', enabled: true }
];

console.log('Test overlays:', testOverlays);
console.log('');

const filteredForTable = testOverlays.filter(o => coerceEnabled(o?.enabled) || !isPlaceholderOverlay(o));
console.log('Filtered for table:', filteredForTable);
console.log('');

const scoreboardsInTable = filteredForTable.filter(o => o.type === 'scoreboard');
console.log('Scoreboards in table:', scoreboardsInTable);
console.log('');

console.log('✅ All tests complete!');