# syntax=docker/dockerfile:1

# Neither gyc nor gyllir is built from source here: both are downloaded as prebuilt .deb release
# assets - gyc from the gymir repo (github.com/GNU-Ymir/gymir/releases), gyllir from this repo's
# own releases (github.com/GNU-Ymir/Gyllir/releases). The tree is then built by that released
# gyllir, not by CMake. GYC_*/GYLLIR_* build-args have no default here on purpose - YMIR_VERSION
# at the repo root is the single source of truth for these, and every CI workflow computes them
# from it. To build locally:
#   . ./YMIR_VERSION
#   GCC_MAJOR="${GCC_VERSION%%.*}"
#   docker build \
#     --build-arg GYC_RELEASE_TAG="$YMIR_BOOTSTRAP_VERSION" \
#     --build-arg GYC_ASSET="gyc-${GCC_MAJOR}_${YMIR_BOOTSTRAP_VERSION}_amd64.deb" \
#     --build-arg GYLLIR_RELEASE_TAG="$GYLLIR_BOOTSTRAP_VERSION" \
#     --build-arg GYLLIR_ASSET="gyllir_${GYLLIR_BOOTSTRAP_VERSION}_amd64.deb" \
#     .
ARG GYC_RELEASE_TAG
ARG GYC_ASSET
ARG GYLLIR_RELEASE_TAG
ARG GYLLIR_ASSET

FROM ubuntu:26.04 AS toolchain
ARG GYC_RELEASE_TAG
ARG GYC_ASSET
ARG GYLLIR_RELEASE_TAG
ARG GYLLIR_ASSET
ENV DEBIAN_FRONTEND=noninteractive

RUN test -n "$GYC_RELEASE_TAG" && test -n "$GYC_ASSET" || \
    (echo "GYC_RELEASE_TAG and GYC_ASSET build-args are required - see YMIR_VERSION" >&2 && exit 1)

RUN test -n "$GYLLIR_RELEASE_TAG" && test -n "$GYLLIR_ASSET" || \
    (echo "GYLLIR_RELEASE_TAG and GYLLIR_ASSET build-args are required - see YMIR_VERSION" >&2 && exit 1)

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl build-essential git \
    && rm -rf /var/lib/apt/lists/*

# The gyc .deb depends on g++-<N>/gcc-<N>/libgc-dev/libdwarf-dev; `apt-get install ./file.deb`
# resolves those from the archive instead of a manual dpkg -i + apt --fix-broken dance.
RUN curl -fsSL -o /tmp/gyc.deb \
        "https://github.com/GNU-Ymir/gymir/releases/download/${GYC_RELEASE_TAG}/${GYC_ASSET}" \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/gyc.deb \
    && rm -f /tmp/gyc.deb \
    && rm -rf /var/lib/apt/lists/*

RUN gyc --version

# The gyllir that builds this repo: a previously published release of gyllir itself.
RUN curl -fsSL -o /tmp/gyllir.deb \
        "https://github.com/GNU-Ymir/Gyllir/releases/download/${GYLLIR_RELEASE_TAG}/${GYLLIR_ASSET}" \
    && apt-get update \
    && apt-get install -y --no-install-recommends /tmp/gyllir.deb \
    && rm -f /tmp/gyllir.deb \
    && rm -rf /var/lib/apt/lists/*

# GitManager's tests shell out to `git commit`/`git config --global --get user.*`, which need a
# configured identity - nothing in this image sets one otherwise (no host ~/.gitconfig here).
RUN git config --global user.email "ci@gyllir.local" \
    && git config --global user.name "Gyllir CI"

FROM toolchain AS build
WORKDIR /gyllir
COPY . .

# --dry compiles the unittest executable (./gyllir.test) without running it, so the test stage
# below (and CI, which wants to pass -cov) decides when and how it runs.
RUN gyllir test --dry

RUN gyllir build --release

FROM build AS test
RUN ./gyllir.test -sf

# Depends on `test` (not `build`) so a .deb can never be produced from a tree whose tests fail.
FROM test AS package
ARG GYLLIR_VERSION_NUMBER

RUN test -n "$GYLLIR_VERSION_NUMBER" || \
    (echo "GYLLIR_VERSION_NUMBER build-arg is required" >&2 && exit 1)

# Staged by hand now that CMake (and its `install` rules) is gone: the release binary in
# /usr/bin, the doc generator's static assets where doc/html/ressources.yr looks for them
# (/etc/gyllir/res/...), and the bash completion.
RUN mkdir -p /pkg/usr/bin /pkg/etc/gyllir/res /pkg/etc/bash_completion.d /pkg/DEBIAN \
    && install -m 0755 gyllir /pkg/usr/bin/gyllir \
    && cp -r res/html res/css res/js res/ico /pkg/etc/gyllir/res/ \
    && cp bash/_gyllir /pkg/etc/bash_completion.d/_gyllir

COPY packaging/control.in /pkg/DEBIAN/control
RUN sed -i "s/@GYLLIR_VERSION_NUMBER@/${GYLLIR_VERSION_NUMBER}/g" /pkg/DEBIAN/control \
    && dpkg-deb --build --root-owner-group /pkg "/gyllir_${GYLLIR_VERSION_NUMBER}_amd64.deb"
