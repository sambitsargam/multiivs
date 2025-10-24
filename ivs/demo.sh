#!/usr/bin/env bash
set -e

echo "========================================="
echo "IVS Multi-Disease System - Quick Demo"
echo "========================================="
echo ""
echo "This script will demonstrate the system in the following order:"
echo "1. Run worker in DEMO mode (no chain connection needed)"
echo "2. Show how to build and run chains"
echo ""

# Check if worker dependencies are installed
if [ ! -d "worker/node_modules" ]; then
    echo "[Step 1/2] Installing worker dependencies..."
    cd worker
    cp .env.example .env 2>/dev/null || true
    npm install
    cd ..
    echo "✓ Dependencies installed"
    echo ""
else
    echo "[Step 1/2] Worker dependencies already installed"
    echo ""
fi

echo "[Step 2/2] Running worker in DEMO mode..."
echo ""
echo "This demonstrates the IVS algorithm with mock data:"
echo "  - 5 users (Alice, Bob, Charlie, David, Eve)"
echo "  - Contact graph with bidirectional edges"
echo "  - 2 infected users (Alice, Charlie)"
echo "  - BFS-based IVS computation with exponential decay"
echo ""
echo "Press Ctrl+C when done viewing the demo"
echo ""
sleep 2

cd worker
DEMO=1 npm start
