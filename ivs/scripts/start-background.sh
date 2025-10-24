#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║         STARTING ALL CHAINS IN BACKGROUND                                ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# First generate chain specs
bash "${BASE_DIR}/scripts/start-all.sh" 2>&1 | grep -v "Terminal"

echo ""
echo "🚀 Launching chains in background..."
echo ""

# Start relay chain
echo "  [1/4] Starting Relay Chain..."
bash "${BASE_DIR}/scripts/relay.sh" > /tmp/relay-chain.log 2>&1 &
RELAY_PID=$!
echo "        → PID: ${RELAY_PID}, Logs: /tmp/relay-chain.log"
sleep 3

# Start Disease-A
echo "  [2/4] Starting Disease-A Parachain..."
bash "${BASE_DIR}/scripts/para-a-standalone.sh" > /tmp/disease-a.log 2>&1 &
PARA_A_PID=$!
echo "        → PID: ${PARA_A_PID}, Logs: /tmp/disease-a.log"
sleep 2

# Start Disease-B
echo "  [3/4] Starting Disease-B Parachain..."
bash "${BASE_DIR}/scripts/para-b-standalone.sh" > /tmp/disease-b.log 2>&1 &
PARA_B_PID=$!
echo "        → PID: ${PARA_B_PID}, Logs: /tmp/disease-b.log"
sleep 2

# Start Aggregator
echo "  [4/4] Starting Aggregator Parachain..."
bash "${BASE_DIR}/scripts/para-agg-standalone.sh" > /tmp/aggregator.log 2>&1 &
PARA_AGG_PID=$!
echo "        → PID: ${PARA_AGG_PID}, Logs: /tmp/aggregator.log"
sleep 2

echo ""
echo "✅ All chains started!"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║  CHAIN STATUS                                                             ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Relay Chain:     http://127.0.0.1:9944  (PID: ${RELAY_PID})"
echo "  Disease-A:       http://127.0.0.1:8844  (PID: ${PARA_A_PID})"
echo "  Disease-B:       http://127.0.0.1:8846  (PID: ${PARA_B_PID})"
echo "  Aggregator:      http://127.0.0.1:8848  (PID: ${PARA_AGG_PID})"
echo ""
echo "📊 View Logs:"
echo "  tail -f /tmp/relay-chain.log"
echo "  tail -f /tmp/disease-a.log"
echo "  tail -f /tmp/disease-b.log"
echo "  tail -f /tmp/aggregator.log"
echo ""
echo "🛑 Stop All Chains:"
echo "  pkill -f 'polkadot|parachain-template-node'"
echo ""
echo "🔍 Check Chain Status:"
echo "  curl -s http://127.0.0.1:9944/health | jq"
echo "  curl -s http://127.0.0.1:8844/health | jq"
echo "  curl -s http://127.0.0.1:8846/health | jq"
echo "  curl -s http://127.0.0.1:8848/health | jq"
echo ""
