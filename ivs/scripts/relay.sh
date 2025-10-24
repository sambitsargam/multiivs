#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELAY_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/polkadot"

if [ ! -f "${RELAY_BIN}" ]; then
    echo "Error: Relay binary not found at ${RELAY_BIN}"
    echo "Please run: make build"
    exit 1
fi

echo "Starting rococo-local relay chain on port: RPC=9944 (HTTP & WS)"
"${RELAY_BIN}" \
    --alice \
    --validator \
    --chain rococo-local \
    --base-path /tmp/relay-alice \
    --port 30333 \
    --rpc-port 9944 \
    --rpc-cors=all \
    --rpc-methods=unsafe \
    --insecure-validator-i-know-what-i-do \
    --node-key=0000000000000000000000000000000000000000000000000000000000000000
