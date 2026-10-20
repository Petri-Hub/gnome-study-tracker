#!/usr/bin/env bash
# Runs the extension in an isolated shell so it can be tried without touching
# the live session. `./dev.sh` opens a Mutter development-kit window;
# `./dev.sh --headless` boots a virtual-monitor shell for CI or screenshots.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
UUID=gnome-study-tracker@petri.local
MODE=${1:-nested}

if [ "$MODE" != "--headless" ] && [ ! -x /usr/libexec/mutter-devkit ]; then
    cat >&2 <<'EOF'
GNOME Shell 49 uses the Mutter development kit for a windowed dev shell, but
/usr/libexec/mutter-devkit is missing. Install it first (Debian/Ubuntu):

    sudo apt install mutter-dev-bin

Then run ./dev.sh again. For the headless screenshot shell, use:
    ./dev.sh --headless
EOF
    exit 1
fi

TMP=$(mktemp -d "${TMPDIR:-/tmp}/study-tracker-dev.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

EXT="$TMP/data/gnome-shell/extensions/$UUID"
mkdir -p "$TMP/data/gnome-shell/extensions" "$TMP/config/glib-2.0/settings"
cp -r "$ROOT" "$EXT"
rm -rf "$EXT/.git" "$EXT/node_modules" "$EXT/renders" "$EXT/tests" "$EXT/scripts"

printf "[org/gnome/shell]\nenabled-extensions=['%s']\n" "$UUID" \
    > "$TMP/config/glib-2.0/settings/keyfile"

export XDG_DATA_HOME="$TMP/data"
export XDG_CONFIG_HOME="$TMP/config"
export XDG_CACHE_HOME="$TMP/cache"
export GSETTINGS_BACKEND=keyfile

if [ "$MODE" = "--headless" ]; then
    mkdir -p "$TMP/runtime"
    chmod 700 "$TMP/runtime"
    export XDG_RUNTIME_DIR="$TMP/runtime"
    exec dbus-run-session -- gnome-shell \
        --headless --wayland --no-x11 \
        --virtual-monitor 1280x800 \
        --wayland-display=study-tracker-dev
fi

# Desktop mode needs the real XDG_RUNTIME_DIR for the parent Wayland socket.
# GNOME Shell 49 replaced the old --nested flag with the development kit.
exec dbus-run-session -- gnome-shell --devkit --wayland
