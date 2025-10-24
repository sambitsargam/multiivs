#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/parachain-template-node"
PARA_ID=3000
CHAIN_SPEC="/tmp/aggregator-spec.json"

if [ ! -f "${PARA_BIN}" ]; then
    echo "Error: Aggregator binary not found at ${PARA_BIN}"
    echo "Please run: make build"
    exit 1
fi

echo "Generating chain spec for Aggregator (ParaId: ${PARA_ID})"
"${PARA_BIN}" build-spec --chain local --disable-default-bootnode > "${CHAIN_SPEC}.tmp"
sed 's/"parachainId": 1000/"parachainId": 3000/' "${CHAIN_SPEC}.tmp" > "${CHAIN_SPEC}"
rm "${CHAIN_SPEC}.tmp"

echo "Starting Aggregator collator (ParaId: ${PARA_ID}) on RPC=8848"
"${PARA_BIN}" \
    --collator \
    --force-authoring \
    --chain "${CHAIN_SPEC}" \
    --base-path /tmp/aggregator \
    --port 30339 \
    --rpc-port 8848 \
    --rpc-cors=all \
    -- \
    --execution wasm \
    --chain dev \
    --port 30340
