/**
 * Chain Integration Module
 * 
 * Connects to disease-specific parachains and aggregator parachain
 * to read user data, encrypted health status, and store results
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import * as IPFS from './ipfs';
import * as CKKS from './ckks-mhe';
import * as IVSEncrypted from './ivs-encrypted';

export interface ParachainEndpoint {
  diseaseId: string;
  wsEndpoint: string;
  api?: ApiPromise;
}

export interface UserData {
  account: string;
  name: string;
  metadata: string;
  contacts: string[];
  encryptedHealthCid?: string;
  encryptedIvsCid?: string;
}

export interface ChainConfig {
  diseaseParachains: ParachainEndpoint[];
  aggregatorEndpoint: string;
  sudoSeed?: string; // For submitting results
}

/**
 * Chain Integration Manager
 * Handles all blockchain interactions for MHE-IVS system
 */
export class ChainIntegrationManager {
  private config: ChainConfig;
  private diseaseApis: Map<string, ApiPromise> = new Map();
  private aggregatorApi?: ApiPromise;
  private keyring: Keyring;
  private sudoAccount?: any;

  constructor(config: ChainConfig) {
    this.config = config;
    this.keyring = new Keyring({ type: 'sr25519' });
    
    if (config.sudoSeed) {
      this.sudoAccount = this.keyring.addFromUri(config.sudoSeed);
    }
  }

  /**
   * Connect to all parachains and aggregator
   */
  async connect(): Promise<void> {
    console.log('\n🔗 Connecting to parachains...\n');

    // Connect to disease parachains
    for (const endpoint of this.config.diseaseParachains) {
      try {
        const provider = new WsProvider(endpoint.wsEndpoint);
        const api = await ApiPromise.create({ provider });
        await api.isReady;
        
        this.diseaseApis.set(endpoint.diseaseId, api);
        console.log(`  ✓ Connected to ${endpoint.diseaseId} at ${endpoint.wsEndpoint}`);
      } catch (error) {
        console.error(`  ❌ Failed to connect to ${endpoint.diseaseId}:`, error);
      }
    }

    // Connect to aggregator parachain
    try {
      const provider = new WsProvider(this.config.aggregatorEndpoint);
      this.aggregatorApi = await ApiPromise.create({ provider });
      await this.aggregatorApi.isReady;
      console.log(`  ✓ Connected to Aggregator at ${this.config.aggregatorEndpoint}\n`);
    } catch (error) {
      console.error(`  ❌ Failed to connect to Aggregator:`, error);
    }
  }

  /**
   * Fetch all user data from a specific disease parachain
   */
  async fetchUsersFromDisease(diseaseId: string): Promise<UserData[]> {
    const api = this.diseaseApis.get(diseaseId);
    if (!api) {
      throw new Error(`Not connected to ${diseaseId}`);
    }

    console.log(`\n📥 Fetching users from ${diseaseId}...`);
    const users: UserData[] = [];

    try {
      // Get all user profiles
      const entries = await api.query.diseaseTracker.userProfiles.entries();
      
      for (const [key, value] of entries) {
        const accountId = key.args[0].toString();
        const profile: any = value.toJSON();
        
        // Get contacts
        const contactsRaw = await api.query.diseaseTracker.contacts(accountId);
        const contacts = (contactsRaw.toJSON() as string[]) || [];
        
        // Get encrypted health status
        const healthStatus = await api.query.diseaseTracker.encryptedHealthStatuses(accountId);
        const healthData: any = healthStatus.toJSON();
        
        // Get encrypted IVS
        const ivsStatus = await api.query.diseaseTracker.encryptedIVSScores(accountId);
        const ivsData: any = ivsStatus.toJSON();
        
        const userData: UserData = {
          account: accountId,
          name: profile?.name ? Buffer.from(profile.name).toString('utf8') : accountId,
          metadata: profile?.metadata ? Buffer.from(profile.metadata).toString('utf8') : '',
          contacts: contacts.map((c: any) => c.toString()),
          encryptedHealthCid: healthData?.cid ? Buffer.from(healthData.cid).toString('utf8') : undefined,
          encryptedIvsCid: ivsData?.cid ? Buffer.from(ivsData.cid).toString('utf8') : undefined,
        };
        
        users.push(userData);
      }
      
      console.log(`  ✓ Fetched ${users.length} users from ${diseaseId}`);
      return users;
    } catch (error) {
      console.error(`  ❌ Error fetching users from ${diseaseId}:`, error);
      return [];
    }
  }

  /**
   * Download encrypted health data from IPFS
   */
  async downloadEncryptedHealth(cid: string): Promise<any> {
    try {
      const response = await fetch(`https://gateway.lighthouse.storage/ipfs/${cid}`);
      const base64Data = await response.text();
      return CKKS.deserializeCiphertext(base64Data);
    } catch (error) {
      console.error(`Error downloading CID ${cid}:`, error);
      return null;
    }
  }

  /**
   * Build disease data for IVS computation
   */
  async prepareDiseaseData(
    diseaseId: string,
    users: UserData[],
    jointPublicKey?: any
  ): Promise<IVSEncrypted.DiseaseData> {
    console.log(`\n🔧 Preparing data for ${diseaseId}...`);

    // Build contact graph
    const contacts = new Map<string, string[]>();
    for (const user of users) {
      contacts.set(user.account, user.contacts);
    }

    // Download and decrypt health status
    const encryptedHealth = new Map<string, any>();
    for (const user of users) {
      if (user.encryptedHealthCid) {
        console.log(`  Downloading encrypted health for ${user.name}...`);
        const ciphertext = await this.downloadEncryptedHealth(user.encryptedHealthCid);
        if (ciphertext) {
          encryptedHealth.set(user.account, ciphertext);
        }
      } else {
        // If no encrypted health, assume healthy (encrypted 0)
        console.log(`  No health data for ${user.name}, using encrypted 0`);
        encryptedHealth.set(user.account, CKKS.encryptZero(jointPublicKey));
      }
    }

    console.log(`  ✓ Prepared ${users.length} users, ${contacts.size} contact graphs`);

    return {
      diseaseId,
      users: users.map(u => u.account),
      contacts,
      encryptedHealth
    };
  }

  /**
   * Store encrypted IVS results back to disease parachain
   */
  async storeEncryptedIVS(
    diseaseId: string,
    userAccount: string,
    encryptedIVS: any,
    parameters: string
  ): Promise<boolean> {
    const api = this.diseaseApis.get(diseaseId);
    if (!api || !this.sudoAccount) {
      console.error('Missing API or sudo account');
      return false;
    }

    try {
      // Serialize and upload to IPFS
      const serialized = CKKS.serializeCiphertext(encryptedIVS);
      const cid = await IPFS.uploadToIPFS(serialized, `ivs-${diseaseId}-${userAccount}.enc`);
      
      console.log(`  📤 Uploaded IVS for ${userAccount}: ${cid}`);

      // Store CID on-chain
      const tx = api.tx.sudo.sudo(
        api.tx.diseaseTracker.storeEncryptedIvs(
          userAccount,
          cid,
          parameters
        )
      );

      await tx.signAndSend(this.sudoAccount);
      console.log(`  ✓ Stored IVS CID on ${diseaseId} parachain`);
      
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to store IVS for ${userAccount}:`, error);
      return false;
    }
  }

  /**
   * Store aggregated IVS on aggregator parachain
   */
  async storeAggregatedIVS(
    userAccount: string,
    encryptedAggregatedIVS: any,
    diseaseIds: string[],
    parameters: string
  ): Promise<boolean> {
    if (!this.aggregatorApi || !this.sudoAccount) {
      console.error('Missing aggregator API or sudo account');
      return false;
    }

    try {
      // Serialize and upload to IPFS
      const serialized = CKKS.serializeCiphertext(encryptedAggregatedIVS);
      const cid = await IPFS.uploadToIPFS(serialized, `ivs-aggregated-${userAccount}.enc`);
      
      console.log(`  📤 Uploaded aggregated IVS for ${userAccount}: ${cid}`);

      // Store on aggregator chain
      const tx = this.aggregatorApi.tx.sudo.sudo(
        this.aggregatorApi.tx.ivsAggregator.storeAggregatedIvs(
          userAccount,
          cid,
          diseaseIds,
          parameters
        )
      );

      await tx.signAndSend(this.sudoAccount);
      console.log(`  ✓ Stored aggregated IVS CID on aggregator parachain`);
      
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to store aggregated IVS:`, error);
      return false;
    }
  }

  /**
   * Listen for recompute requests from aggregator parachain
   */
  async listenForRecomputeRequests(callback: (requestId: number, diseases: string[]) => void): Promise<void> {
    if (!this.aggregatorApi) {
      throw new Error('Aggregator API not connected');
    }

    console.log('\n👂 Listening for recompute requests on aggregator parachain...\n');

    this.aggregatorApi.query.system.events((events) => {
      events.forEach((record) => {
        const { event } = record;
        
        if (this.aggregatorApi!.events.ivsAggregator.RecomputeRequested.is(event)) {
          const [requestId, , diseases] = event.data;
          console.log(`\n🔔 Recompute request received: #${requestId}`);
          console.log(`   Diseases: ${diseases}`);
          
          callback(requestId.toNumber(), diseases.toJSON() as string[]);
        }
      });
    });
  }

  /**
   * Mark recompute request as completed
   */
  async completeRecomputeRequest(requestId: number): Promise<void> {
    if (!this.aggregatorApi || !this.sudoAccount) return;

    try {
      const tx = this.aggregatorApi.tx.sudo.sudo(
        this.aggregatorApi.tx.ivsAggregator.completeRecomputeRequest(requestId)
      );
      
      await tx.signAndSend(this.sudoAccount);
      console.log(`\n✅ Marked recompute request #${requestId} as completed`);
    } catch (error) {
      console.error(`Failed to complete request #${requestId}:`, error);
    }
  }

  /**
   * Disconnect from all chains
   */
  async disconnect(): Promise<void> {
    console.log('\n🔌 Disconnecting from parachains...');
    
    for (const [diseaseId, api] of this.diseaseApis.entries()) {
      await api.disconnect();
      console.log(`  ✓ Disconnected from ${diseaseId}`);
    }
    
    if (this.aggregatorApi) {
      await this.aggregatorApi.disconnect();
      console.log(`  ✓ Disconnected from Aggregator\n`);
    }
  }

  /**
   * Get API for specific disease
   */
  getDiseaseApi(diseaseId: string): ApiPromise | undefined {
    return this.diseaseApis.get(diseaseId);
  }

  /**
   * Get aggregator API
   */
  getAggregatorApi(): ApiPromise | undefined {
    return this.aggregatorApi;
  }
}

/**
 * Demo configuration for local testing
 */
export function getLocalChainConfig(): ChainConfig {
  return {
    diseaseParachains: [
      {
        diseaseId: 'COVID-19',
        wsEndpoint: 'ws://127.0.0.1:8844'
      },
      {
        diseaseId: 'Influenza',
        wsEndpoint: 'ws://127.0.0.1:8846'
      }
    ],
    aggregatorEndpoint: 'ws://127.0.0.1:8848',
    sudoSeed: '//Alice' // Default development seed
  };
}

export default ChainIntegrationManager;
