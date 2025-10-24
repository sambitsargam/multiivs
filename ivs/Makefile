.PHONY: help build relay para-a para-b para-agg export register net worker clean

help:
	@echo "IVS Multi-Disease System - Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  build      - Build relay chain and all parachains"
	@echo "  relay      - Start relay chain"
	@echo "  para-a     - Start Disease-A parachain"
	@echo "  para-b     - Start Disease-B parachain"
	@echo "  para-agg   - Start Aggregator parachain"
	@echo "  export     - Export genesis artifacts for all parachains"
	@echo "  register   - Show parachain registration instructions"
	@echo "  net        - Start network via Zombienet"
	@echo "  worker     - Install worker dependencies and run demo"
	@echo "  clean      - Clean temporary files"
	@echo ""

build:
	@./scripts/build.sh

relay:
	@./scripts/relay.sh

para-a:
	@./scripts/para-a.sh

para-b:
	@./scripts/para-b.sh

para-agg:
	@./scripts/para-agg.sh

export:
	@./scripts/export-a.sh
	@./scripts/export-b.sh
	@./scripts/export-agg.sh

register:
	@./scripts/register.sh

net:
	@echo "Starting network with Zombienet..."
	@echo "Note: Ensure zombienet is installed"
	@echo "Download from: https://github.com/paritytech/zombienet/releases"
	@echo ""
	@if command -v zombienet >/dev/null 2>&1; then \
		cd configs && zombienet spawn zombienet.toml; \
	else \
		echo "Error: zombienet not found in PATH"; \
		echo "Install it or use manual launch (make relay, para-a, para-b, para-agg)"; \
		exit 1; \
	fi

worker:
	@echo "Setting up worker environment..."
	@cd worker && cp .env.example .env
	@cd worker && npm install
	@echo ""
	@echo "Running worker in DEMO mode..."
	@cd worker && DEMO=1 npm start

clean:
	@echo "Cleaning temporary files..."
	@rm -rf /tmp/disease-a /tmp/disease-b /tmp/aggregator
	@rm -rf chain/disease-a/para-*
	@rm -rf chain/disease-b/para-*
	@rm -rf chain/aggregator/para-*
	@echo "✓ Cleaned"
