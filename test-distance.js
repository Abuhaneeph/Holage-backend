// Test script for distance calculator
// Run with: node test-distance.js

import { calculateStateDistance, estimateShippingCost } from './utils/distanceCalculator.js';

console.log('🧪 Testing Distance Calculator\n');
console.log('=' .repeat(60));

// Test 1: Lagos to Abuja
console.log('\n📍 Test 1: Lagos to Abuja');
console.log('-'.repeat(60));
try {
  const result1 = calculateStateDistance('lagos', 'abuja');
  console.log('✅ Success!');
  console.log(`   Distance: ${result1.distance} km`);
  console.log(`   Duration: ${result1.estimatedDuration}`);
  console.log(`   Route: ${result1.route}`);
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 2: Lagos to Kano
console.log('\n📍 Test 2: Lagos to Kano');
console.log('-'.repeat(60));
try {
  const result2 = calculateStateDistance('lagos', 'kano');
  console.log('✅ Success!');
  console.log(`   Distance: ${result2.distance} km`);
  console.log(`   Duration: ${result2.estimatedDuration}`);
  console.log(`   Route: ${result2.route}`);
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 3: Port Harcourt (Rivers) to Calabar (Cross River)
console.log('\n📍 Test 3: Rivers to Cross River');
console.log('-'.repeat(60));
try {
  const result3 = calculateStateDistance('rivers', 'cross-river');
  console.log('✅ Success!');
  console.log(`   Distance: ${result3.distance} km`);
  console.log(`   Duration: ${result3.estimatedDuration}`);
  console.log(`   Route: ${result3.route}`);
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 4: Same state (Lagos to Lagos)
console.log('\n📍 Test 4: Same State (Lagos to Lagos)');
console.log('-'.repeat(60));
try {
  const result4 = calculateStateDistance('lagos', 'lagos');
  console.log('✅ Success!');
  console.log(`   Distance: ${result4.distance} km`);
  console.log(`   Duration: ${result4.estimatedDuration}`);
  console.log(`   Route: ${result4.route}`);
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 5: Cost Estimation with new diesel-based formula
console.log('\n💰 Test 5: Cost Estimation (Lagos to Kano, 15 tons)');
console.log('-'.repeat(60));
try {
  const distance = calculateStateDistance('lagos', 'kano');
  const cost = estimateShippingCost(distance.distance, 15);
  console.log('✅ Success!');
  console.log(`   Distance: ${cost.distance} km`);
  console.log(`   Weight: ${cost.weight} tons`);
  console.log(`   Diesel Rate: ₦${cost.dieselRate.toLocaleString()}/L`);
  console.log(`   Fuel Efficiency: ${cost.fuelEfficiency} km/L`);
  console.log(`   Liters Needed: ${cost.litersNeeded}L`);
  console.log(`   Diesel Cost: ₦${cost.dieselCost.toLocaleString()}`);
  console.log(`   Tonnage Rate: ₦${cost.tonnageRatePerKm}/ton-km`);
  console.log(`   Tonnage Cost: ₦${cost.tonnageCost.toLocaleString()}`);
  console.log(`   Base Service Fee: ₦${cost.baseFee.toLocaleString()}`);
  console.log(`   Total Cost: ${cost.formattedCost}`);
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 5b: Cost Estimation matching the example (Jos to Lagos equivalent)
console.log('\n💰 Test 5b: Example Calculation (similar to Jos-Lagos, 15 tons)');
console.log('-'.repeat(60));
console.log('Using example from documentation:');
console.log('  - Distance: ~1,031 km (simulated)');
console.log('  - Weight: 15 tons (10-20 ton band)');
console.log('  - Diesel: ₦1,200/L');
console.log('  - Fuel Efficiency: 3 km/L');
console.log('  - Base Fee: ₦10,000');
try {
  const cost = estimateShippingCost(1031, 15);
  console.log('\n📊 Calculation:');
  console.log(`   Diesel Cost = (${cost.distance} ÷ ${cost.fuelEfficiency}) × ₦${cost.dieselRate} = ₦${cost.dieselCost.toLocaleString()}`);
  console.log(`   Tonnage Cost = ${cost.weight} × ${cost.distance} × ₦${cost.tonnageRatePerKm} = ₦${cost.tonnageCost.toLocaleString()}`);
  console.log(`   Base Fee = ₦${cost.baseFee.toLocaleString()}`);
  console.log(`   ────────────────────────────────`);
  console.log(`   Total = ${cost.formattedCost}`);
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 6: Invalid state
console.log('\n❌ Test 6: Invalid State (should fail)');
console.log('-'.repeat(60));
try {
  const result6 = calculateStateDistance('lagos', 'invalid-state');
  console.log('❌ Test failed - should have thrown error');
} catch (error) {
  console.log('✅ Correctly caught error:', error.message);
}

// Test 7: Multiple routes comparison
console.log('\n📊 Test 7: Multiple Routes Comparison (10 tons each)');
console.log('-'.repeat(60));
const routes = [
  ['lagos', 'abuja'],
  ['lagos', 'kano'],
  ['lagos', 'enugu'],
  ['abuja', 'kano'],
  ['rivers', 'delta']
];

console.log('\n| From → To                    | Distance | Duration   | Est. Cost (10t) |');
console.log('|------------------------------|----------|------------|-----------------|');

routes.forEach(([from, to]) => {
  try {
    const distance = calculateStateDistance(from, to);
    const cost = estimateShippingCost(distance.distance, 10);
    const fromName = distance.pickupState.padEnd(10);
    const toName = distance.destinationState.padEnd(10);
    const distStr = `${distance.distance} km`.padEnd(8);
    const durStr = distance.estimatedDuration.padEnd(10);
    const costStr = cost.formattedCost;
    console.log(`| ${fromName} → ${toName} | ${distStr} | ${durStr} | ${costStr.padEnd(15)} |`);
  } catch (error) {
    console.log(`| ${from} → ${to} | ERROR |`);
  }
});

// Test 8: Weight bands comparison
console.log('\n📊 Test 8: Weight Band Comparison (Lagos to Kano)');
console.log('-'.repeat(60));
const weights = [3, 7, 15, 25, 35, 45];
const lagosKanoDistance = calculateStateDistance('lagos', 'kano');

console.log('\n| Weight | Band      | Rate/t-km | Diesel Cost | Tonnage Cost | Total Cost   |');
console.log('|--------|-----------|-----------|-------------|--------------|--------------|');

weights.forEach(weight => {
  const cost = estimateShippingCost(lagosKanoDistance.distance, weight);
  const band = weight < 5 ? '<5t' : 
               weight <= 10 ? '5-10t' :
               weight <= 20 ? '10-20t' :
               weight <= 30 ? '20-30t' :
               weight <= 40 ? '30-40t' : '40+t';
  console.log(`| ${String(weight).padEnd(6)} | ${band.padEnd(9)} | ₦${String(cost.tonnageRatePerKm).padEnd(8)} | ₦${String(cost.dieselCost.toLocaleString()).padEnd(10)} | ₦${String(cost.tonnageCost.toLocaleString()).padEnd(11)} | ${cost.formattedCost.padEnd(12)} |`);
});

console.log('\n' + '='.repeat(60));
console.log('✨ Testing complete!\n');

