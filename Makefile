# Manual/local deploy helpers -- lets you ship a change from your laptop without waiting on a
# push to main. Mirrors .github/workflows/deploy.yml (see that file for the CI path and the
# one-time GCP/Firebase setup this also depends on) and deploy/compose.prod.yaml. See
# SYSTEM_DESIGN.md §10 for the overall hosting architecture.
#
# Requires locally: gcloud (authenticated: `gcloud auth login`), firebase-tools (authenticated:
# `firebase login`), Docker with buildx, node, git.
#
# Config: reads GCP_REGION, GCP_ZONE, GCP_VM_NAME, API_HOSTNAME from .env (see .env.example --
# these mirror the GCP_* repo Variables the deploy.yml workflow uses in CI). GCP_PROJECT_ID and
# FIREBASE_PROJECT_ID default from your gcloud config / .firebaserc if not set in .env.

-include .env
export

GCP_PROJECT_ID ?= $(shell gcloud config get-value project 2>/dev/null)
FIREBASE_PROJECT_ID ?= $(shell node -pe "JSON.parse(require('fs').readFileSync('.firebaserc')).projects.default" 2>/dev/null)

SHA := $(shell git rev-parse --short HEAD)
IMAGE := $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT_ID)/wedding/api

.PHONY: help deploy deploy-backend deploy-public deploy-internal \
	build-public build-internal test-backend check-env print-config

help: ## Show this help
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deploy: deploy-backend deploy-public deploy-internal ## Deploy all three services (BE, public FE, internal FE)

check-env: ## Verify required config is set (from .env or gcloud/.firebaserc defaults)
	@test -n "$(GCP_PROJECT_ID)" || (echo "GCP_PROJECT_ID not set -- run 'gcloud config set project ...' or set it in .env" && exit 1)
	@test -n "$(GCP_REGION)" || (echo "GCP_REGION not set in .env (e.g. us-west1)" && exit 1)
	@test -n "$(GCP_ZONE)" || (echo "GCP_ZONE not set in .env (e.g. us-west1-b)" && exit 1)
	@test -n "$(GCP_VM_NAME)" || (echo "GCP_VM_NAME not set in .env" && exit 1)
	@test -n "$(API_HOSTNAME)" || (echo "API_HOSTNAME not set in .env (e.g. api.34-1-2-3.sslip.io)" && exit 1)
	@test -n "$(FIREBASE_PROJECT_ID)" || (echo "FIREBASE_PROJECT_ID could not be resolved -- set it in .env" && exit 1)

print-config: ## Print resolved deploy config (for debugging)
	@echo "GCP_PROJECT_ID      = $(GCP_PROJECT_ID)"
	@echo "GCP_REGION          = $(GCP_REGION)"
	@echo "GCP_ZONE            = $(GCP_ZONE)"
	@echo "GCP_VM_NAME         = $(GCP_VM_NAME)"
	@echo "API_HOSTNAME        = $(API_HOSTNAME)"
	@echo "FIREBASE_PROJECT_ID = $(FIREBASE_PROJECT_ID)"
	@echo "IMAGE               = $(IMAGE):$(SHA)"

test-backend: ## Run backend tests (H2, no Postgres needed)
	cd backend && ./gradlew test

deploy-backend: check-env ## Build+push the API image to Artifact Registry, then pull/restart it on the GCP VM
	gcloud auth configure-docker $(GCP_REGION)-docker.pkg.dev --quiet
	docker buildx build --platform linux/amd64 \
		-t $(IMAGE):$(SHA) -t $(IMAGE):latest \
		--push backend
	gcloud compute ssh $(GCP_VM_NAME) \
		--zone "$(GCP_ZONE)" \
		--tunnel-through-iap \
		--command "\
			set -euo pipefail; \
			cd /opt/wedding; \
			git fetch --depth 1 origin main; \
			git checkout -f origin/main -- deploy/; \
			API_IMAGE='$(IMAGE):$(SHA)' docker compose -f deploy/compose.prod.yaml --env-file /opt/wedding/.env up -d --pull always; \
			docker image prune -af --filter 'until=168h' \
		"
	curl -fsS "https://$(API_HOSTNAME)/actuator/health" | grep -q '"status":"UP"' && echo "backend: healthy"

build-public: ## Build the guest site (frontend/public)
	cd frontend/public && VITE_API_BASE_URL=https://$(API_HOSTNAME) npm ci && npm run build

deploy-public: check-env build-public ## Build+deploy the guest site to Firebase Hosting (target: guest)
	firebase deploy --only hosting:guest --project $(FIREBASE_PROJECT_ID)

build-internal: ## Build the planner UI (frontend/internal)
	cd frontend/internal && VITE_API_BASE_URL=https://$(API_HOSTNAME) npm ci && npm run build

deploy-internal: check-env build-internal ## Build+deploy the planner UI to Firebase Hosting (target: planner)
	firebase deploy --only hosting:planner --project $(FIREBASE_PROJECT_ID)
