#!/bin/bash
# Hands the automa.lcl key pair to the shared vhost-proxy, which is what actually
# terminates TLS, and makes it regenerate its vhost config.
set -e

cd "$(dirname "$0")"

SRC_DIR="docker-certs"
NAME="automa.lcl"
TARGET_CONTAINER="vhost-proxy"
TARGET_DIR="/etc/nginx/certs"

echo "Starting ${TARGET_CONTAINER}..."
docker start ${TARGET_CONTAINER}
sleep 2  # give nginx a moment to start

if ! docker ps --format '{{.Names}}' | grep -q "^${TARGET_CONTAINER}$"; then
    echo "Error: ${TARGET_CONTAINER} is not running. Aborting."
    exit 1
fi

for EXT in crt key csr ext; do
    if [[ -f "$SRC_DIR/$NAME.$EXT" ]]; then
        docker cp "$SRC_DIR/$NAME.$EXT" "$TARGET_CONTAINER:$TARGET_DIR/$NAME.$EXT"
        echo "Copied $NAME.$EXT"
    else
        echo "Warning: $NAME.$EXT not found in $SRC_DIR"
    fi
done

# `nginx -s reload` only re-reads the existing config. It does NOT make docker-gen
# rebuild it from the template, so a vhost generated while the cert was still missing
# keeps its "ssl_reject_handshake on;" block and the browser goes on failing with
# ERR_SSL_UNRECOGNIZED_NAME_ALERT. Restarting forces a regeneration on boot.
echo "Restarting ${TARGET_CONTAINER} to regenerate vhost config..."
docker restart ${TARGET_CONTAINER}

for i in $(seq 1 15); do
    if docker exec ${TARGET_CONTAINER} nginx -t >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if docker exec ${TARGET_CONTAINER} grep -q "ssl_certificate .*${NAME}.crt" /etc/nginx/conf.d/default.conf; then
    echo "OK: ${NAME} vhost is serving ${SRC_DIR}/${NAME}.crt over HTTPS."
else
    echo "Warning: ${NAME} still has no ssl_certificate in the generated config."
    echo "         Is automa-nginx running with VIRTUAL_HOST=${NAME}?"
    exit 1
fi
