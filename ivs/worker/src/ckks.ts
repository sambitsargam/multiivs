import SEAL from 'node-seal';

let sealContext: any = null;
let encoder: any = null;
let encryptor: any = null;
let decryptor: any = null;
let keyGenerator: any = null;

/**
 * Initialize CKKS context with parameters suitable for IVS computation
 */
export async function initCKKS() {
  if (sealContext) return; // Already initialized

  const seal = await SEAL();

  const schemeType = seal.SchemeType.ckks;
  const securityLevel = seal.SecurityLevel.tc128;
  const polyModulusDegree = 8192;
  const bitSizes = [60, 40, 40, 60];
  const bitSize = 40;

  const encParms = seal.EncryptionParameters(schemeType);
  encParms.setPolyModulusDegree(polyModulusDegree);
  encParms.setCoeffModulus(
    seal.CoeffModulus.Create(polyModulusDegree, Int32Array.from(bitSizes))
  );

  sealContext = seal.Context(encParms, true, securityLevel);

  if (!sealContext.parametersSet()) {
    throw new Error('Failed to set CKKS parameters');
  }

  keyGenerator = seal.KeyGenerator(sealContext);
  const secretKey = keyGenerator.secretKey();
  const publicKey = keyGenerator.createPublicKey();

  encoder = seal.CKKSEncoder(sealContext);
  encryptor = seal.Encryptor(sealContext, publicKey);
  decryptor = seal.Decryptor(sealContext, secretKey);

  const scale = Math.pow(2.0, bitSize);
  
  console.log('✓ CKKS initialized with poly degree:', polyModulusDegree);
}

/**
 * Encrypt a single scalar value
 */
export function encryptScalar(value: number): Uint8Array {
  if (!sealContext) throw new Error('CKKS not initialized');

  const seal = sealContext.modules;
  const plainText = encoder.encode(Float64Array.from([value]), Math.pow(2, 40));
  const cipherText = encryptor.encrypt(plainText);
  
  return new Uint8Array(cipherText.save());
}

/**
 * Decrypt a scalar value from bytes
 */
export function decryptScalar(bytes: Uint8Array): number {
  if (!sealContext) throw new Error('CKKS not initialized');

  const seal = sealContext.modules;
  const cipherText = seal.CipherText();
  cipherText.load(sealContext, bytes);

  const plainText = decryptor.decrypt(cipherText);
  const decoded = encoder.decode(plainText);

  return decoded[0];
}
