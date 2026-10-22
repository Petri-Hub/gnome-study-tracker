#!/usr/bin/env bash
# Headless end-to-end test: boots a private GNOME Shell, loads the extension,
# drives it over the test-only D-Bus interface, and checks the persisted state.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/study-tracker-e2e.XXXXXX")
trap 'if [ "${KEEP_TMP:-0}" = 1 ]; then echo "kept $TMP"; else rm -rf "$TMP"; fi' EXIT

UUID=gnome-study-tracker@petri.local
EXT="$TMP/data/gnome-shell/extensions/$UUID"

mkdir -p "$TMP/data/gnome-shell/extensions" "$TMP/config/glib-2.0/settings" "$TMP/runtime"
chmod 700 "$TMP/runtime"

cp -r "$ROOT" "$EXT"
rm -rf "$EXT/renders" "$EXT/tests" "$EXT/.git"

printf "[org/gnome/shell]\nenabled-extensions=['%s']\n\n[org/gnome/desktop/notifications]\nshow-banners=false\n" "$UUID" \
    > "$TMP/config/glib-2.0/settings/keyfile"

if [ "${STUDY_TRACKER_SEED_HISTORY:-0}" = 1 ]; then
    mkdir -p "$TMP/data/gnome-study-tracker"
    python3 - "$TMP/data/gnome-study-tracker/state.json" <<'PY'
import datetime
import json
import random
import sys

rng = random.Random(7)
today = datetime.date.today()
days = {}
for offset in range(1, 120):
    day = today - datetime.timedelta(days=offset)
    if rng.random() < 0.16:
        continue
    water = rng.choice([0, 500, 1000, 1500, 2000, 2500, 2500])
    sun = rng.random() < 0.55
    focus = rng.choice([0, 1, 1, 2, 2, 3])
    days[day.isoformat()] = {
        "water": water,
        "sun": sun,
        "focus": focus,
        "focusMinutes": focus * 90,
    }
yesterday = (today - datetime.timedelta(days=1)).isoformat()
days[yesterday] = {
    "water": 2000,
    "sun": True,
    "walk": False,
    "focus": 2,
    "focusMinutes": 180,
}
with open(sys.argv[1], "w") as handle:
    json.dump({"version": 1, "days": days}, handle)
PY
fi

export XDG_DATA_HOME="$TMP/data"
export XDG_CONFIG_HOME="$TMP/config"
export XDG_CACHE_HOME="$TMP/cache"
export XDG_RUNTIME_DIR="$TMP/runtime"
export GSETTINGS_BACKEND=keyfile
export STUDY_TRACKER_TEST=1
export STUDY_TRACKER_LOG="$TMP/shell.log"

exec dbus-run-session -- python3 "$ROOT/tests/e2e-driver.py"
