// Test script to verify overlay fixes
import {
  enabledOnly,
  realOverlaysOnly,
  enabledRealOverlaysOnly,
  defaultOverlayFor,
  defaultPlaceholderFor,
  normalizeOverlayArray,
  coerceEnabled
} from '../src/modules/apps/Canopy/models/canopyOverlayTypes';

console.log('=== Testing Overlay Fixes ===\n');

// Test 1: Create a real scoreboard overlay like addOverlay does
console.log('1. Testing real scoreboard overlay creation:');
const realScoreboard = { ...defaultOverlayFor('scoreboard', 'Test Event'), enabled: true };
console.log('Real scoreboard:', { id: realScoreboard.id, type: realScoreboard.type, enabled: realScoreboard.enabled });

// Test 2: Create placeholder overlays like normalizeOverlayArray does
console.log('\n2. Testing placeholder creation:');
const placeholder = defaultPlaceholderFor('scoreboard', 'Test Event');
console.log('Placeholder scoreboard:', { id: placeholder.id, type: placeholder.type, enabled: placeholder.enabled });

// Test 3: Test mixed array with both real and placeholder
console.log('\n3. Testing mixed overlay array filtering:');
const mixedOverlays = [realScoreboard, placeholder];
console.log('Input overlays:', mixedOverlays.map(o => ({ id: o.id, type: o.type, enabled: o.enabled })));

const enabledFiltered = enabledOnly(mixedOverlays);
console.log('Enabled only result:', enabledFiltered.map(o => ({ id: o.id, type: o.type, enabled: o.enabled })));

const realOnly = realOverlaysOnly(mixedOverlays);
console.log('Real only result:', realOnly.map(o => ({ id: o.id, type: o.type, enabled: o.enabled })));

const enabledRealOnly = enabledRealOverlaysOnly(mixedOverlays);
console.log('Enabled real only result:', enabledRealOnly.map(o => ({ id: o.id, type: o.type, enabled: o.enabled })));

// Test 4: Test normalization array (what happens in the save pipeline)
console.log('\n4. Testing normalization pipeline:');
const inputArray = [realScoreboard];
const normalized = normalizeOverlayArray(inputArray, 'Test Event');
console.log('Normalized result (should include placeholders for all types):');
console.log('Total overlays after normalization:', normalized.length);
console.log('Scoreboard overlays:', normalized.filter(o => o.type === 'scoreboard').map(o => ({ id: o.id, enabled: o.enabled })));

// Test 5: Test boolean coercion
console.log('\n5. Testing boolean coercion:');
const testValues = [true, false, 'true', 'false', 1, 0, null, undefined, ''];
testValues.forEach(val => {
  console.log(`coerceEnabled(${JSON.stringify(val)}) = ${coerceEnabled(val)}`);
});

console.log('\n=== Test Complete ===');