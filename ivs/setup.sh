#!/usr/bin/env bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXISTING_SDK="../polkadot-sdk"
CHAIN_DIR="${BASE_DIR}/chain"

echo "========================================="
echo "IVS Setup Script"
echo "========================================="
echo ""

# Check if polkadot-sdk already exists at parent level
if [ -d "${EXISTING_SDK}" ]; then
    echo "Found existing polkadot-sdk at parent directory"
    echo "Creating symlink: chain/polkadot-sdk -> ../polkadot-sdk"
    
    if [ -L "${CHAIN_DIR}/polkadot-sdk" ]; then
        echo "Symlink already exists, removing old one..."
        rm "${CHAIN_DIR}/polkadot-sdk"
    fi
    
    ln -s "$(cd "${EXISTING_SDK}" && pwd)" "${CHAIN_DIR}/polkadot-sdk"
    echo "✓ Symlink created"
else
    echo "polkadot-sdk not found at parent directory"
    echo "Cloning polkadot-sdk into chain/ ..."
    
    cd "${CHAIN_DIR}"
    git clone https://github.com/paritytech/polkadot-sdk.git
    echo "✓ polkadot-sdk cloned"
fi

echo ""
echo "========================================="
echo "Setup complete! Next steps:"
echo "========================================="
echo ""
echo "1. Run: make build    (builds everything)"
echo "2. Run: make worker   (test worker in demo mode)"
echo "3. See README.md for full instructions"
echo ""
