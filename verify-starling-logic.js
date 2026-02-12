/**
 * Simple verification of starling frontal arc shooting logic
 * This validates the mathematical correctness of the angle checks
 */

console.log('=== Verifying Starling Frontal Arc Logic ===\n');

// Simulate the canShootTarget logic
function canShootTarget(
    velocityX,
    velocityY,
    starlingX,
    starlingY,
    targetX,
    targetY
) {
    // Calculate velocity magnitude
    const velocityMagnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    
    // If stationary, can shoot in any direction
    const stationaryThreshold = 1.0;
    if (velocityMagnitude < stationaryThreshold) {
        return true;
    }
    
    // Moving - check if target is in frontal arc
    const velocityDirX = velocityX / velocityMagnitude;
    const velocityDirY = velocityY / velocityMagnitude;
    
    // Calculate direction to target
    const toTargetX = targetX - starlingX;
    const toTargetY = targetY - starlingY;
    const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);
    
    if (toTargetDist <= 0) {
        return true;
    }
    
    const toTargetDirX = toTargetX / toTargetDist;
    const toTargetDirY = toTargetY / toTargetDist;
    
    // Calculate dot product
    const dotProduct = velocityDirX * toTargetDirX + velocityDirY * toTargetDirY;
    
    // For 180-degree arc, we need dot product >= 0 (within ±90 degrees from movement direction)
    return dotProduct >= 0;
}

// Test 1: Stationary starling
console.log('Test 1: Stationary starling (velocity = 0)');
const test1 = canShootTarget(0, 0, 100, 100, 50, 100); // Target behind
console.log(`  Can shoot target behind when stationary: ${test1}`);
console.log(`  Expected: true, Got: ${test1} - ${test1 === true ? 'PASS' : 'FAIL'}\n`);

// Test 2: Moving right, target ahead
console.log('Test 2: Moving right (+X), target ahead');
const test2 = canShootTarget(50, 0, 100, 100, 200, 100); // Target to the right
console.log(`  Can shoot target ahead when moving: ${test2}`);
console.log(`  Expected: true, Got: ${test2} - ${test2 === true ? 'PASS' : 'FAIL'}\n`);

// Test 3: Moving right, target behind
console.log('Test 3: Moving right (+X), target behind');
const test3 = canShootTarget(50, 0, 100, 100, 50, 100); // Target to the left
console.log(`  Can shoot target behind when moving: ${test3}`);
console.log(`  Expected: false, Got: ${test3} - ${test3 === false ? 'PASS' : 'FAIL'}\n`);

// Test 4: Moving right, target at 90 degrees (perpendicular)
console.log('Test 4: Moving right (+X), target at 90 degrees (above)');
const test4 = canShootTarget(50, 0, 100, 100, 100, 50); // Target directly above
console.log(`  Can shoot target at 90 degrees: ${test4}`);
console.log(`  Expected: true, Got: ${test4} - ${test4 === true ? 'PASS' : 'FAIL'}\n`);

// Test 5: Moving right, target at 91 degrees (slightly behind perpendicular)
console.log('Test 5: Moving right (+X), target at 91 degrees (slightly behind perpendicular)');
const test5 = canShootTarget(50, 0, 100, 100, 99, 50); // Slightly to the left and above
const angle5 = Math.atan2(50 - 100, 99 - 100) * 180 / Math.PI;
console.log(`  Actual angle from forward: ${90 - angle5} degrees`);
console.log(`  Can shoot target at ${angle5} degrees: ${test5}`);
console.log(`  Expected: false, Got: ${test5} - ${test5 === false ? 'PASS' : 'FAIL'}\n`);

// Test 6: Moving right, target at 45 degrees
console.log('Test 6: Moving right (+X), target at 45 degrees (diagonally forward-right-up)');
const test6 = canShootTarget(50, 0, 100, 100, 150, 50); // 45 degrees forward-right-up
console.log(`  Can shoot target at 45 degrees: ${test6}`);
console.log(`  Expected: true, Got: ${test6} - ${test6 === true ? 'PASS' : 'FAIL'}\n`);

// Test 7: Moving diagonally, target ahead
console.log('Test 7: Moving diagonally (+X, +Y), target ahead diagonally');
const test7 = canShootTarget(35.36, 35.36, 100, 100, 150, 150); // Moving and target both at 45 degrees
console.log(`  Can shoot target ahead when moving diagonally: ${test7}`);
console.log(`  Expected: true, Got: ${test7} - ${test7 === true ? 'PASS' : 'FAIL'}\n`);

// Test 8: Line of sight calculation
console.log('Test 8: Line of sight is 20% more than attack range');
const STARLING_ATTACK_RANGE = 120;
const UNIT_LINE_OF_SIGHT_MULTIPLIER = 1.2;
const expectedLineOfSight = STARLING_ATTACK_RANGE * UNIT_LINE_OF_SIGHT_MULTIPLIER;
console.log(`  Attack range: ${STARLING_ATTACK_RANGE}`);
console.log(`  Line of sight multiplier: ${UNIT_LINE_OF_SIGHT_MULTIPLIER}`);
console.log(`  Expected line of sight: ${expectedLineOfSight}`);
console.log(`  Calculated: ${STARLING_ATTACK_RANGE} * ${UNIT_LINE_OF_SIGHT_MULTIPLIER} = ${expectedLineOfSight}`);
console.log(`  ${expectedLineOfSight === 144 ? 'PASS' : 'FAIL'}\n`);

console.log('=== Summary ===');
const allTests = [test1, test2, !test3, test4, !test5, test6, test7];
const passed = allTests.filter(t => t === true).length;
console.log(`Tests passed: ${passed}/${allTests.length}`);
if (passed === allTests.length) {
    console.log('All tests PASSED! ✓');
} else {
    console.log('Some tests FAILED! ✗');
    process.exit(1);
}
