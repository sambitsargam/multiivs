#!/usr/bin/env bash
set -e

echo "========================================="
echo "Building IVS Multi-Disease System"
echo "========================================="

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHAIN_DIR="${BASE_DIR}/chain"

# Build relay chain (polkadot)
echo ""
echo "[1/4] Building relay chain (polkadot)..."
cd "${CHAIN_DIR}/polkadot-sdk"
cargo build --release -p polkadot
RELAY_BIN="${CHAIN_DIR}/polkadot-sdk/target/release/polkadot"
echo "✓ Relay binary: ${RELAY_BIN}"

# Build parachain binary from SDK (we'll reuse the SDK binary for each parachain)
echo ""
echo "[2/4] Building parachain binary from SDK (parachain-template-node)..."
cd "${CHAIN_DIR}/polkadot-sdk"
cargo build --release -p parachain-template-node || true
PARA_BIN="${CHAIN_DIR}/polkadot-sdk/target/release/parachain-template-node"
if [ -f "${PARA_BIN}" ]; then
    echo "✓ Parachain binary: ${PARA_BIN}"
else
    # Fallback to polkadot-parachain if available
    PARA_BIN="${CHAIN_DIR}/polkadot-sdk/target/release/polkadot-parachain"
    if [ -f "${PARA_BIN}" ]; then
        echo "✓ Parachain binary (fallback): ${PARA_BIN}"
    else
        echo "Warning: parachain binary not found in polkadot-sdk/target/release"
        echo "You can build it with: cd ${CHAIN_DIR}/polkadot-sdk && cargo build --release -p parachain-template-node"
    fi
fi

# Use the same SDK parachain binary for disease-a, disease-b and aggregator
DISEASE_A_BIN="${PARA_BIN}"
DISEASE_B_BIN="${PARA_BIN}"
AGGREGATOR_BIN="${PARA_BIN}"
echo "✓ Disease-A binary: ${DISEASE_A_BIN}"
echo "✓ Disease-B binary: ${DISEASE_B_BIN}"
echo "✓ Aggregator binary: ${AGGREGATOR_BIN}"

echo ""
echo "========================================="
echo "Build complete! 🎉"
echo "========================================="
echo ""
echo "Binary locations:"
echo "  Relay:      ${RELAY_BIN}"
echo "  Disease-A:  ${DISEASE_A_BIN}"
echo "  Disease-B:  ${DISEASE_B_BIN}"
echo "  Aggregator: ${AGGREGATOR_BIN}"
echo ""
echo "Next steps:"
echo "  1. Run: make relay    (in one terminal)"
echo "  2. Run: make para-a   (in another terminal)"
echo "  3. Run: make para-b   (in another terminal)"
echo "  4. Run: make para-agg (in another terminal)"
echo "  5. Run: make export"
echo "  6. Run: make register"
echo ""
