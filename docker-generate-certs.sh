#!/bin/bash
# Self-signed certificate for automa.lcl, so the site is served over https.
# Not cosmetic: the Screen Wake Lock API (the "keep screen awake" button) is only
# exposed in a secure context, so over plain http that control hides itself.
# Same shape as ~/projects/globusbar.com.ua - vhost-proxy terminates TLS, this
# only produces the key pair it serves.
set -e

cd "$(dirname "$0")"

CERT_DIR="./docker-certs"
NAME="automa.lcl"
CRT="$CERT_DIR/$NAME.crt"
KEY="$CERT_DIR/$NAME.key"
CSR="$CERT_DIR/$NAME.csr"
EXT="$CERT_DIR/$NAME.ext"

# Renew threshold - 30 days
RENEW_THRESHOLD=$((30*24*60*60))

mkdir -p "$CERT_DIR"

regen_cert=false

if [ ! -f "$CRT" ] || [ ! -f "$KEY" ]; then
    echo "[Cert Generator] No existing certificate found. Generating..."
    regen_cert=true
else
    if ! openssl x509 -checkend "$RENEW_THRESHOLD" -noout -in "$CRT" > /dev/null 2>&1; then
        echo "[Cert Generator] Certificate expiring soon. Regenerating..."
        regen_cert=true
    fi
fi

if [ "$regen_cert" = true ]; then
    echo "[Cert Generator] Generating new SAN self-signed SSL certificate..."

    cat > "$EXT" <<INNER
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
subjectAltName=@alt_names

[alt_names]
DNS.1=automa.lcl
DNS.2=www.automa.lcl
INNER
    openssl req -new -nodes -newkey rsa:4096 \
        -keyout "$KEY" \
        -out "$CSR" \
        -subj "/C=UA/ST=Kyiv/L=Kyiv/O=automa.lcl/OU=automa.lcl/CN=automa.lcl"

    openssl x509 -req -days 825 -in "$CSR" -signkey "$KEY" -out "$CRT" -extfile "$EXT"

    echo "[Cert Generator] New certificate generated at $CRT"
    echo "[Cert Generator] Don't forget to trust the self-signed certificate on the host."
    # trust-cert.sh needs sudo. Prompting is fine when a human is running start.sh,
    # but not from a script or a CI-ish shell, where it would just hang or abort the
    # whole run - so there it only says what is left to do.
    if [ -t 0 ]; then
        echo "[Cert Generator] On Linux: running ./trust-cert.sh below (it needs sudo)."
        ./trust-cert.sh
    else
        echo "[Cert Generator] On Linux: run ./trust-cert.sh yourself - it needs sudo,"
        echo "[Cert Generator] and there is no terminal here to ask for the password."
    fi
    echo
    echo "[Cert Generator] On Windows: run ./trust-cert.bat as Administrator, outside WSL."
    echo
else
    echo "[Cert Generator] Existing certificate is valid."
fi
