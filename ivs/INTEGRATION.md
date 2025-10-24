# Integration Notes for pallet-ivs

This document describes how to integrate `pallet-ivs` into the disease parachains.

## Overview

The `pallet-ivs` provides storage for:
- User registry
- Contact graphs (bidirectional edges)
- IPFS CIDs for encrypted health status
- IPFS CIDs for encrypted IVS scores

## Integration Steps

Since we're using `polkadot-parachain` binary from the SDK (which is a general-purpose collator), we have two options:

### Option 1: Use as-is (Recommended for Quick Start)

Use the existing `polkadot-parachain` binary without modifications. Store IVS data using the built-in `system` or `balances` pallets' storage, or via:
- Custom chain-spec configuration
- External indexer/database alongside the chain
- Off-chain worker storage

This allows immediate deployment without Rust compilation.

### Option 2: Custom Runtime (Full Integration)

To properly integrate `pallet-ivs`, you need to:

1. **Add pallet to parachain runtime dependencies** (`cumulus/polkadot-parachain/Cargo.toml`):
```toml
[dependencies]
pallet-ivs = { path = "../../../ivs/pallets/ivs", default-features = false }

[features]
std = [
    # ... existing features
    "pallet-ivs/std",
]
```

2. **Configure the pallet** in runtime (`runtime/src/lib.rs` or similar):
```rust
impl pallet_ivs::Config for Runtime {
    type RuntimeEvent = RuntimeEvent;
    type WeightInfo = ();
}
```

3. **Add to construct_runtime!**:
```rust
construct_runtime!(
    pub struct Runtime {
        // ... existing pallets
        Ivs: pallet_ivs,
    }
);
```

4. **Rebuild the parachain**:
```bash
cd chain/disease-a
cargo build --release
```

5. **Repeat for disease-b and aggregator parachains**

## For This Demo

Since full integration requires modifying the SDK's parachain template and rebuilding, we provide:

1. **Standalone pallet code** in `pallets/ivs/` - ready to integrate when needed
2. **Worker that works with any substrate chain** - uses generic storage/extrinsics
3. **Scripts that use the standard `polkadot-parachain` binary**

This lets you:
- Run the network immediately with existing binaries
- Test the IVS algorithm logic in the worker
- Later integrate the pallet when ready for production

## Production Deployment

For production, you should:
1. Fork `cumulus/polkadot-parachain` or create a custom runtime
2. Integrate `pallet-ivs` as shown above
3. Add proper weights benchmarking
4. Add access control (not just root for `set_ivs_cid`)
5. Consider using off-chain workers in the pallet itself for IVS computation

## References

- [FRAME Pallet Tutorial](https://docs.substrate.io/tutorials/build-application-logic/)
- [Add Pallets to Runtime](https://docs.substrate.io/tutorials/build-a-blockchain/add-a-pallet/)
- [Cumulus Parachain Template](https://github.com/paritytech/polkadot-sdk/tree/master/cumulus)
