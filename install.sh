#!/usr/bin/env bash
# Copies the extension into the user's GNOME Shell extensions directory and
# adds it to enabled-extensions. GNOME 49 only discovers new extensions at
# shell startup, so log out and back in afterwards.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
UUID=gnome-study-tracker@petri.local
DEST="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$UUID"

mkdir -p "$DEST"
rm -rf "$DEST/src" "$DEST/sounds" "$DEST/icons" "$DEST/tests" "$DEST/scripts" \
    "$DEST/renders" "$DEST/node_modules" "$DEST/.git"
rm -f "$DEST/install.sh" "$DEST/dev.sh" "$DEST/README.md" \
    "$DEST/package.json" "$DEST/.gitignore"

cp "$ROOT/extension.js" "$ROOT/metadata.json" "$ROOT/stylesheet.css" "$DEST/"
cp -r "$ROOT/src" "$DEST/src"
cp -r "$ROOT/sounds" "$DEST/sounds"
cp -r "$ROOT/icons" "$DEST/icons"

python3 - "$UUID" <<'PY'
import sys

from gi.repository import Gio

uuid = sys.argv[1]
settings = Gio.Settings.new('org.gnome.shell')
enabled = settings.get_strv('enabled-extensions')
if uuid not in enabled:
    enabled.append(uuid)
    settings.set_strv('enabled-extensions', enabled)
print(f"{uuid} enabled")
PY

echo "Installed to $DEST"
echo
echo "GNOME Shell 49 only discovers a new extension at startup."
echo "Log out and back in to load it."
