#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/parachain-template-node"
PARA_ID=2000
CHAIN_SPEC="/tmp/disease-a-spec.json"
CHAIN_SPEC_RAW="/tmp/disease-a-spec-raw.json"

if [ ! -f "${PARA_BIN}" ]; then
    echo "Error: Disease-A binary not found at ${PARA_BIN}"
    echo "Please run: make build"
    exit 1
fi

echo "Generating chain spec for Disease-A (ParaId: ${PARA_ID})"
"${PARA_BIN}" build-spec --chain local --disable-default-bootnode > "${CHAIN_SPEC}.tmp"
sed -e 's/"parachainId": 1000/"parachainId": 2000/' \
    -e 's/"id": "local_testnet"/"id": "disease_a"/' \
    "${CHAIN_SPEC}.tmp" > "${CHAIN_SPEC}"
rm "${CHAIN_SPEC}.tmp"

echo "Converting to raw chain spec..."
"${PARA_BIN}" build-spec --chain "${CHAIN_SPEC}" --raw --disable-default-bootnode > "${CHAIN_SPEC_RAW}"

echo "Starting Disease-A collator (ParaId: ${PARA_ID}) on RPC=8844"
"${PARA_BIN}" \
    --alice \
    --collator \
    --force-authoring \
    --chain "${CHAIN_SPEC_RAW}" \
    --base-path /tmp/disease-a \
    --port 30335 \
    --rpc-port 8844 \
    --rpc-cors=all \
    --node-key=0000000000000000000000000000000000000000000000000000000000000001 \
    --relay-chain-rpc-urls ws://127.0.0.1:9944
