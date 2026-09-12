#!/usr/bin/env bash
# Builds libdds.so for the container image.
#
# The library has to match the glibc of the runtime image, so the build runs inside the same Debian release rather than on
# whatever the developer happens to be running. The result is committed to native/linux-x64 - see README.md for why.
set -euo pipefail

DDS_VERSION="${DDS_VERSION:-v3.1.0}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p "$HERE/linux-x64"

# Git Bash rewrites anything that looks like a Unix path before it reaches Docker, which turns both halves of the volume
# argument into something the daemon has never heard of. Hand it a Windows path and switch the rewriting off.
MOUNT="$HERE"
if command -v cygpath > /dev/null 2>&1; then
    MOUNT="$(cygpath -w "$HERE")"
    export MSYS_NO_PATHCONV=1
fi

# The whole native folder is mounted, so the licence lands next to the library it belongs to.
docker run --rm -v "$MOUNT:/out" debian:trixie-slim bash -euo pipefail -c "
    apt-get update
    # The last three are not for the build but for Bazel's own hermetic LLVM: ld.lld and clang are prebuilt binaries that
    # link against the system libxml2, zlib and terminfo, and a slim image has none of them.
    apt-get install -y --no-install-recommends \
        ca-certificates curl git python3 unzip zip build-essential \
        libxml2 zlib1g libtinfo6

    # Bazelisk fetches the Bazel version the DDS repository pins in .bazelversion.
    curl -fsSL -o /usr/local/bin/bazel https://github.com/bazelbuild/bazelisk/releases/latest/download/bazelisk-linux-amd64
    chmod +x /usr/local/bin/bazel

    git clone --depth 1 --branch $DDS_VERSION https://github.com/dds-bridge/dds.git /dds
    cd /dds
    bazel build //jni:dds_shared

    cp bazel-bin/jni/libdds.so /out/linux-x64/libdds.so
    cp LICENSE /out/LICENSE-dds.txt
    chmod 644 /out/linux-x64/libdds.so /out/LICENSE-dds.txt
"

echo "Gotowe: $HERE/linux-x64/libdds.so"
