#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELAY_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/polkadot"
PARA_BIN="${BASE_DIR}/chain/polkadot-sdk/target/release/parachain-template-node"

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║              STARTING MULTI-DISEASE IVS NETWORK                           ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Clean old data
echo "🧹 Cleaning old chain data..."
rm -rf /tmp/relay-dev /tmp/disease-a /tmp/disease-b /tmp/aggregator
rm -rf /tmp/disease-*-spec*.json /tmp/aggregator-spec*.json

# Generate chain specs for parachains
echo ""
echo "📝 Generating parachain chain specifications..."

echo "  → Disease-A (ParaId 2000)..."
"${PARA_BIN}" build-spec --chain local --disable-default-bootnode > /tmp/disease-a-spec.json.tmp
sed -e 's/"parachainId": 1000/"parachainId": 2000/' \
    -e 's/"id": "local_testnet"/"id": "disease_a"/' \
    /tmp/disease-a-spec.json.tmp > /tmp/disease-a-spec.json
"${PARA_BIN}" build-spec --chain /tmp/disease-a-spec.json --raw --disable-default-bootnode > /tmp/disease-a-spec-raw.json
rm /tmp/disease-a-spec.json.tmp

echo "  → Disease-B (ParaId 2001)..."
"${PARA_BIN}" build-spec --chain local --disable-default-bootnode > /tmp/disease-b-spec.json.tmp
sed -e 's/"parachainId": 1000/"parachainId": 2001/' \
    -e 's/"id": "local_testnet"/"id": "disease_b"/' \
    /tmp/disease-b-spec.json.tmp > /tmp/disease-b-spec.json
"${PARA_BIN}" build-spec --chain /tmp/disease-b-spec.json --raw --disable-default-bootnode > /tmp/disease-b-spec-raw.json
rm /tmp/disease-b-spec.json.tmp

echo "  → Aggregator (ParaId 3000)..."
"${PARA_BIN}" build-spec --chain local --disable-default-bootnode > /tmp/aggregator-spec.json.tmp
sed -e 's/"parachainId": 1000/"parachainId": 3000/' \
    -e 's/"id": "local_testnet"/"id": "aggregator"/' \
    /tmp/aggregator-spec.json.tmp > /tmp/aggregator-spec.json
"${PARA_BIN}" build-spec --chain /tmp/aggregator-spec.json --raw --disable-default-bootnode > /tmp/aggregator-spec-raw.json
rm /tmp/aggregator-spec.json.tmp

echo ""
echo "✅ Chain specifications generated!"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  ALL CHAINS ARE READY - START THEM IN SEPARATE TERMINALS:                ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Terminal 1 - Relay Chain:"
echo "  bash ${BASE_DIR}/scripts/relay.sh"
echo ""
echo "Terminal 2 - Disease-A Parachain:"
echo "  bash ${BASE_DIR}/scripts/para-a-standalone.sh"
echo ""
echo "Terminal 3 - Disease-B Parachain:"
echo "  bash ${BASE_DIR}/scripts/para-b-standalone.sh"
echo ""
echo "Terminal 4 - Aggregator Parachain:"
echo "  bash ${BASE_DIR}/scripts/para-agg-standalone.sh"
echo ""
echo "Or run all in background:"
echo "  bash ${BASE_DIR}/scripts/start-background.sh"
echo ""
