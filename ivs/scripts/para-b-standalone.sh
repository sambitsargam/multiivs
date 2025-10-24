#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/polkadot-parachain"

if [ ! -f "${PARA_BIN}" ]; then
    echo "Error: polkadot-parachain binary not found at ${PARA_BIN}"
    exit 1
fi

echo "🚀 Starting Disease-B Parachain (ParaId: 2001) on RPC=8846"
"${PARA_BIN}" \
    --bob \
    --collator \
    --force-authoring \
    --chain asset-hub-rococo-local \
    --base-path /tmp/disease-b \
    --port 30337 \
    --rpc-port 8846 \
    --rpc-cors=all \
    --rpc-methods=unsafe \
    --node-key=0000000000000000000000000000000000000000000000000000000000000003 \
    -- \
    --chain rococo-local \
    --port 30338 \
    --rpc-port 9946
