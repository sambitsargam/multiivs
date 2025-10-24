import FormData from 'form-data';

/**
 * Upload bytes to IPFS via Lighthouse API and return CID
 * Uses direct API call as per: https://docs.lighthouse.storage/lighthouse-1/how-to/upload-data/file#api
 */
export async function uploadBytes(data: Uint8Array, apiKey: string): Promise<string> {
  try {
    // Convert Uint8Array to Buffer
    const buffer = Buffer.from(data);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: 'ivs-data.bin',
      contentType: 'application/octet-stream',
    });
    
    // Upload to Lighthouse API
    const response = await fetch('https://node.lighthouse.storage/api/v0/add', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Lighthouse upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (!result || !result.Hash) {
      throw new Error('Invalid response from Lighthouse API');
    }

    const cid = result.Hash;
    console.log(`  ✓ Uploaded to IPFS: ${cid}`);
    return cid;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
}

/**
 * Download data from IPFS by CID via Lighthouse
 */
export async function downloadCid(cid: string): Promise<Uint8Array> {
  try {
    // Construct gateway URL
    const url = `https://gateway.lighthouse.storage/ipfs/${cid}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download from IPFS: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error(`Error downloading CID ${cid}:`, error);
    throw error;
  }
}

/**
 * Helper to convert CID string to bytes for storage
 */
export function cidToBytes(cid: string): Uint8Array {
  return new TextEncoder().encode(cid);
}

/**
 * Helper to convert bytes from storage to CID string
 */
export function bytesToCid(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
