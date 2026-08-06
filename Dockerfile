# syntax=docker/dockerfile:1

# gyc is not built from source here: it's downloaded as a prebuilt .deb release asset
# published by the gymir repo (github.com/GNU-Ymir/gymir/releases). GYC_RELEASE_TAG/GYC_ASSET
# have no default here on purpose - YMIR_VERSION at the repo root is the single source of
# truth for these, and every CI workflow computes them from it. To build locally:
#   . ./YMIR_VERSION
#   GCC_MAJOR="${GCC_VERSION%%.*}"
#   docker build \
#     --build-arg GYC_RELEASE_TAG="$YMIR_BOOTSTRAP_VERSION" \
#     --build-arg GYC_ASSET="gyc-${GCC_MAJOR}_${YMIR_BOOTSTRAP_VERSION}_amd64.deb" \
#     .
ARG GYC_RELEASE_TAG
ARG GYC_ASSET

FROM ubuntu:26.04 AS toolchain
ARG GYC_RELEASE_TAG
ARG GYC_ASSET
ENV DEBIAN_FRONTEND=noninteractive

RUN test -n "$GYC_RELEASE_TAG" && test -n "$GYC_ASSET" || \
    (echo "GYC_RELEASE_TAG and GYC_ASSET build-args are required - see YMIR_VERSION" >&2 && exit 1)

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl cmake build-essential git \
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

# GitManager's tests shell out to `git commit`/`git config --global --get user.*`, which need a
# configured identity - nothing in this image sets one otherwise (no host ~/.gitconfig here).
RUN git config --global user.email "ci@gyllir.local" \
    && git config --global user.name "Gyllir CI"

FROM toolchain AS build
WORKDIR /gyllir
COPY . .
RUN mkdir -p .build \
    && cd .build \
    && cmake .. \
    && make -j"$(nproc)" \
    && make install

FROM build AS test
RUN .build/gyllir_tests -sf

# Depends on `test` (not `build`) so a .deb can never be produced from a tree whose tests fail.
FROM test AS package
ARG GYLLIR_VERSION_NUMBER

RUN test -n "$GYLLIR_VERSION_NUMBER" || \
    (echo "GYLLIR_VERSION_NUMBER build-arg is required" >&2 && exit 1)

RUN mkdir -p /pkg/etc/bash_completion.d /pkg/DEBIAN \
    && cd .build && make install DESTDIR=/pkg && cd .. \
    && cp bash/_gyllir /pkg/etc/bash_completion.d/_gyllir

COPY packaging/control.in /pkg/DEBIAN/control
RUN sed -i "s/@GYLLIR_VERSION_NUMBER@/${GYLLIR_VERSION_NUMBER}/g" /pkg/DEBIAN/control \
    && dpkg-deb --build --root-owner-group /pkg "/gyllir_${GYLLIR_VERSION_NUMBER}_amd64.deb"
