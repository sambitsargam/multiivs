#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/parachain-template-node"
PARA_ID=2001
CHAIN_SPEC="/tmp/disease-b-spec.json"

if [ ! -f "${PARA_BIN}" ]; then
    echo "Error: Disease-B binary not found at ${PARA_BIN}"
    echo "Please run: make build"
    exit 1
fi

echo "Generating chain spec for Disease-B (ParaId: ${PARA_ID})"
"${PARA_BIN}" build-spec --chain local --disable-default-bootnode > "${CHAIN_SPEC}.tmp"
sed 's/"parachainId": 1000/"parachainId": 2001/' "${CHAIN_SPEC}.tmp" > "${CHAIN_SPEC}"
rm "${CHAIN_SPEC}.tmp"

echo "Starting Disease-B collator (ParaId: ${PARA_ID}) on RPC=8846"
"${PARA_BIN}" \
    --collator \
    --force-authoring \
    --chain "${CHAIN_SPEC}" \
    --base-path /tmp/disease-b \
    --port 30337 \
    --rpc-port 8846 \
    --rpc-cors=all \
    -- \
    --execution wasm \
    --chain dev \
    --port 30338
