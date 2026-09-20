#!/usr/bin/env bash
# One-time setup for .github/workflows/deploy.yml: creates a "github-deployer" GCP service
# account, grants it just enough IAM to build/push the API image and SSH-restart the VM, wires
# it to GitHub via Workload Identity Federation (no long-lived GCP key stored in GitHub), and
# writes the resulting repo Variables/Secrets with `gh`. See SYSTEM_DESIGN.md §10 and
# docs/DECISIONS.md for why WIF over a service-account key.
#
# Requires locally: gcloud (authenticated against the target project), gh (authenticated,
# admin/write access to the repo's Actions secrets & variables).
#
# Idempotent -- safe to re-run. Every value below can be overridden via env var; defaults match
# this repo's actual GCP/GitHub setup.
set -euo pipefail

GCP_PROJECT_ID="${GCP_PROJECT_ID:-misha-wedding}"
GCP_REGION="${GCP_REGION:-us-west1}"
GCP_ZONE="${GCP_ZONE:-us-west1-b}"
GCP_VM_NAME="${GCP_VM_NAME:-wedding-vm}"
API_HOSTNAME="${API_HOSTNAME:-api.136-118-39-142.sslip.io}"
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-misha-wedding}"
GITHUB_REPO="${GITHUB_REPO:-mcwata7/wedding-site}"

DEPLOYER_SA_NAME="${DEPLOYER_SA_NAME:-github-deployer}"
DEPLOYER_SA_EMAIL="${DEPLOYER_SA_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
VM_SA_EMAIL="${VM_SA_EMAIL:-wedding-vm@${GCP_PROJECT_ID}.iam.gserviceaccount.com}"
POOL_ID="${POOL_ID:-github-pool}"
PROVIDER_ID="${PROVIDER_ID:-github-provider}"

echo "== Config =="
echo "  GCP_PROJECT_ID      = ${GCP_PROJECT_ID}"
echo "  GCP_REGION          = ${GCP_REGION}"
echo "  GCP_ZONE            = ${GCP_ZONE}"
echo "  GCP_VM_NAME         = ${GCP_VM_NAME}"
echo "  API_HOSTNAME        = ${API_HOSTNAME}"
echo "  FIREBASE_PROJECT_ID = ${FIREBASE_PROJECT_ID}"
echo "  GITHUB_REPO         = ${GITHUB_REPO}"
echo "  DEPLOYER_SA_EMAIL   = ${DEPLOYER_SA_EMAIL}"
echo

echo "== a. Enabling required GCP APIs =="
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  iap.googleapis.com \
  oslogin.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  --project "${GCP_PROJECT_ID}"

echo "== b. Creating deployer service account (if missing) =="
if gcloud iam service-accounts describe "${DEPLOYER_SA_EMAIL}" --project "${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "  ${DEPLOYER_SA_EMAIL} already exists"
else
  gcloud iam service-accounts create "${DEPLOYER_SA_NAME}" \
    --project "${GCP_PROJECT_ID}" \
    --display-name "GitHub Actions deployer"
fi

echo "== c. Granting project IAM roles to the deployer SA =="
for role in \
  roles/artifactregistry.writer \
  roles/compute.viewer \
  roles/compute.osAdminLogin \
  roles/iap.tunnelResourceAccessor \
  ; do
  echo "  granting ${role}"
  gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --member "serviceAccount:${DEPLOYER_SA_EMAIL}" \
    --role "${role}" \
    --condition=None \
    >/dev/null
done

echo "  granting roles/iam.serviceAccountUser on ${VM_SA_EMAIL} (needed to SSH into a VM running as that SA)"
gcloud iam service-accounts add-iam-policy-binding "${VM_SA_EMAIL}" \
  --project "${GCP_PROJECT_ID}" \
  --member "serviceAccount:${DEPLOYER_SA_EMAIL}" \
  --role roles/iam.serviceAccountUser \
  >/dev/null

echo "== d. Creating Workload Identity Pool + Provider =="
if gcloud iam workload-identity-pools describe "${POOL_ID}" --project "${GCP_PROJECT_ID}" --location=global >/dev/null 2>&1; then
  echo "  pool ${POOL_ID} already exists"
else
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --project "${GCP_PROJECT_ID}" \
    --location=global \
    --display-name="GitHub Actions pool"
fi

if gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
    --project "${GCP_PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" >/dev/null 2>&1; then
  echo "  provider ${PROVIDER_ID} already exists"
else
  # attribute-condition restricts token exchange to THIS repo only -- without it, any GitHub
  # repo in the world could impersonate the deployer SA.
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --project "${GCP_PROJECT_ID}" \
    --location=global \
    --workload-identity-pool="${POOL_ID}" \
    --display-name="GitHub provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
fi

PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)')"
PROVIDER_RESOURCE_NAME="$(gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
  --project "${GCP_PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" \
  --format='value(name)')"

echo "== e. Binding ${GITHUB_REPO} to the deployer SA =="
gcloud iam service-accounts add-iam-policy-binding "${DEPLOYER_SA_EMAIL}" \
  --project "${GCP_PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  >/dev/null

echo "== f. Writing GitHub repo Variables and Secrets (repo: ${GITHUB_REPO}) =="
gh variable set GCP_PROJECT_ID --repo "${GITHUB_REPO}" --body "${GCP_PROJECT_ID}"
gh variable set GCP_REGION --repo "${GITHUB_REPO}" --body "${GCP_REGION}"
gh variable set GCP_ZONE --repo "${GITHUB_REPO}" --body "${GCP_ZONE}"
gh variable set GCP_VM_NAME --repo "${GITHUB_REPO}" --body "${GCP_VM_NAME}"
gh variable set API_HOSTNAME --repo "${GITHUB_REPO}" --body "${API_HOSTNAME}"
gh variable set FIREBASE_PROJECT_ID --repo "${GITHUB_REPO}" --body "${FIREBASE_PROJECT_ID}"

gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo "${GITHUB_REPO}" --body "${PROVIDER_RESOURCE_NAME}"
gh secret set GCP_SERVICE_ACCOUNT --repo "${GITHUB_REPO}" --body "${DEPLOYER_SA_EMAIL}"

echo
echo "== Done: variables + WIF secrets are set. =="
echo
echo "== g. One remaining manual step: FIREBASE_SERVICE_ACCOUNT_JSON =="
echo "FirebaseExtended/action-hosting-deploy does not yet support Workload Identity, so this one"
echo "secret still has to be a long-lived JSON key. Create it deliberately, not via this script:"
echo
echo "  gcloud iam service-accounts keys create firebase-key.json \\"
echo "    --project ${GCP_PROJECT_ID} \\"
echo "    --iam-account firebase-adminsdk-fbsvc@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
echo
echo "  gh secret set FIREBASE_SERVICE_ACCOUNT_JSON --repo ${GITHUB_REPO} < firebase-key.json"
echo "  rm firebase-key.json"
echo
echo "If key creation is blocked by an org policy (iam.disableServiceAccountKeyCreation), mint"
echo "the key from the Firebase console instead: Project settings -> Service accounts ->"
echo "Generate new private key."
