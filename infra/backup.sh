#!/usr/bin/env bash
#
# Nightly database backup. Runs on the host from cron, dumps the database out of its container and uploads the result to
# Blob Storage using the machine's own managed identity - there is no storage key anywhere on this disk to be stolen.
#
# Restore a dump:
#   az login --identity
#   az storage blob download --account-name <konto> --auth-mode login --container-name pg-backups \
#       --name trumpfish-20260911T031500Z.sql.gz --file /tmp/restore.sql.gz
#   gunzip -c /tmp/restore.sql.gz | docker compose -f /opt/trumpfish/compose.prod.yaml --env-file /opt/trumpfish/.env \
#       exec -T db psql -U trumpfish -d trumpfish
#
# Test the restore at least once. A backup nobody has restored is a guess, not a backup.

set -euo pipefail

STORAGE_ACCOUNT=__STORAGE_ACCOUNT__
CONTAINER=pg-backups
COMPOSE="/opt/trumpfish/compose.prod.yaml"
ENV_FILE="/opt/trumpfish/.env"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
DUMP="$WORK/trumpfish-$STAMP.sql.gz"

# pg_dump runs inside the container over its local socket, so the database password is never needed here and never appears
# in the process list. A plain SQL dump rather than the custom format: it restores with psql alone, including from a laptop
# that has nothing installed but a Postgres client.
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" exec -T db \
    pg_dump -U trumpfish -d trumpfish --format=plain | gzip -9 > "$DUMP"

# An empty dump means something went wrong upstream of the pipe; uploading it would quietly replace a good backup history
# with a useless one.
if [ ! -s "$DUMP" ]; then
    logger -t trumpfish-backup -p user.err "zrzut $STAMP jest pusty, przerwano"
    exit 1
fi

az login --identity --allow-no-subscriptions --output none

# --overwrite false, so a repeated run can never destroy an existing backup.
az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" --auth-mode login \
    --container-name "$CONTAINER" \
    --name "trumpfish-$STAMP.sql.gz" \
    --file "$DUMP" \
    --overwrite false --output none

logger -t trumpfish-backup "kopia $STAMP wyslana ($(stat -c %s "$DUMP") B)"
