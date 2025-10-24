#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/polkadot-parachain"

if [ ! -f "${PARA_BIN}" ]; then
    echo "Error: polkadot-parachain binary not found at ${PARA_BIN}"
    exit 1
fi

echo "🚀 Starting Aggregator Parachain (ParaId: 3000) on RPC=8848"
"${PARA_BIN}" \
    --charlie \
    --collator \
    --force-authoring \
    --chain asset-hub-rococo-local \
    --base-path /tmp/aggregator \
    --port 30339 \
    --rpc-port 8848 \
    --rpc-cors=all \
    --rpc-methods=unsafe \
    --node-key=0000000000000000000000000000000000000000000000000000000000000005 \
    -- \
    --chain rococo-local \
    --port 30340 \
    --rpc-port 9947
