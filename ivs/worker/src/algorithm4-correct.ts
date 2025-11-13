/**
 * CORRECT Algorithm 4 Implementation
 * Level-synchronous BFS with proper weight calculation
 * 
 * Reference example (6 users, Dmax=2):
 * Users: U1-U6
 * Contacts: U1-U2, U2-U3, U2-U5, U3-U4, U3-U6
 * 
 * Disease A (infected): U2=1, U6=1 (others 0)
 * Disease B (infected): U1=1, U5=1 (others 0)
 * 
 * Expected IVS_A: U1=0.25, U2=0.625, U3=0.50, U4=0.25, U5=0.25, U6=0.625
 * Expected IVS_B: U1=0.625, U2=0.50, U3=0.25, U4=0.00, U5=0.625, U6=0.00
 * Expected Total: U1=0.875, U2=1.125, U3=0.75, U4=0.25, U5=0.875, U6=0.625
 */

/**
 * PLAINTEXT version - for verification and testing
 */
export function computeIVSPlaintext(
  users: string[],
  contacts: Map<string, string[]>,
  infected: Map<string, 0 | 1>,
  Dmax: number
): Map<string, number> {
  const ivs = new Map<string, number>();
  for (const s of users) ivs.set(s, 0);

  for (const s of users) {
    const visited = new Set<string>([s]);
    let frontier: string[] = [s];

    for (let depth = 0; depth <= Dmax && frontier.length > 0; depth++) {
      const w = 1 / Math.pow(2, depth + 1);

      // Add contributions from nodes at current depth
      for (const u of frontier) {
        const h = infected.get(u) ?? 0;
        ivs.set(s, (ivs.get(s) || 0) + w * h);
      }

      // Build next frontier
      const next: string[] = [];
      for (const u of frontier) {
        for (const v of (contacts.get(u) || [])) {
          if (!visited.has(v)) {
            visited.add(v);
            next.push(v);
          }
        }
      }
      frontier = next;
    }
  }
  return ivs;
}

/**
 * Test with the 6-user example
 */
export function testAlgorithm4(): void {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 Testing CORRECT Algorithm 4');
  console.log('═'.repeat(70));

  // Setup
  const users = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6'];
  
  const contacts = new Map<string, string[]>([
    ['U1', ['U2']],
    ['U2', ['U1', 'U3', 'U5']],
    ['U3', ['U2', 'U4', 'U6']],
    ['U4', ['U3']],
    ['U5', ['U2']],
    ['U6', ['U3']]
  ]);

  const Dmax = 2;

  // Disease A: U2=1, U6=1
  const infectedA = new Map<string, 0 | 1>([
    ['U1', 0], ['U2', 1], ['U3', 0],
    ['U4', 0], ['U5', 0], ['U6', 1]
  ]);

  // Disease B: U1=1, U5=1
  const infectedB = new Map<string, 0 | 1>([
    ['U1', 1], ['U2', 0], ['U3', 0],
    ['U4', 0], ['U5', 1], ['U6', 0]
  ]);

  console.log('\n📊 Test Setup:');
  console.log(`   Users: ${users.join(', ')}`);
  console.log(`   Dmax: ${Dmax}`);
  console.log(`   Weights: w(0)=0.5, w(1)=0.25, w(2)=0.125`);
  
  console.log('\n🦠 Disease A infected: U2, U6');
  console.log('🦠 Disease B infected: U1, U5');

  // Compute IVS
  console.log('\n📍 Computing IVS for Disease A...');
  const ivsA = computeIVSPlaintext(users, contacts, infectedA, Dmax);

  console.log('\n📍 Computing IVS for Disease B...');
  const ivsB = computeIVSPlaintext(users, contacts, infectedB, Dmax);

  // Display results
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTS');
  console.log('═'.repeat(70));
  console.log('\n| User | IVS_A  | IVS_B  | Total  | Expected Total |');
  console.log('|------|--------|--------|--------|----------------|');

  const expectedTotal = new Map([
    ['U1', 0.875], ['U2', 1.125], ['U3', 0.75],
    ['U4', 0.25], ['U5', 0.875], ['U6', 0.625]
  ]);

  let allCorrect = true;
  for (const user of users) {
    const scoreA = ivsA.get(user) || 0;
    const scoreB = ivsB.get(user) || 0;
    const total = scoreA + scoreB;
    const expected = expectedTotal.get(user) || 0;
    const match = Math.abs(total - expected) < 0.001 ? '✅' : '❌';
    
    if (Math.abs(total - expected) >= 0.001) allCorrect = false;

    console.log(
      `| ${user.padEnd(4)} | ${scoreA.toFixed(3).padStart(6)} | ` +
      `${scoreB.toFixed(3).padStart(6)} | ${total.toFixed(3).padStart(6)} | ` +
      `${expected.toFixed(3).padStart(14)} ${match} |`
    );
  }

  console.log('═'.repeat(70));
  
  if (allCorrect) {
    console.log('✅ ALL TESTS PASSED! Algorithm 4 is CORRECT!');
  } else {
    console.log('❌ TESTS FAILED! Check algorithm implementation.');
  }
  console.log('═'.repeat(70) + '\n');
}

/**
 * Demo with original 5-user example for comparison
 */
export function testOriginal5Users(): void {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 Testing with Original 5-User Example');
  console.log('═'.repeat(70));

  const users = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
  
  const contacts = new Map<string, string[]>([
    ['Alice', ['Bob', 'Charlie']],
    ['Bob', ['Alice', 'David']],
    ['Charlie', ['Alice', 'Eve']],
    ['David', ['Bob']],
    ['Eve', ['Charlie']]
  ]);

  // Alice and Charlie infected
  const infected = new Map<string, 0 | 1>([
    ['Alice', 1], ['Bob', 0], ['Charlie', 1],
    ['David', 0], ['Eve', 0]
  ]);

  const Dmax = 3;

  console.log('\n📊 Setup:');
  console.log(`   Users: ${users.join(', ')}`);
  console.log(`   Infected: Alice, Charlie`);
  console.log(`   Dmax: ${Dmax}`);

  const ivs = computeIVSPlaintext(users, contacts, infected, Dmax);

  console.log('\n📊 Results:');
  console.log('═'.repeat(70));
  
  const expected = new Map([
    ['Alice', 0.75], ['Charlie', 0.75], ['Bob', 0.375],
    ['Eve', 0.375], ['David', 0.125]
  ]);

  for (const user of users) {
    const score = ivs.get(user) || 0;
    const exp = expected.get(user) || 0;
    const match = Math.abs(score - exp) < 0.001 ? '✅' : '❌';
    console.log(`   ${user.padEnd(10)}: ${score.toFixed(6)} (expected: ${exp.toFixed(6)}) ${match}`);
  }
  
  console.log('═'.repeat(70) + '\n');
}

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  testAlgorithm4();
  testOriginal5Users();
}

export default {
  computeIVSPlaintext,
  testAlgorithm4,
  testOriginal5Users
};
