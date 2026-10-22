#!/usr/bin/env bash
# Boots a private headless GNOME Shell, opens the popup with sample data and
# saves a screenshot. Usage: scripts/preview.sh [output.png]
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SHOT=${1:-"$ROOT/renders/popup.png"}
case "$SHOT" in
    /*) ;;
    *) SHOT="$PWD/$SHOT" ;;
esac

mkdir -p "$(dirname "$SHOT")"
STUDY_TRACKER_SEED_HISTORY=1 STUDY_TRACKER_SHOT="$SHOT" bash "$ROOT/tests/e2e.sh"
echo "wrote $SHOT (plus -details, -history and -settings variants)"
