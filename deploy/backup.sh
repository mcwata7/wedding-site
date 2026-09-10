#!/usr/bin/env bash
# Nightly Postgres + media backup, run via cron on the VM. See SYSTEM_DESIGN.md §10 and
# docs/DECISIONS.md for why this replaces Render's managed-Postgres backups.
#
# Crontab entry (as the deploy user):
#   15 9 * * * BACKUP_BUCKET=<project>-wedding-backups /opt/wedding/deploy/backup.sh >> /var/log/wedding-backup.log 2>&1
#
# Test the restore before the wedding, not after -- an untested backup is not a backup:
#   gcloud storage cp gs://<bucket>/db/wedding-<ts>.dump /tmp/
#   pg_restore --clean --if-exists -U wedding -d wedding /tmp/wedding-<ts>.dump   # into a throwaway DB

set -euo pipefail

BUCKET="gs://${BACKUP_BUCKET:?set BACKUP_BUCKET to the GCS bucket name, e.g. my-project-wedding-backups}"
COMPOSE_FILE="/opt/wedding/deploy/compose.prod.yaml"
ENV_FILE="/opt/wedding/.env"
TS=$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  pg_dump -U wedding -d wedding --format=custom --compress=9 > "$TMP/wedding-$TS.dump"

# Uploaded planner images live on the media-data volume, not in the DB -- back them up too.
docker run --rm -v wedding_media-data:/data:ro -v "$TMP:/out" alpine \
  tar czf "/out/media-$TS.tar.gz" -C /data .

gcloud storage cp "$TMP/wedding-$TS.dump" "$BUCKET/db/"
gcloud storage cp "$TMP/media-$TS.tar.gz" "$BUCKET/media/"
echo "backup ok $TS"
