import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import dotenv from 'dotenv';
import { initCKKS, encryptScalar, decryptScalar } from './ckks.js';
import { uploadBytes, downloadCid, cidToBytes, bytesToCid } from './ipfs.js';
import { computeIVS, printIVS } from './ivs.js';

dotenv.config();

const RPC_A = process.env.RPC_A || 'ws://127.0.0.1:8845';
const RPC_B = process.env.RPC_B || 'ws://127.0.0.1:8847';
const RPC_AGG = process.env.RPC_AGG || 'ws://127.0.0.1:8849';
const LIGHTHOUSE_KEY = process.env.LIGHTHOUSE_KEY || '';
const DMAX = parseInt(process.env.DMAX || '2');

interface ChainData {
  users: string[];
  contacts: Map<string, string[]>;
  infected: Map<string, number>;
}

/**
 * Connect to a parachain
 */
async function connectChain(rpc: string): Promise<ApiPromise> {
  const provider = new WsProvider(rpc);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  console.log(`✓ Connected to ${rpc}`);
  return api;
}

/**
 * Fetch all users from a chain
 */
async function getUsers(api: ApiPromise): Promise<string[]> {
  const entries = await api.query.ivs.users.entries();
  return entries.map(([key]) => key.args[0].toString());
}

/**
 * Fetch contacts for a user
 */
async function getContacts(api: ApiPromise, user: string): Promise<string[]> {
  const contacts = await api.query.ivs.contacts(user);
  return (contacts.toJSON() as string[]) || [];
}

/**
 * Fetch health CID for a user
 */
async function getHealthCid(api: ApiPromise, user: string): Promise<string | null> {
  const cid = await api.query.ivs.healthCid(user);
  if (cid.isNone) return null;
  const bytes = cid.unwrap().toU8a();
  return bytesToCid(bytes);
}

/**
 * Fetch all chain data (users, contacts, encrypted health status)
 */
async function fetchChainData(api: ApiPromise, chainName: string): Promise<ChainData> {
  console.log(`\nFetching data from ${chainName}...`);
  
  const users = await getUsers(api);
  console.log(`  - Found ${users.length} users`);

  const contacts = new Map<string, string[]>();
  const infected = new Map<string, number>();

  for (const user of users) {
    const userContacts = await getContacts(api, user);
    contacts.set(user, userContacts);

    // Fetch and decrypt health status
    const healthCid = await getHealthCid(api, user);
    if (healthCid && LIGHTHOUSE_KEY) {
      try {
        const encryptedBytes = await downloadCid(healthCid);
        const status = decryptScalar(encryptedBytes);
        infected.set(user, status > 0.5 ? 1 : 0);
      } catch (error) {
        console.warn(`    ⚠ Failed to decrypt health for ${user.substring(0, 16)}...`);
        infected.set(user, 0);
      }
    } else {
      infected.set(user, 0); // Default to not infected
    }
  }

  console.log(`  ✓ Loaded ${users.length} users, ${contacts.size} contact maps`);
  return { users, contacts, infected };
}

/**
 * Update IVS CIDs on chain
 */
async function updateIvsCids(
  api: ApiPromise,
  chainName: string,
  ivsScores: Map<string, number>,
  sudoAccount: any
): Promise<void> {
  console.log(`\nUpdating IVS CIDs on ${chainName}...`);

  for (const [user, score] of ivsScores.entries()) {
    try {
      // Encrypt IVS
      const encryptedBytes = encryptScalar(score);

      // Upload to IPFS
      const cid = await uploadBytes(encryptedBytes, LIGHTHOUSE_KEY);

      // Submit extrinsic to update IVS CID
      const cidBytes = cidToBytes(cid);
      const tx = api.tx.sudo.sudo(
        api.tx.ivs.setIvsCid(user, Array.from(cidBytes))
      );

      await new Promise((resolve, reject) => {
        tx.signAndSend(sudoAccount, ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              reject(new Error(`Dispatch error: ${dispatchError.toString()}`));
            } else {
              console.log(`    ✓ Updated IVS for ${user.substring(0, 16)}...`);
              resolve(true);
            }
          }
        });
      });
    } catch (error) {
      console.error(`    ✗ Failed to update IVS for ${user.substring(0, 16)}...:`, error);
    }
  }
}

/**
 * Main worker orchestration
 */
async function main() {
  console.log('========================================');
  console.log('IVS Multi-Disease Worker');
  console.log('========================================\n');

  // Initialize CKKS
  await initCKKS();

  // Initialize crypto
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');
  console.log('✓ Sudo account (Alice) initialized\n');

  // Demo mode if chains not available
  if (!process.env.DEMO) {
    try {
      // Connect to chains
      const apiA = await connectChain(RPC_A);
      const apiB = await connectChain(RPC_B);

      // Fetch data from both disease chains
      const dataA = await fetchChainData(apiA, 'Disease-A');
      const dataB = await fetchChainData(apiB, 'Disease-B');

      // Merge users and contacts
      const allUsers = Array.from(new Set([...dataA.users, ...dataB.users]));
      const allContacts = new Map<string, string[]>();
      const allInfected = new Map<string, number>();

      for (const user of allUsers) {
        const contactsA = dataA.contacts.get(user) || [];
        const contactsB = dataB.contacts.get(user) || [];
        allContacts.set(user, Array.from(new Set([...contactsA, ...contactsB])));

        const infectedA = dataA.infected.get(user) || 0;
        const infectedB = dataB.infected.get(user) || 0;
        allInfected.set(user, Math.max(infectedA, infectedB));
      }

      console.log(`\n✓ Merged data: ${allUsers.length} total users`);

      // Compute IVS
      console.log(`\nComputing IVS (Dmax=${DMAX})...`);
      const ivs = computeIVS(allUsers, allContacts, allInfected, DMAX);
      printIVS(ivs);

      // Update chains (if LIGHTHOUSE_KEY provided)
      if (LIGHTHOUSE_KEY) {
        await updateIvsCids(apiA, 'Disease-A', ivs, alice);
        await updateIvsCids(apiB, 'Disease-B', ivs, alice);
      } else {
        console.log('\n⚠ LIGHTHOUSE_KEY not set, skipping IVS upload to IPFS');
      }

      await apiA.disconnect();
      await apiB.disconnect();
    } catch (error) {
      console.error('Error connecting to chains, running demo mode:', error);
      runDemo();
    }
  } else {
    runDemo();
  }
}

/**
 * Demo mode with mocked data
 */
function runDemo() {
  console.log('\n========================================');
  console.log('DEMO MODE (No chain connection)');
  console.log('========================================\n');

  const users = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
  const contacts = new Map<string, string[]>([
    ['Alice', ['Bob', 'Charlie']],
    ['Bob', ['Alice', 'David']],
    ['Charlie', ['Alice', 'Eve']],
    ['David', ['Bob']],
    ['Eve', ['Charlie']],
  ]);
  const infected = new Map<string, number>([
    ['Alice', 1],
    ['Bob', 0],
    ['Charlie', 1],
    ['David', 0],
    ['Eve', 0],
  ]);

  console.log('Mock contact graph:');
  for (const [user, userContacts] of contacts.entries()) {
    console.log(`  ${user} -> [${userContacts.join(', ')}]`);
  }
  console.log('\nInfected users: Alice, Charlie\n');

  console.log(`Computing IVS (Dmax=${DMAX})...`);
  const ivs = computeIVS(users, contacts, infected, DMAX);
  printIVS(ivs);
}

// Run the worker
main().catch(console.error);
