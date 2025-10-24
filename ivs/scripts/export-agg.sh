#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/parachain-template-node"
PARA_ID=3000
OUTPUT_DIR="${BASE_DIR}/chain/aggregator"

if [ ! -f "${PARA_BIN}" ]; then
    echo "Error: Aggregator binary not found at ${PARA_BIN}"
    echo "Please run: make build"
    exit 1
fi

echo "Exporting Aggregator genesis artifacts (ParaId: ${PARA_ID})..."

echo "  - Exporting genesis state..."
"${PARA_BIN}" export-genesis-state --chain local --parachain-id ${PARA_ID} > "${OUTPUT_DIR}/para-${PARA_ID}-genesis-state"

echo "  - Exporting genesis wasm..."
"${PARA_BIN}" export-genesis-wasm --chain local > "${OUTPUT_DIR}/para-${PARA_ID}-wasm"

echo "✓ Aggregator artifacts exported:"
echo "    State: ${OUTPUT_DIR}/para-${PARA_ID}-genesis-state"
echo "    Wasm:  ${OUTPUT_DIR}/para-${PARA_ID}-wasm"
