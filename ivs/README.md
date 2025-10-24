# IVS Multi-Disease System on Polkadot

Individual Vulnerability Score (IVS) computation across multiple disease parachains using CKKS homomorphic encryption and IPFS storage.

## Quick Start

```bash
# 1. Clone polkadot-sdk into chain/ directory
cd chain && git clone https://github.com/paritytech/polkadot-sdk.git

# 2. Build relay and all parachains (takes ~30-60 min)
make build

# 3. Start relay chain (terminal 1)
make relay

# 4. Start disease-a parachain (terminal 2)
make para-a

# 5. Start disease-b parachain (terminal 3)
make para-b

# 6. Start aggregator parachain (terminal 4)
make para-agg

# 7. Export genesis artifacts
make export

# 8. Register parachains via Polkadot.js Apps UI
make register

# 9. Run IVS worker in demo mode
make worker
```

## Alternative: Zombienet (Automatic)

```bash
# Install zombienet from: https://github.com/paritytech/zombienet/releases
make net
```

## Architecture

- **Disease-A Parachain (2000)**: Stores contacts + health/IVS CIDs for disease A
- **Disease-B Parachain (2001)**: Stores contacts + health/IVS CIDs for disease B
- **Aggregator Parachain (3000)**: Coordinates IVS computation requests
- **Off-chain Worker**: Fetches CIDs, decrypts (CKKS), runs BFS IVS algorithm, re-encrypts, uploads to IPFS

## Pallet Extrinsics

- `register_user()` - Register a new user
- `add_contact(who)` - Add bidirectional contact edge
- `set_health_cid(cid)` - Set IPFS CID for encrypted health status (user-signed)
- `set_ivs_cid(user, cid)` - Set IPFS CID for encrypted IVS (requires root/sudo)

## Worker Configuration

Edit `worker/.env`:
```bash
RPC_A=ws://127.0.0.1:8845
RPC_B=ws://127.0.0.1:8847
LIGHTHOUSE_KEY=your_key_here  # Get from https://lighthouse.storage
DMAX=2
```

Run: `cd worker && npm start`

## References

- [Parachain Deployment Guide](https://paritytech.github.io/devops-guide/guides/parachain_deployment.html)
- [Polkadot SDK](https://github.com/paritytech/polkadot-sdk)
- [Zombienet](https://github.com/paritytech/zombienet)
- [Lighthouse IPFS](https://docs.lighthouse.storage/)
- [node-seal CKKS](https://github.com/morfix-io/node-seal)
