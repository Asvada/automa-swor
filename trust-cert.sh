#!/bin/bash
# Adds the self-signed automa.lcl certificate to this machine's trust store, so the
# browser stops warning and the page counts as a secure context.
set -e

cd "$(dirname "$0")"

CERT_NAME="automa.lcl"
CERT_PATH="$(pwd)/docker-certs/${CERT_NAME}.crt"

if [ ! -f "$CERT_PATH" ]; then
  echo "Certificate not found at $CERT_PATH"
  echo "Run: ./docker-generate-certs.sh"
  exit 1
fi

echo "Copying certificate to trusted store..."
sudo cp "$CERT_PATH" "/usr/local/share/ca-certificates/${CERT_NAME}.crt"

echo "Updating trusted certificates..."
sudo update-ca-certificates

echo "Certificate trusted system-wide (Ubuntu/Linux)"
