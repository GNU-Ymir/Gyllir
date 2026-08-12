#!/bin/sh
#
# Copy the 'version' declared in gyllir.toml into the '__GYLLIR_VERSION__' constant of
# src/gyllir/args.yr, so that 'gyllir --version' reports the version of the package it was
# built from. Declared as a pre build command in the '[commands]' table of gyllir.toml.
#

set -e

CONFIG=gyllir.toml
ARGS=src/gyllir/args.yr

VERSION=$(sed -nE 's/^version = "([0-9]+\.[0-9]+\.[0-9]+)".*/\1/p' "$CONFIG")
test -n "$VERSION" || { echo "set-version: could not read 'version' from $CONFIG" >&2; exit 1; }

TMP=$(mktemp "${ARGS}.XXXXXX")
trap 'rm -f "$TMP"' EXIT

sed -E "s|^pub def __GYLLIR_VERSION__ = \"[^\"]*\";|pub def __GYLLIR_VERSION__ = \"$VERSION\";|" \
    "$ARGS" > "$TMP"

grep -q "^pub def __GYLLIR_VERSION__ = \"$VERSION\";$" "$TMP" \
    || { echo "set-version: no '__GYLLIR_VERSION__' declaration found in $ARGS" >&2; exit 1; }

# only touch the file when it actually changes, an unconditional write would invalidate the
# incremental build cache of every module depending on args.yr
if ! cmp -s "$TMP" "$ARGS"; then
    cat "$TMP" > "$ARGS"
    echo "set-version: $ARGS updated to $VERSION"
fi
