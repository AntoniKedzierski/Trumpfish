#!/usr/bin/env bash
#
# Runs on the virtual machine, sent there by the pipeline through `az vm run-command invoke`. Never run by hand from a
# developer machine - it has no way of reaching the containers from there. To deploy by hand, log in over SSH and run the
# two compose commands documented at the top of compose.prod.yaml.
#
# Arguments, in this order, because run-command hands named parameters to the script positionally:
#   $1  full reference of the image to run, for instance ghcr.io/antonikedzierski/trumpfish:sha-<commit>
#   $2  registry user
#   $3  registry token, valid only for as long as the pipeline job that issued it
#
# The run-command API reports a script that exited non zero the same way it reports one that succeeded, so the last line
# this prints is what the pipeline actually checks. Every path that does not reach the end of the file is a failure.

# The run-command handler hands the script to /bin/sh, which on Ubuntu is dash: `set -o pipefail` below is a syntax error
# there and the script would die on its first line with a message that says nothing useful. Re-run under bash instead.
if [ -z "${BASH_VERSION:-}" ]; then
    exec /bin/bash "$0" "$@"
fi

set -euo pipefail

IMAGE=${1:?brak referencji obrazu}
REGISTRY_USER=${2:?brak użytkownika rejestru}
REGISTRY_TOKEN=${3:?brak tokenu rejestru}

DIR=/opt/trumpfish
COMPOSE_FILE="$DIR/compose.prod.yaml"
ENV_FILE="$DIR/.env"

# How long the new container gets to report itself healthy. The image's own health check waits 60 seconds before its
# first probe and then probes every 30, and on an empty database the first start also applies the migrations and the
# seed files, so anything much shorter than this would call a healthy deployment a failed one.
HEALTH_TIMEOUT=240

for file in "$COMPOSE_FILE" "$ENV_FILE"; do
    if [ ! -f "$file" ]; then
        echo "Brak pliku $file - maszyna nie jest przygotowana do wdrożenia." >&2
        exit 1
    fi
done

compose() {
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "==> Logowanie do rejestru"
# --password-stdin keeps the token out of the process list, where every other user on the machine can read it.
echo "$REGISTRY_TOKEN" | docker login "${IMAGE%%/*}" --username "$REGISTRY_USER" --password-stdin
# Dropped however this ends: the token expires with the pipeline job anyway, and a stale credential left on the disk is
# one more thing to explain when a later pull fails.
trap 'docker logout "${IMAGE%%/*}" > /dev/null 2>&1 || true' EXIT

echo "==> Pobranie obrazu $IMAGE"
# Compose reads TRUMPFISH_IMAGE from .env, where it is the moving `latest` tag; a variable exported here takes precedence
# over the file, which is how this deployment pins the exact commit without editing anything on the machine.
export TRUMPFISH_IMAGE="$IMAGE"
compose pull app

echo "==> Uruchomienie"
compose up -d

echo "==> Oczekiwanie na gotowość aplikacji"
CONTAINER=$(compose ps -q app)
if [ -z "$CONTAINER" ]; then
    echo "Kontener aplikacji nie wstał." >&2
    exit 1
fi

DEADLINE=$(( $(date +%s) + HEALTH_TIMEOUT ))
while true; do
    STATE=$(docker inspect -f '{{.State.Status}}' "$CONTAINER")
    HEALTH=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}brak{{end}}' "$CONTAINER")

    if [ "$HEALTH" = "healthy" ]; then
        echo "    aplikacja odpowiada"
        break
    fi

    # A container that stopped on its own is never going to become healthy, so there is no point waiting out the clock.
    if [ "$STATE" != "running" ]; then
        echo "Kontener aplikacji zatrzymał się (stan: $STATE). Ostatnie logi:" >&2
        docker logs --tail 100 "$CONTAINER" >&2 || true
        exit 1
    fi

    if [ "$(date +%s)" -ge "$DEADLINE" ]; then
        echo "Aplikacja nie zgłosiła gotowości w ciągu ${HEALTH_TIMEOUT}s (stan zdrowia: $HEALTH). Ostatnie logi:" >&2
        docker logs --tail 100 "$CONTAINER" >&2 || true
        exit 1
    fi

    sleep 5
done

echo "==> Porządki"
# A 32 GB disk fills up on its own otherwise, one image per deployment. The week that is kept is what a rollback by hand
# reaches for: `TRUMPFISH_IMAGE=<starszy tag> docker compose -f compose.prod.yaml --env-file .env up -d`.
docker image prune --all --force --filter "until=168h" || true

# The pipeline greps for exactly this. Nothing may be printed after it.
echo "WDROZENIE_OK $IMAGE"
