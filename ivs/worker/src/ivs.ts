/**
 * Algorithm 4: Level-synchronous BFS with exponential decay
 * Computes Individual Vulnerability Score (IVS) for each user
 */
export function computeIVS(
  users: string[],
  contacts: Map<string, string[]>,
  infected: Map<string, number>, // 0 or 1
  Dmax: number
): Map<string, number> {
  const ivs = new Map<string, number>();
  
  // Initialize IVS to 0 for all users
  for (const user of users) {
    ivs.set(user, 0);
  }

  // For each user as source node
  for (const s of users) {
    const visited = new Set<string>([s]);
    let frontier: string[] = [s];

    // BFS with depth limit Dmax
    for (let depth = 0; depth <= Dmax && frontier.length > 0; depth++) {
      // Weight decays exponentially with distance
      const weight = 1 / Math.pow(2, depth + 1);

      // Accumulate weighted infection status from current frontier
      for (const u of frontier) {
        const infectionStatus = infected.get(u) || 0;
        const currentIVS = ivs.get(s) || 0;
        ivs.set(s, currentIVS + weight * infectionStatus);
      }

      // Expand frontier to next level
      const nextFrontier: string[] = [];
      for (const u of frontier) {
        const neighbors = contacts.get(u) || [];
        for (const v of neighbors) {
          if (!visited.has(v)) {
            visited.add(v);
            nextFrontier.push(v);
          }
        }
      }
      frontier = nextFrontier;
    }
  }

  return ivs;
}

/**
 * Pretty print IVS results
 */
export function printIVS(ivs: Map<string, number>): void {
  console.log('\n========================================');
  console.log('Individual Vulnerability Scores (IVS)');
  console.log('========================================');
  
  const sorted = Array.from(ivs.entries()).sort((a, b) => b[1] - a[1]);
  
  for (const [user, score] of sorted) {
    const truncatedUser = user.length > 16 ? user.substring(0, 16) + '...' : user;
    console.log(`${truncatedUser.padEnd(20)} IVS: ${score.toFixed(6)}`);
  }
  console.log('========================================\n');
}
