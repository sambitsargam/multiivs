#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/polkadot-parachain"

if [ ! -f "${PARA_BIN}" ]; then
    echo "Error: polkadot-parachain binary not found at ${PARA_BIN}"
    exit 1
fi

echo "🚀 Starting Disease-A Parachain (ParaId: 2000) on RPC=8844"
"${PARA_BIN}" \
    --alice \
    --collator \
    --force-authoring \
    --chain asset-hub-rococo-local \
    --base-path /tmp/disease-a \
    --port 30335 \
    --rpc-port 8844 \
    --rpc-cors=all \
    --rpc-methods=unsafe \
    --node-key=0000000000000000000000000000000000000000000000000000000000000001 \
    -- \
    --chain rococo-local \
    --port 30336 \
    --rpc-port 9945
