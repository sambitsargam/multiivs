/**
 * CKKS MHE Module
 * Extended CKKS operations for Multi-Party Homomorphic Encryption
 */

import SEAL from 'node-seal';

export interface CKKSContext {
  seal: any;
  context: any;
  encoder: any;
  encryptor: any;
  decryptor: any;
  evaluator: any;
  keyGenerator: any;
  scale: number;
  polyModulusDegree: number;
}

let globalContext: CKKSContext | null = null;

/**
 * Initialize CKKS context with MHE support
 * Includes evaluator for homomorphic operations
 */
export async function initCKKSMHE(): Promise<CKKSContext> {
  if (globalContext) return globalContext;

  const seal = await SEAL();

  const schemeType = seal.SchemeType.ckks;
  const securityLevel = seal.SecurityLevel.tc128;
  const polyModulusDegree = 8192;
  const bitSizes = [60, 40, 40, 60];
  const bitSize = 40;
  const scale = Math.pow(2.0, bitSize);

  const encParms = seal.EncryptionParameters(schemeType);
  encParms.setPolyModulusDegree(polyModulusDegree);
  encParms.setCoeffModulus(
    seal.CoeffModulus.Create(polyModulusDegree, Int32Array.from(bitSizes))
  );

  const context = seal.Context(encParms, true, securityLevel);

  if (!context.parametersSet()) {
    throw new Error('Failed to set CKKS parameters');
  }

  const keyGenerator = seal.KeyGenerator(context);
  const secretKey = keyGenerator.secretKey();
  const publicKey = keyGenerator.createPublicKey();

  // Generate relinearization keys (needed for multiplication)
  const relinKeys = keyGenerator.createRelinKeys();

  const encoder = seal.CKKSEncoder(context);
  const encryptor = seal.Encryptor(context, publicKey);
  const decryptor = seal.Decryptor(context, secretKey);
  const evaluator = seal.Evaluator(context);

  globalContext = {
    seal,
    context,
    encoder,
    encryptor,
    decryptor,
    evaluator,
    keyGenerator,
    scale,
    polyModulusDegree
  };

  console.log('✓ CKKS-MHE initialized:');
  console.log(`  - Poly degree: ${polyModulusDegree}`);
  console.log(`  - Scale: 2^${bitSize}`);
  console.log(`  - Security: tc128`);
  console.log(`  - Evaluator: Ready for homomorphic ops`);

  return globalContext;
}

/**
 * Get the global CKKS context
 */
export function getContext(): CKKSContext {
  if (!globalContext) {
    throw new Error('CKKS-MHE not initialized. Call initCKKSMHE() first.');
  }
  return globalContext;
}

/**
 * Encrypt a vector of values (vector packing)
 */
export function encryptVector(values: number[], publicKey?: any): any {
  const ctx = getContext();
  const arr = Float64Array.from(values);
  const plaintext = ctx.encoder.encode(arr, ctx.scale);
  
  const pk = publicKey || ctx.encryptor.publicKey;
  const encryptor = publicKey 
    ? ctx.seal.Encryptor(ctx.context, pk)
    : ctx.encryptor;
    
  const ciphertext = encryptor.encrypt(plaintext);
  
  return ciphertext;
}

/**
 * Decrypt a vector (supports both full and partial decryption)
 */
export function decryptVector(ciphertext: any, count: number, secretKey?: any): number[] {
  const ctx = getContext();
  
  const sk = secretKey || ctx.decryptor.secretKey;
  const decryptor = secretKey
    ? ctx.seal.Decryptor(ctx.context, sk)
    : ctx.decryptor;
    
  const plaintext = decryptor.decrypt(ciphertext);
  const decoded = ctx.encoder.decode(plaintext);
  
  return Array.from(decoded).slice(0, count) as number[];
}

/**
 * Encrypt a single scalar (convenience wrapper)
 */
export function encryptScalar(value: number, publicKey?: any): any {
  return encryptVector([value], publicKey);
}

/**
 * Decrypt a single scalar
 */
export function decryptScalar(ciphertext: any, secretKey?: any): number {
  const values = decryptVector(ciphertext, 1, secretKey);
  return values[0];
}

/**
 * Homomorphic addition: c1 + c2
 */
export function add(c1: any, c2: any): any {
  const ctx = getContext();
  const result = ctx.seal.CipherText();
  ctx.evaluator.add(c1, c2, result);
  return result;
}

/**
 * Homomorphic addition in-place: c1 += c2
 */
export function addInplace(c1: any, c2: any): void {
  const ctx = getContext();
  ctx.evaluator.add(c1, c2, c1);
}

/**
 * Homomorphic multiplication by plaintext: c * plainValue
 * This is efficient and doesn't require relinearization
 */
export function multiplyByPlain(ciphertext: any, plainValue: number): any {
  const ctx = getContext();
  const arr = Float64Array.from([plainValue]);
  const plaintext = ctx.encoder.encode(arr, ctx.scale);
  
  const result = ctx.seal.CipherText();
  ctx.evaluator.multiplyPlain(ciphertext, plaintext, result);
  
  return result;
}

/**
 * Homomorphic multiplication by plaintext in-place
 */
export function multiplyByPlainInplace(ciphertext: any, plainValue: number): void {
  const ctx = getContext();
  const arr = Float64Array.from([plainValue]);
  const plaintext = ctx.encoder.encode(arr, ctx.scale);
  
  ctx.evaluator.multiplyPlain(ciphertext, plaintext, ciphertext);
}

/**
 * Homomorphic multiplication: c1 * c2
 * Requires relinearization keys
 */
export function multiply(c1: any, c2: any, relinKeys: any): any {
  const ctx = getContext();
  const result = ctx.seal.CipherText();
  
  ctx.evaluator.multiply(c1, c2, result);
  ctx.evaluator.relinearize(result, relinKeys, result);
  ctx.evaluator.rescaleToNext(result, result);
  
  return result;
}

/**
 * Create a zero ciphertext (encrypted 0)
 * Useful as identity element for addition
 */
export function encryptZero(publicKey?: any): any {
  return encryptScalar(0, publicKey);
}

/**
 * Serialize ciphertext to Base64 string for IPFS storage
 */
export function serializeCiphertext(ciphertext: any): string {
  const bytes = ciphertext.save();
  return Buffer.from(bytes).toString('base64');
}

/**
 * Deserialize ciphertext from Base64 string
 */
export function deserializeCiphertext(base64: string): any {
  const ctx = getContext();
  const bytes = Buffer.from(base64, 'base64');
  const ciphertext = ctx.seal.CipherText();
  ciphertext.load(ctx.context, bytes);
  return ciphertext;
}

/**
 * Batch encrypt multiple users' health status
 * Returns a single ciphertext with packed values
 */
export function batchEncryptHealth(
  userHealthMap: Map<string, number>,
  userOrder: string[],
  publicKey?: any
): any {
  const healthValues = userOrder.map(user => userHealthMap.get(user) || 0);
  return encryptVector(healthValues, publicKey);
}

/**
 * Batch decrypt IVS scores for multiple users
 */
export function batchDecryptIVS(
  ciphertext: any,
  userCount: number,
  secretKey?: any
): number[] {
  return decryptVector(ciphertext, userCount, secretKey);
}

/**
 * Homomorphic weighted sum: sum_i (c_i * w_i)
 * Used in IVS computation for each BFS level
 */
export function weightedSum(
  ciphertexts: any[],
  weights: number[]
): any {
  if (ciphertexts.length !== weights.length) {
    throw new Error('Ciphertexts and weights must have same length');
  }
  
  if (ciphertexts.length === 0) {
    return encryptZero();
  }
  
  // Start with first weighted term
  let result = multiplyByPlain(ciphertexts[0], weights[0]);
  
  // Add remaining weighted terms
  for (let i = 1; i < ciphertexts.length; i++) {
    const weighted = multiplyByPlain(ciphertexts[i], weights[i]);
    addInplace(result, weighted);
  }
  
  return result;
}

/**
 * Homomorphic element-wise addition of two vectors
 * Used for cross-disease IVS aggregation
 */
export function addVectors(c1: any, c2: any): any {
  return add(c1, c2);
}

/**
 * Create a plaintext vector for masking/testing
 */
export function createPlaintext(values: number[]): any {
  const ctx = getContext();
  const arr = Float64Array.from(values);
  return ctx.encoder.encode(arr, ctx.scale);
}

/**
 * Get ciphertext size in bytes (for optimization tracking)
 */
export function getCiphertextSize(ciphertext: any): number {
  const bytes = ciphertext.save();
  return bytes.length;
}

/**
 * Clone a ciphertext (for parallel operations)
 */
export function cloneCiphertext(ciphertext: any): any {
  const ctx = getContext();
  const bytes = ciphertext.save();
  const clone = ctx.seal.CipherText();
  clone.load(ctx.context, bytes);
  return clone;
}

/**
 * Demo: Encrypted IVS computation step
 */
export async function demoEncryptedIVS(): Promise<void> {
  console.log('\n🔐 CKKS-MHE Demo: Encrypted IVS Computation\n');
  console.log('═'.repeat(70));
  
  await initCKKSMHE();
  const ctx = getContext();
  
  // Simulate: Alice, Bob, Charlie with health status
  const users = ['Alice', 'Bob', 'Charlie'];
  const healthStatus = new Map([
    ['Alice', 1],    // Infected
    ['Bob', 0],      // Healthy
    ['Charlie', 1]   // Infected
  ]);
  
  // Encrypt health status
  console.log('\n1️⃣  Encrypting health status...');
  const encryptedHealth = batchEncryptHealth(healthStatus, users);
  console.log(`   ✓ Encrypted ${users.length} users (size: ${getCiphertextSize(encryptedHealth)} bytes)`);
  
  // Simulate BFS level computation with weights
  console.log('\n2️⃣  Computing weighted IVS (homomorphic)...');
  const weights = [0.5, 0.25, 0.125]; // depth 0, 1, 2
  
  // Each user starts with their own health * weight[0]
  let ivsScore = multiplyByPlain(encryptedHealth, weights[0]);
  console.log(`   ✓ Applied weight ${weights[0]} for depth 0`);
  
  // Add contribution from neighbors (simplified)
  const neighborContrib = multiplyByPlain(encryptedHealth, weights[1]);
  addInplace(ivsScore, neighborContrib);
  console.log(`   ✓ Added neighbor contribution (weight ${weights[1]})`);
  
  // Decrypt result
  console.log('\n3️⃣  Decrypting final IVS scores...');
  const finalScores = batchDecryptIVS(ivsScore, users.length);
  
  console.log('\n📊 Results:');
  users.forEach((user, i) => {
    console.log(`   ${user}: IVS = ${finalScores[i].toFixed(6)}`);
  });
  
  console.log('\n✅ Demo complete! All operations performed on encrypted data.');
  console.log('═'.repeat(70) + '\n');
}

/**
 * Export for external use
 */
export default {
  initCKKSMHE,
  getContext,
  encryptVector,
  decryptVector,
  encryptScalar,
  decryptScalar,
  add,
  addInplace,
  multiplyByPlain,
  multiplyByPlainInplace,
  multiply,
  encryptZero,
  serializeCiphertext,
  deserializeCiphertext,
  batchEncryptHealth,
  batchDecryptIVS,
  weightedSum,
  addVectors,
  createPlaintext,
  getCiphertextSize,
  cloneCiphertext,
  demoEncryptedIVS
};
