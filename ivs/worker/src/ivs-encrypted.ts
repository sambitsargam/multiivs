/**
 * Encrypted IVS Computation with Multi-Party Homomorphic Encryption
 * 
 * Implements Algorithm 4 (level-synchronous BFS) entirely on encrypted data:
 * - Encrypted health status inputs
 * - Homomorphic weight multiplication (plaintext weights)
 * - Plaintext contact graph for BFS traversal
 * - Per-disease encrypted IVS output
 * - Cross-disease encrypted aggregation
 */

import * as CKKS from './ckks-mhe';
import { MHECoordinator, KeyShare } from './mhe';

export interface EncryptedHealthData {
  userId: string;
  encryptedStatus: any; // CKKS ciphertext
  cid: string;          // IPFS CID for encrypted blob
}

export interface EncryptedIVSResult {
  userId: string;
  encryptedIVS: any;    // CKKS ciphertext
  cid: string;          // IPFS CID
  disease?: string;     // Optional disease identifier
}

export interface DiseaseData {
  diseaseId: string;
  users: string[];
  contacts: Map<string, string[]>;
  encryptedHealth: Map<string, any>; // userId → encrypted health status
}

/**
 * Compute encrypted IVS for a single disease using Algorithm 4
 * All operations on ciphertexts, only graph structure is plaintext
 */
export async function computeEncryptedIVS(
  diseaseData: DiseaseData,
  Dmax: number = 3,
  jointPublicKey?: any
): Promise<Map<string, any>> {
  console.log(`\n🔐 Computing encrypted IVS for ${diseaseData.diseaseId}`);
  console.log(`   Users: ${diseaseData.users.length}, Dmax: ${Dmax}`);

  const { users, contacts, encryptedHealth } = diseaseData;
  const ivsScores = new Map<string, any>();

  // For each user as source, run BFS and accumulate IVS
  for (const source of users) {
    console.log(`\n  Processing source: ${source}`);
    
    // Start with encrypted zero for this source's IVS
    let sourceIVS = CKKS.encryptZero(jointPublicKey);
    
    // Level-synchronous BFS
    let frontier = new Set([source]);
    const visited = new Set<string>();

    for (let depth = 0; depth <= Dmax && frontier.size > 0; depth++) {
      const weight = 1 / Math.pow(2, depth + 1);
      console.log(`    Depth ${depth}: ${frontier.size} nodes, weight=${weight.toFixed(4)}`);

      const nextFrontier = new Set<string>();

      for (const node of frontier) {
        if (visited.has(node)) continue;
        visited.add(node);

        // Get encrypted health status
        const encHealthStatus = encryptedHealth.get(node);
        if (!encHealthStatus) continue;

        // Homomorphic: IVS[source] += encHealth[node] * weight
        // Clone to avoid modifying original ciphertext
        const healthClone = CKKS.cloneCiphertext(encHealthStatus);
        const weightedHealth = CKKS.multiplyByPlain(healthClone, weight);
        sourceIVS = CKKS.add(sourceIVS, weightedHealth);

        // Expand frontier (plaintext graph traversal)
        const neighbors = contacts.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            nextFrontier.add(neighbor);
          }
        }
      }

      frontier = nextFrontier;
    }
    
    // Store the accumulated IVS for this source
    ivsScores.set(source, sourceIVS);
  }

  console.log(`  ✓ Encrypted IVS computation complete for ${users.length} users`);
  return ivsScores;
}

/**
 * Aggregate encrypted IVS scores across multiple diseases
 * Homomorphic addition: IVS_total = IVS_A + IVS_B + ...
 */
export async function aggregateEncryptedIVS(
  perDiseaseIVS: Map<string, Map<string, any>>, // disease → (user → encrypted IVS)
  users: string[]
): Promise<Map<string, any>> {
  console.log(`\n📊 Aggregating encrypted IVS across ${perDiseaseIVS.size} diseases`);

  const aggregatedIVS = new Map<string, any>();

  for (const user of users) {
    // Start with encrypted zero
    let totalIVS = CKKS.encryptZero();

    // Add each disease's contribution
    for (const [diseaseId, ivsMap] of perDiseaseIVS.entries()) {
      const diseaseIVS = ivsMap.get(user);
      if (diseaseIVS) {
        CKKS.addInplace(totalIVS, diseaseIVS);
      }
    }

    aggregatedIVS.set(user, totalIVS);
  }

  console.log(`  ✓ Aggregated IVS for ${users.length} users`);
  return aggregatedIVS;
}

/**
 * Batch encrypt health status for multiple users
 * Uses vector packing for efficiency
 */
export async function batchEncryptHealthStatus(
  healthMap: Map<string, number>, // userId → 0/1 health status
  userOrder: string[],
  jointPublicKey?: any
): Promise<any> {
  console.log(`\n🔐 Batch encrypting health status for ${userOrder.length} users`);
  
  const healthValues = userOrder.map(user => healthMap.get(user) || 0);
  const encrypted = CKKS.encryptVector(healthValues, jointPublicKey);
  
  const size = CKKS.getCiphertextSize(encrypted);
  console.log(`  ✓ Encrypted ${userOrder.length} values (${size} bytes)`);
  console.log(`  ✓ Compression: ${(size / userOrder.length).toFixed(0)} bytes/user`);
  
  return encrypted;
}

/**
 * Full MHE IVS workflow for multiple diseases
 */
export interface MultiDiseaseIVSConfig {
  diseases: DiseaseData[];
  Dmax: number;
  jointPublicKey?: any;
  enableAggregation: boolean;
}

export interface MultiDiseaseIVSOutput {
  perDiseaseIVS: Map<string, Map<string, any>>;  // disease → user → encrypted IVS
  aggregatedIVS?: Map<string, any>;               // user → encrypted total IVS
  cids: {
    perDisease: Map<string, Map<string, string>>; // disease → user → CID
    aggregated?: Map<string, string>;              // user → CID
  };
  metadata: {
    timestamp: number;
    totalUsers: number;
    diseases: string[];
    Dmax: number;
    encryptionKey: string; // Joint PK identifier
  };
}

export class MultiDiseaseIVSComputer {
  private config: MultiDiseaseIVSConfig;
  private allUsers: Set<string>;

  constructor(config: MultiDiseaseIVSConfig) {
    this.config = config;
    
    // Collect all unique users across diseases
    this.allUsers = new Set();
    for (const disease of config.diseases) {
      disease.users.forEach(u => this.allUsers.add(u));
    }
  }

  /**
   * Run full computation pipeline
   */
  async compute(): Promise<MultiDiseaseIVSOutput> {
    console.log('\n' + '═'.repeat(70));
    console.log('🚀 Multi-Disease IVS with MHE');
    console.log('═'.repeat(70));
    console.log(`   Diseases: ${this.config.diseases.length}`);
    console.log(`   Total users: ${this.allUsers.size}`);
    console.log(`   Dmax: ${this.config.Dmax}`);
    console.log(`   Aggregation: ${this.config.enableAggregation ? 'ON' : 'OFF'}`);
    console.log('═'.repeat(70));

    const perDiseaseIVS = new Map<string, Map<string, any>>();

    // Step 1: Compute encrypted IVS per disease
    console.log('\n📍 Phase 1: Per-Disease IVS Computation');
    for (const disease of this.config.diseases) {
      const ivsMap = await computeEncryptedIVS(
        disease,
        this.config.Dmax,
        this.config.jointPublicKey
      );
      perDiseaseIVS.set(disease.diseaseId, ivsMap);
    }

    // Step 2: Cross-disease aggregation (if enabled)
    let aggregatedIVS: Map<string, any> | undefined;
    if (this.config.enableAggregation) {
      console.log('\n📍 Phase 2: Cross-Disease Aggregation');
      aggregatedIVS = await aggregateEncryptedIVS(
        perDiseaseIVS,
        Array.from(this.allUsers)
      );
    }

    // Step 3: Serialize to CIDs (placeholder - would upload to IPFS)
    console.log('\n📍 Phase 3: Generating CIDs');
    const cids = await this.generateCIDs(perDiseaseIVS, aggregatedIVS);

    const output: MultiDiseaseIVSOutput = {
      perDiseaseIVS,
      aggregatedIVS,
      cids,
      metadata: {
        timestamp: Date.now(),
        totalUsers: this.allUsers.size,
        diseases: this.config.diseases.map(d => d.diseaseId),
        Dmax: this.config.Dmax,
        encryptionKey: 'joint-pk-' + Date.now() // Placeholder
      }
    };

    console.log('\n✅ Multi-Disease IVS Computation Complete');
    console.log('═'.repeat(70) + '\n');

    return output;
  }

  /**
   * Generate IPFS CIDs for encrypted IVS results
   * In production: actually upload to IPFS/Lighthouse
   */
  private async generateCIDs(
    perDiseaseIVS: Map<string, Map<string, any>>,
    aggregatedIVS?: Map<string, any>
  ): Promise<MultiDiseaseIVSOutput['cids']> {
    const perDiseaseCIDs = new Map<string, Map<string, string>>();

    // Generate CIDs per disease
    for (const [diseaseId, ivsMap] of perDiseaseIVS.entries()) {
      const userCIDs = new Map<string, string>();
      
      for (const [userId, encryptedIVS] of ivsMap.entries()) {
        const serialized = CKKS.serializeCiphertext(encryptedIVS);
        const cid = `Qm${diseaseId.substring(0, 3)}${userId.substring(0, 5)}${serialized.substring(0, 20)}`;
        userCIDs.set(userId, cid);
      }
      
      perDiseaseCIDs.set(diseaseId, userCIDs);
      console.log(`   ✓ Generated ${userCIDs.size} CIDs for ${diseaseId}`);
    }

    // Generate CIDs for aggregated IVS
    let aggregatedCIDs: Map<string, string> | undefined;
    if (aggregatedIVS) {
      aggregatedCIDs = new Map();
      
      for (const [userId, encryptedIVS] of aggregatedIVS.entries()) {
        const serialized = CKKS.serializeCiphertext(encryptedIVS);
        const cid = `QmAGG${userId.substring(0, 5)}${serialized.substring(0, 20)}`;
        aggregatedCIDs.set(userId, cid);
      }
      
      console.log(`   ✓ Generated ${aggregatedCIDs.size} aggregated CIDs`);
    }

    return {
      perDisease: perDiseaseCIDs,
      aggregated: aggregatedCIDs
    };
  }

  /**
   * Get all users across all diseases
   */
  getAllUsers(): string[] {
    return Array.from(this.allUsers);
  }
}

/**
 * Demo: Full multi-disease MHE-IVS computation
 */
export async function demoMultiDiseaseIVS(): Promise<void> {
  console.log('\n🎯 Demo: Multi-Disease IVS with MHE\n');

  // Initialize CKKS
  await CKKS.initCKKSMHE();

  // Create test data: 2 diseases, shared users
  const users = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
  
  // Disease A: COVID-like
  const diseaseA: DiseaseData = {
    diseaseId: 'COVID-19',
    users: ['Alice', 'Bob', 'Charlie', 'David'],
    contacts: new Map([
      ['Alice', ['Bob', 'Charlie']],
      ['Bob', ['Alice', 'David']],
      ['Charlie', ['Alice']],
      ['David', ['Bob']]
    ]),
    encryptedHealth: new Map()
  };

  // Encrypt health status for Disease A
  const healthA = new Map([
    ['Alice', 1],   // Infected
    ['Bob', 0],
    ['Charlie', 0],
    ['David', 1]    // Infected
  ]);
  
  for (const [user, status] of healthA.entries()) {
    diseaseA.encryptedHealth.set(user, CKKS.encryptScalar(status));
  }

  // Disease B: Flu-like
  const diseaseB: DiseaseData = {
    diseaseId: 'Influenza',
    users: ['Bob', 'Charlie', 'David', 'Eve'],
    contacts: new Map([
      ['Bob', ['Charlie', 'Eve']],
      ['Charlie', ['Bob', 'David']],
      ['David', ['Charlie']],
      ['Eve', ['Bob']]
    ]),
    encryptedHealth: new Map()
  };

  // Encrypt health status for Disease B
  const healthB = new Map([
    ['Bob', 1],      // Infected
    ['Charlie', 1],  // Infected
    ['David', 0],
    ['Eve', 0]
  ]);
  
  for (const [user, status] of healthB.entries()) {
    diseaseB.encryptedHealth.set(user, CKKS.encryptScalar(status));
  }

  // Configure and run computation
  const config: MultiDiseaseIVSConfig = {
    diseases: [diseaseA, diseaseB],
    Dmax: 2,
    enableAggregation: true
  };

  const computer = new MultiDiseaseIVSComputer(config);
  const output = await computer.compute();

  // Display results (would need decryption in production)
  console.log('\n📊 Output Summary:');
  console.log(`   - Per-disease IVS: ${output.perDiseaseIVS.size} diseases`);
  console.log(`   - Aggregated IVS: ${output.aggregatedIVS ? 'Available' : 'Not computed'}`);
  console.log(`   - Total CIDs: ${Array.from(output.cids.perDisease.values()).reduce((sum, m) => sum + m.size, 0)}`);
  console.log(`   - Timestamp: ${new Date(output.metadata.timestamp).toISOString()}`);
  
  console.log('\n🔐 All computations performed on encrypted data!');
  console.log('   No plaintext health status or IVS values were exposed.\n');
}

export default {
  computeEncryptedIVS,
  aggregateEncryptedIVS,
  batchEncryptHealthStatus,
  MultiDiseaseIVSComputer,
  demoMultiDiseaseIVS
};
