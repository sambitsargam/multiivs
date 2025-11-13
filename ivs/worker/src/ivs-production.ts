/**
 * PRODUCTION Encrypted IVS with Proper Scale Management
 * Real implementation - no mocks
 */

import * as CKKS from './ckks-production';

export interface DiseaseData {
  diseaseId: string;
  users: string[];
  contacts: Map<string, string[]>;
  encryptedHealth: Map<string, any>;
}

/**
 * PRODUCTION: Compute encrypted IVS with proper CKKS scale handling
 */
export async function computeEncryptedIVSProduction(
  diseaseData: DiseaseData,
  Dmax: number = 3,
  jointPublicKey?: any
): Promise<Map<string, any>> {
  console.log(`\n🔐 [PRODUCTION] Computing encrypted IVS for ${diseaseData.diseaseId}`);
  console.log(`   Users: ${diseaseData.users.length}, Dmax: ${Dmax}`);

  const { users, contacts, encryptedHealth } = diseaseData;
  const ivsScores = new Map<string, any>();

  // For each user as source, compute their IVS
  for (const source of users) {
    console.log(`\n  📍 Source: ${source}`);
    
    // BFS from this source
    let frontier = new Set([source]);
    const visited = new Set<string>();
    
    // Collect all ciphertexts and weights for weighted sum
    const contributingCiphertexts: any[] = [];
    const contributingWeights: number[] = [];

    for (let depth = 0; depth <= Dmax && frontier.size > 0; depth++) {
      const weight = 1 / Math.pow(2, depth + 1);
      console.log(`    Depth ${depth}: ${frontier.size} nodes, weight=${weight.toFixed(6)}`);

      const nextFrontier = new Set<string>();

      for (const node of frontier) {
        if (visited.has(node)) continue;
        visited.add(node);

        const encHealthStatus = encryptedHealth.get(node);
        if (!encHealthStatus) {
          console.log(`      ⚠️  No health data for ${node}, skipping`);
          continue;
        }

        // Collect this contribution
        contributingCiphertexts.push(encHealthStatus);
        contributingWeights.push(weight);
        console.log(`      ✓ Added ${node} (weight=${weight.toFixed(6)})`);

        // Expand frontier
        const neighbors = contacts.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            nextFrontier.add(neighbor);
          }
        }
      }

      frontier = nextFrontier;
    }

    // Now compute weighted sum ALL AT ONCE (avoid incremental addition scale issues)
    console.log(`\n  🧮 Computing weighted sum for ${source} (${contributingCiphertexts.length} terms)`);
    
    if (contributingCiphertexts.length === 0) {
      // No contributions - encrypted zero
      ivsScores.set(source, CKKS.encryptZero(jointPublicKey));
      console.log(`  📊 ${source}: No contributions, IVS = encrypted(0)`);
    } else {
      const sourceIVS = CKKS.weightedSumProduction(contributingCiphertexts, contributingWeights);
      ivsScores.set(source, sourceIVS);
      
      const info = CKKS.getCiphertextInfo(sourceIVS);
      console.log(`  📊 ${source}: IVS computed (scale=${info.scale.toFixed(2)}, size=${info.size} bytes)`);
    }
  }

  console.log(`\n✅ Encrypted IVS computation complete for ${diseaseData.diseaseId}`);
  return ivsScores;
}

/**
 * PRODUCTION: Aggregate encrypted IVS across diseases
 */
export async function aggregateEncryptedIVSProduction(
  perDiseaseIVS: Map<string, Map<string, any>>,
  users: string[]
): Promise<Map<string, any>> {
  console.log(`\n📊 [PRODUCTION] Aggregating encrypted IVS across ${perDiseaseIVS.size} diseases`);

  const aggregatedIVS = new Map<string, any>();

  for (const user of users) {
    console.log(`\n  👤 Aggregating for ${user}...`);
    
    const diseaseContributions: any[] = [];
    
    for (const [diseaseId, ivsMap] of perDiseaseIVS.entries()) {
      const diseaseIVS = ivsMap.get(user);
      if (diseaseIVS) {
        diseaseContributions.push(diseaseIVS);
        const info = CKKS.getCiphertextInfo(diseaseIVS);
        console.log(`    ${diseaseId}: scale=${info.scale.toFixed(2)}, size=${info.size} bytes`);
      }
    }

    if (diseaseContributions.length === 0) {
      aggregatedIVS.set(user, CKKS.encryptZero());
      console.log(`    Result: encrypted(0)`);
    } else {
      // Add all disease contributions
      let totalIVS = diseaseContributions[0];
      for (let i = 1; i < diseaseContributions.length; i++) {
        totalIVS = CKKS.addVectors(totalIVS, diseaseContributions[i]);
      }
      
      aggregatedIVS.set(user, totalIVS);
      const info = CKKS.getCiphertextInfo(totalIVS);
      console.log(`    ✅ Total IVS: scale=${info.scale.toFixed(2)}, size=${info.size} bytes`);
    }
  }

  console.log(`\n✅ Aggregation complete for ${users.length} users`);
  return aggregatedIVS;
}

/**
 * PRODUCTION Multi-Disease IVS Computer
 */
export interface MultiDiseaseConfig {
  diseases: DiseaseData[];
  Dmax: number;
  jointPublicKey?: any;
  enableAggregation: boolean;
}

export interface MultiDiseaseOutput {
  perDiseaseIVS: Map<string, Map<string, any>>;
  aggregatedIVS?: Map<string, any>;
  metadata: {
    timestamp: number;
    totalUsers: number;
    diseases: string[];
    Dmax: number;
  };
}

export class ProductionMultiDiseaseIVS {
  private config: MultiDiseaseConfig;
  private allUsers: Set<string>;

  constructor(config: MultiDiseaseConfig) {
    this.config = config;
    this.allUsers = new Set();
    for (const disease of config.diseases) {
      disease.users.forEach(u => this.allUsers.add(u));
    }
  }

  async compute(): Promise<MultiDiseaseOutput> {
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 [PRODUCTION] Multi-Disease IVS with MHE');
    console.log('═'.repeat(70));
    console.log(`   Diseases: ${this.config.diseases.length}`);
    console.log(`   Total users: ${this.allUsers.size}`);
    console.log(`   Dmax: ${this.config.Dmax}`);
    console.log(`   Aggregation: ${this.config.enableAggregation ? 'ON' : 'OFF'}`);
    console.log('═'.repeat(70));

    const perDiseaseIVS = new Map<string, Map<string, any>>();

    // Phase 1: Per-disease IVS
    console.log('\n📍 Phase 1: Per-Disease IVS Computation');
    for (const disease of this.config.diseases) {
      const ivsMap = await computeEncryptedIVSProduction(
        disease,
        this.config.Dmax,
        this.config.jointPublicKey
      );
      perDiseaseIVS.set(disease.diseaseId, ivsMap);
    }

    // Phase 2: Cross-disease aggregation
    let aggregatedIVS: Map<string, any> | undefined;
    if (this.config.enableAggregation) {
      console.log('\n📍 Phase 2: Cross-Disease Aggregation');
      aggregatedIVS = await aggregateEncryptedIVSProduction(
        perDiseaseIVS,
        Array.from(this.allUsers)
      );
    }

    console.log('\n✅ [PRODUCTION] Multi-Disease IVS Complete');
    console.log('═'.repeat(70) + '\n');

    return {
      perDiseaseIVS,
      aggregatedIVS,
      metadata: {
        timestamp: Date.now(),
        totalUsers: this.allUsers.size,
        diseases: this.config.diseases.map(d => d.diseaseId),
        Dmax: this.config.Dmax
      }
    };
  }

  getAllUsers(): string[] {
    return Array.from(this.allUsers);
  }
}

/**
 * PRODUCTION demo with real encrypted computation
 */
export async function demoProductionMHE(): Promise<void> {
  console.log('\n🎯 [PRODUCTION] Multi-Disease MHE-IVS Demo\n');

  await CKKS.initCKKSMHE();

  // Test data
  const users = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank'];
  
  // COVID-19
  const diseaseA: DiseaseData = {
    diseaseId: 'COVID-19',
    users: users,
    contacts: new Map([
      ['Alice', ['Bob', 'Charlie']],
      ['Bob', ['Alice', 'David', 'Eve']],
      ['Charlie', ['Alice', 'Frank']],
      ['David', ['Bob']],
      ['Eve', ['Bob', 'Frank']],
      ['Frank', ['Charlie', 'Eve']]
    ]),
    encryptedHealth: new Map()
  };

  const healthA = new Map([
    ['Alice', 1], ['Bob', 0], ['Charlie', 0],
    ['David', 1], ['Eve', 0], ['Frank', 0]
  ]);
  
  console.log('🔐 Encrypting COVID-19 health status:');
  for (const [user, status] of healthA.entries()) {
    diseaseA.encryptedHealth.set(user, CKKS.encryptScalar(status));
    console.log(`  ${status === 1 ? '🔴' : '🟢'} ${user}: encrypted(${status})`);
  }

  // Influenza
  const diseaseB: DiseaseData = {
    diseaseId: 'Influenza',
    users: users,
    contacts: new Map([
      ['Alice', ['Bob']],
      ['Bob', ['Alice', 'Charlie', 'Eve']],
      ['Charlie', ['Bob', 'David']],
      ['David', ['Charlie', 'Frank']],
      ['Eve', ['Bob', 'Frank']],
      ['Frank', ['David', 'Eve']]
    ]),
    encryptedHealth: new Map()
  };

  const healthB = new Map([
    ['Alice', 0], ['Bob', 1], ['Charlie', 1],
    ['David', 0], ['Eve', 0], ['Frank', 0]
  ]);
  
  console.log('\n🔐 Encrypting Influenza health status:');
  for (const [user, status] of healthB.entries()) {
    diseaseB.encryptedHealth.set(user, CKKS.encryptScalar(status));
    console.log(`  ${status === 1 ? '🔴' : '🟢'} ${user}: encrypted(${status})`);
  }

  // Compute
  const config: MultiDiseaseConfig = {
    diseases: [diseaseA, diseaseB],
    Dmax: 2,
    enableAggregation: true
  };

  const computer = new ProductionMultiDiseaseIVS(config);
  const output = await computer.compute();

  // Decrypt and display results (in production, would require threshold decryption)
  console.log('\n📊 RESULTS (Decrypted for verification):');
  console.log('═'.repeat(70));
  
  for (const user of users) {
    console.log(`\n👤 ${user}:`);
    
    // COVID-19 IVS
    const covidIVS = output.perDiseaseIVS.get('COVID-19')?.get(user);
    if (covidIVS) {
      const covidScore = CKKS.decryptScalar(covidIVS);
      console.log(`   COVID-19: ${covidScore.toFixed(6)}`);
    }
    
    // Influenza IVS
    const fluIVS = output.perDiseaseIVS.get('Influenza')?.get(user);
    if (fluIVS) {
      const fluScore = CKKS.decryptScalar(fluIVS);
      console.log(`   Influenza: ${fluScore.toFixed(6)}`);
    }
    
    // Aggregated IVS
    if (output.aggregatedIVS) {
      const aggIVS = output.aggregatedIVS.get(user);
      if (aggIVS) {
        const aggScore = CKKS.decryptScalar(aggIVS);
        console.log(`   TOTAL: ${aggScore.toFixed(6)} ⭐`);
      }
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('✅ [PRODUCTION] Demo complete - All operations on encrypted data!');
  console.log('═'.repeat(70) + '\n');
}

export default {
  computeEncryptedIVSProduction,
  aggregateEncryptedIVSProduction,
  ProductionMultiDiseaseIVS,
  demoProductionMHE
};
