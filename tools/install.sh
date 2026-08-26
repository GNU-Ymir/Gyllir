#!/bin/sh
#
# Install a locally built gyllir the way its '.deb' does : the executable in /usr/bin, the static
# assets of the documentation generator in /etc/gyllir/res (where 'doc/html/ressources.yr' reads
# them from) and the bash completion in /etc/bash_completion.d. Mirrors the 'package' stage of the
# Dockerfile, for a checkout whose assets have to be tried out without cutting a release first.
#
# '/etc/gyllir/res' is compiled into gyllir ('ressources::RES_ROOT'), so it cannot be relocated ;
# '--destdir' only stages the same absolute layout under a directory.
#
# Usage:
#   sudo tools/install.sh                # executable, documentation assets and completion
#   sudo tools/install.sh --assets-only  # only 'res/', to render pages with a locally built ./gyllir
#   tools/install.sh --destdir /pkg      # stage that layout under a directory, no root needed
#

set -e

BIN_DIR=/usr/bin
RES_DIR=/etc/gyllir/res
COMPLETION_DIR=/etc/bash_completion.d

DESTDIR=
ASSETS_ONLY=no

usage() {
    echo "usage: tools/install.sh [-a|--assets-only] [--destdir DIR]"
}

while [ $# -gt 0 ]; do
    case "$1" in
        -a|--assets-only) ASSETS_ONLY=yes ;;
        --destdir)
            shift
            DESTDIR=$1
            test -n "$DESTDIR" || { echo "install: --destdir needs a directory" >&2; exit 1; }
            ;;
        --destdir=*) DESTDIR=${1#--destdir=} ;;
        -h|--help) usage; exit 0 ;;
        *) echo "install: unknown option '$1'" >&2; usage >&2; exit 1 ;;
    esac
    shift
done

# every path written to below is absolute, so the caller can run this from anywhere
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

test -d res/html || { echo "install: no 'res/' directory in $ROOT" >&2; exit 1; }

if [ -z "$DESTDIR" ] && [ "$(id -u)" -ne 0 ]; then
    echo "install: writing to $RES_DIR needs root, re-run under sudo (or pass --destdir)" >&2
    exit 1
fi

# the assets directory is wiped rather than merged into : 'gyllir doc' copies the whole js/, css/
# and ico/ directories into every site it generates, so an asset left behind by an older install
# (jquery.min.js, bootdoc.js, ...) would be dragged into each of them
case "$RES_DIR" in
    */gyllir/res) ;;
    *) echo "install: refusing to remove '$RES_DIR', which is not a gyllir resource directory" >&2; exit 1 ;;
esac

rm -rf "$DESTDIR$RES_DIR"
mkdir -p "$DESTDIR$RES_DIR"
cp -r res/html res/css res/js res/ico "$DESTDIR$RES_DIR/"
echo "install: documentation assets -> $DESTDIR$RES_DIR"

if [ "$ASSETS_ONLY" = yes ]; then
    exit 0
fi

test -x gyllir || { echo "install: no './gyllir' executable, run 'gyllir build --release' first" >&2; exit 1; }

mkdir -p "$DESTDIR$BIN_DIR"
install -m 0755 gyllir "$DESTDIR$BIN_DIR/gyllir"
echo "install: executable -> $DESTDIR$BIN_DIR/gyllir"

mkdir -p "$DESTDIR$COMPLETION_DIR"
install -m 0644 bash/_gyllir "$DESTDIR$COMPLETION_DIR/_gyllir"
echo "install: bash completion -> $DESTDIR$COMPLETION_DIR/_gyllir"
