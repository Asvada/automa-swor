#!/bin/bash
set -e

cd "$(dirname "$0")"

PROXY_DIR=/home/grey/projects/vhost-proxy

# vhost-proxy owns the shared proxy-net network and terminates TLS for automa.lcl
docker compose -f "$PROXY_DIR/docker-compose.yml" up -d

docker compose up -d

# https is not decoration here: the keep-screen-awake button needs a secure context
./docker-generate-certs.sh
./docker-install-certs.sh
