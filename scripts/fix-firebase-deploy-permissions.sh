#!/usr/bin/env bash
# Run from an authenticated GCP Cloud Shell or workstation with permission to
# update project IAM. Use the client_email from FIREBASE_SERVICE_ACCOUNT_JSON,
# not the separate GitHub WIF/backend deployer. Never paste the key into a shell.
# Idempotent: adds one binding without replacing existing policy or roles.
set -euo pipefail

FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-misha-wedding}"
FIREBASE_SA_EMAIL="${FIREBASE_SA_EMAIL:-firebase-adminsdk-fbsvc@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo 'gcloud is required. Run this script in GCP Cloud Shell or an authenticated workstation.' >&2
  exit 1
fi

echo "Granting Service Usage Viewer on ${FIREBASE_PROJECT_ID} to ${FIREBASE_SA_EMAIL}"
gcloud projects add-iam-policy-binding "${FIREBASE_PROJECT_ID}" \
  --member "serviceAccount:${FIREBASE_SA_EMAIL}" \
  --role roles/serviceusage.serviceUsageViewer \
  --condition=None \
  --quiet \
  >/dev/null

echo 'Permission granted. Rerun the failed frontends deployment job after IAM propagation.'
