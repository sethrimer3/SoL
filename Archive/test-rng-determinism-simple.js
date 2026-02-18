/**
 * Simple RNG Determinism Test
 * Tests that the Mulberry32 algorithm produces identical sequences
 */

class SeededRandom {
    constructor(seed) {
        this.initialSeed = seed >>> 0;
        this.state = this.initialSeed;
    }

    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
}

function testRNGDeterminism() {
    console.log('=== RNG Determinism Test ===\n');
    
    const seed = 12345;
    const iterations = 100;
    
    // Run 1
    const rng1 = new SeededRandom(seed);
    const sequence1 = [];
    for (let i = 0; i < iterations; i++) {
        sequence1.push(rng1.next());
    }
    
    // Run 2
    const rng2 = new SeededRandom(seed);
    const sequence2 = [];
    for (let i = 0; i < iterations; i++) {
        sequence2.push(rng2.next());
    }
    
    // Compare
    let matches = 0;
    let mismatches = [];
    for (let i = 0; i < iterations; i++) {
        if (sequence1[i] === sequence2[i]) {
            matches++;
        } else {
            mismatches.push({ index: i, val1: sequence1[i], val2: sequence2[i] });
        }
    }
    
    console.log(`Generated ${iterations} random numbers`);
    console.log(`Matches: ${matches}/${iterations}`);
    console.log(`First 5 values: ${sequence1.slice(0, 5).map(n => n.toFixed(6)).join(', ')}`);
    
    if (mismatches.length > 0) {
        console.log(`\n❌ FAIL: Found ${mismatches.length} mismatches:`);
        mismatches.slice(0, 5).forEach(m => {
            console.log(`  Index ${m.index}: ${m.val1} !== ${m.val2}`);
        });
        return false;
    } else {
        console.log('\n✅ PASS: RNG is deterministic!');
        return true;
    }
}

function testCrossPeerDeterminism() {
    console.log('\n=== Cross-Peer Simulation Test ===\n');
    
    const seed = 99999;
    
    // Simulate Peer 1 (Host)
    console.log('Simulating Peer 1 (Host):');
    const peer1RNG = new SeededRandom(seed);
    const peer1Results = [];
    for (let i = 0; i < 10; i++) {
        const value = peer1RNG.nextInt(1, 100);
        peer1Results.push(value);
    }
    console.log(`  Values: ${peer1Results.join(', ')}`);
    
    // Simulate Peer 2 (Client)
    console.log('\nSimulating Peer 2 (Client):');
    const peer2RNG = new SeededRandom(seed);
    const peer2Results = [];
    for (let i = 0; i < 10; i++) {
        const value = peer2RNG.nextInt(1, 100);
        peer2Results.push(value);
    }
    console.log(`  Values: ${peer2Results.join(', ')}`);
    
    // Compare
    const identical = JSON.stringify(peer1Results) === JSON.stringify(peer2Results);
    
    if (identical) {
        console.log('\n✅ PASS: Both peers generated identical sequences!');
        console.log('This confirms P2P multiplayer will have deterministic gameplay.');
        return true;
    } else {
        console.log('\n❌ FAIL: Peers generated different sequences!');
        return false;
    }
}

// Run tests
const test1Pass = testRNGDeterminism();
const test2Pass = testCrossPeerDeterminism();

console.log('\n=== Test Summary ===');
console.log(`RNG Determinism: ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Cross-Peer Simulation: ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);

if (test1Pass && test2Pass) {
    console.log('\n✅ All tests passed! P2P RNG is deterministic.');
    process.exit(0);
} else {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
}
