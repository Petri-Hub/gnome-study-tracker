#!/usr/bin/env python3
"""Driver for tests/e2e.sh. Runs inside a private D-Bus session."""
import json
import os
import re
import subprocess
import sys
import time

from gi.repository import Gio, GLib

DEST = "org.gnome.Shell"
PATH = "/org/gnome/Shell/Extensions/StudyTracker"
IFACE = "org.gnome.Shell.Extensions.StudyTracker"

STATE = os.path.join(
    os.environ["XDG_DATA_HOME"], "gnome-study-tracker", "state.json")
LOG = os.environ["STUDY_TRACKER_LOG"]

failures = []


def check(name, condition, detail=""):
    print(("ok   " if condition else "FAIL ") + name + (f" :: {detail}" if not condition else ""))
    if not condition:
        failures.append(name)


def snap(bus):
    result = bus.call_sync(
        DEST, PATH, IFACE, "Snapshot", None, None,
        Gio.DBusCallFlags.NONE, 2000, None)
    return json.loads(result.unpack()[0])


def call(bus, name, variant=None):
    bus.call_sync(DEST, PATH, IFACE, name, variant, None,
                  Gio.DBusCallFlags.NONE, 2000, None)


def take_shot(bus, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if os.path.exists(path):
        os.remove(path)
    bus.call_sync(DEST, PATH, IFACE, "Screenshot",
                  GLib.Variant("(s)", (path,)), None,
                  Gio.DBusCallFlags.NONE, 5000, None)
    deadline = time.time() + 5
    while time.time() < deadline:
        if os.path.exists(path) and os.path.getsize(path) > 0:
            break
        time.sleep(0.2)
    check(f"screenshot written: {os.path.basename(path)}",
          os.path.exists(path), path)


def wait_for_shell(bus, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            result = bus.call_sync(
                DEST, PATH, IFACE, "Ping", None, None,
                Gio.DBusCallFlags.NONE, 1000, None)
            if result.unpack()[0] == "pong":
                return
        except Exception:
            pass
        time.sleep(0.25)
    raise SystemExit("shell never exposed the test interface")


def main():
    log = open(LOG, "w")
    shell = subprocess.Popen(
        ["gnome-shell", "--headless", "--wayland", "--no-x11",
         "--virtual-monitor", "1280x800",
         "--wayland-display=study-tracker-e2e"],
        stdout=log, stderr=subprocess.STDOUT)

    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    try:
        wait_for_shell(bus)

        state = snap(bus)
        check("panel starts at 90m", state["panel"]["label"] == "90m",
              state["panel"]["label"])
        check("timer starts idle in focus mode",
              state["timer"]["status"] == "idle" and state["timer"]["mode"] == "focus")
        check("popup starts closed", state["popup"]["open"] is False)
        check("water goal starts at 2 L", state["settings"]["waterGoalMl"] == 2000,
              state["settings"])
        check("water scroll starts at 250 ml",
              state["settings"]["waterStepMl"] == 250, state["settings"])
        check("sound volume starts at 60",
              state["settings"]["soundVolume"] == 60, state["settings"])

        bus.call_sync(DEST, PATH, IFACE, "AddWater",
                      int_arg(250), None, Gio.DBusCallFlags.NONE, 2000, None)
        state = snap(bus)
        check("water adds up", state["day"]["water"] == 250, state["day"]["water"])
        check("state file is written", os.path.exists(STATE), STATE)

        bus.call_sync(DEST, PATH, IFACE, "ToggleSun", None, None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        state = snap(bus)
        check("sun toggles on", state["day"]["sun"] is True)
        check("score is 1 after sun only", state["score"] == 1, state["score"])

        bus.call_sync(DEST, PATH, IFACE, "OpenMenu", None, None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        time.sleep(0.8)
        state = snap(bus)
        check("menu opens", state["popup"]["open"] is True)
        check("popup has a real width", state["popup"]["width"] > 500,
              state["popup"]["width"])
        check("popup stays compact", 150 < state["popup"]["height"] < 280,
              state["popup"]["height"])
        check("drawers start collapsed",
              state["popup"]["details"] is False and state["popup"]["settings"] is False)

        bus.call_sync(DEST, PATH, IFACE, "Start", None, None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        state = snap(bus)
        check("timer runs", state["timer"]["status"] == "running")
        bus.call_sync(DEST, PATH, IFACE, "Advance", int_arg(5), None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        state = snap(bus)
        check("clock counts down", state["timer"]["remaining"] < 90 * 60 * 1000,
              state["timer"]["remaining"])
        check("panel shows mm:ss while running", ":" in state["panel"]["label"],
              state["panel"]["label"])

        call(bus, "SetMode", GLib.Variant("(s)", ("break",)))
        state = snap(bus)
        check("switching to break keeps focus running",
              state["viewMode"] == "break"
              and state["timer"]["mode"] == "break"
              and state["timer"]["status"] == "idle"
              and state["activeTimer"]["mode"] == "focus"
              and state["activeTimer"]["status"] == "running",
              (state["viewMode"], state["timer"], state["activeTimer"]))
        check("breaks default to 20m",
              state["timer"]["totalMs"] == 20 * 60 * 1000, state["timer"])

        call(bus, "SetMode", GLib.Variant("(s)", ("focus",)))
        state = snap(bus)
        check("switching back restores focus progress",
              state["timer"]["mode"] == "focus"
              and state["timer"]["status"] == "running"
              and state["timer"]["remaining"] > 80 * 60 * 1000,
              state["timer"])

        call(bus, "SetMode", GLib.Variant("(s)", ("break",)))
        call(bus, "Start")
        state = snap(bus)
        check("starting break pauses the focus block",
              state["timer"]["mode"] == "break"
              and state["timer"]["status"] == "running"
              and state["timers"]["focus"]["status"] == "paused",
              state["timers"])
        call(bus, "Pause")
        call(bus, "SetMode", GLib.Variant("(s)", ("focus",)))
        state = snap(bus)
        check("focus remains paused after visiting break",
              state["timer"]["mode"] == "focus"
              and state["timer"]["status"] == "paused"
              and state["timer"]["remaining"] > 80 * 60 * 1000,
              state["timer"])
        call(bus, "Start")
        state = snap(bus)
        check("focus resumes after the break visit",
              state["timer"]["status"] == "running", state["timer"])

        bus.call_sync(DEST, PATH, IFACE, "Advance", int_arg(5405), None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        state = snap(bus)
        check("focus completion switches to break",
              state["timer"]["mode"] == "break" and state["timer"]["status"] == "idle",
              state["timer"])
        check("focus session is logged", state["day"]["focus"] == 1, state["day"])
        check("focus minutes are logged", state["day"]["focusMinutes"] == 90,
              state["day"]["focusMinutes"])
        check("panel returns to 20m", state["panel"]["label"] == "20m",
              state["panel"]["label"])
        check("level counts sun + focus", state["level"] == 2, state["level"])

        bus.call_sync(DEST, PATH, IFACE, "AddWater", int_arg(1750), None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        state = snap(bus)
        check("water goal reached", state["day"]["water"] == 2000, state["day"]["water"])
        check("perfect day is level 3", state["level"] == 3, state["level"])

        # Return to the idle focus clock for the preview screenshot.
        bus.call_sync(DEST, PATH, IFACE, "SetMode", GLib.Variant("(s)", ("focus",)),
                      None, Gio.DBusCallFlags.NONE, 2000, None)
        state = snap(bus)

        shot = os.environ.get("STUDY_TRACKER_SHOT")
        compact_height = state["popup"]["contentHeight"]
        if shot:
            time.sleep(5)
            take_shot(bus, shot)

        bus.call_sync(DEST, PATH, IFACE, "ToggleDetails", None, None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        time.sleep(0.4)
        details_state = snap(bus)
        check("details drawer opens", details_state["popup"]["details"] is True)
        details_height = details_state["popup"]["contentHeight"]
        check("details drawer grows the popup",
              details_height > compact_height + 40,
              f"{compact_height} -> {details_height}")
        if shot:
            stem, ext = os.path.splitext(shot)
            take_shot(bus, f"{stem}-details{ext}")

        bus.call_sync(DEST, PATH, IFACE, "ToggleSettings", None, None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        time.sleep(0.4)
        settings_state = snap(bus)
        check("settings page opens", settings_state["popup"]["settings"] is True)
        check("settings page replaces the details drawer",
              settings_state["popup"]["details"] is False)
        check("settings page fits the compact popup",
              80 < settings_state["popup"]["contentHeight"] < 300,
              settings_state["popup"]["contentHeight"])
        if shot:
            stem, ext = os.path.splitext(shot)
            take_shot(bus, f"{stem}-settings{ext}")

        call(bus, "AdjustSetting", GLib.Variant("(si)", ("waterGoalMl", 1)))
        state = snap(bus)
        check("settings adjust the water goal",
              state["settings"]["waterGoalMl"] == 2250, state["settings"])
        call(bus, "AdjustSetting", GLib.Variant("(si)", ("waterStepMl", 1)))
        state = snap(bus)
        check("settings adjust the water scroll step",
              state["settings"]["waterStepMl"] == 300, state["settings"])
        call(bus, "AdjustSetting", GLib.Variant("(si)", ("focusMinutes", -1)))
        state = snap(bus)
        check("settings adjust the focus duration",
              state["settings"]["focusMinutes"] == 85, state["settings"])
        check("focus duration updates the idle clock",
              state["timer"]["totalMs"] == 85 * 60 * 1000
              and state["panel"]["label"] == "85m",
              (state["timer"], state["panel"]["label"]))
        call(bus, "AdjustSetting", GLib.Variant("(si)", ("breakMinutes", 1)))
        state = snap(bus)
        check("settings adjust the break duration",
              state["settings"]["breakMinutes"] == 25, state["settings"])
        call(bus, "AdjustSetting", GLib.Variant("(si)", ("soundVolume", -1)))
        state = snap(bus)
        check("settings adjust the sound volume",
              state["settings"]["soundVolume"] == 50, state["settings"])

        call(bus, "ResetSettings")
        state = snap(bus)
        defaults = state["settings"]
        check("reset restores the settings defaults",
              defaults["waterGoalMl"] == 2000
              and defaults["waterStepMl"] == 250
              and defaults["focusMinutes"] == 90
              and defaults["breakMinutes"] == 20
              and defaults["soundVolume"] == 60, defaults)
        check("reset returns the clock to 90m", state["panel"]["label"] == "90m",
              state["panel"]["label"])

        bus.call_sync(DEST, PATH, IFACE, "ToggleSettings", None, None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        time.sleep(0.4)
        state = snap(bus)
        check("settings closes back to the dashboard",
              state["popup"]["settings"] is False
              and state["popup"]["details"] is False)

        bus.call_sync(DEST, PATH, IFACE, "CloseMenu", None, None,
                      Gio.DBusCallFlags.NONE, 2000, None)
        time.sleep(0.4)
        state = snap(bus)
        check("menu closes", state["popup"]["open"] is False)

        with open(STATE) as handle:
            saved = json.load(handle)
        today = list(saved["days"].values())[-1]
        check("persisted water", today["water"] == 2000, today)
        check("persisted focus", today["focus"] == 1, today)
        check("persisted state version", saved["version"] == 3, saved["version"])
        check("persisted settings defaults",
              saved["settings"]["waterGoalMl"] == 2000
              and saved["settings"]["waterStepMl"] == 250
              and saved["settings"]["breakMinutes"] == 20
              and saved["settings"]["soundVolume"] == 60,
              saved["settings"])

    finally:
        shell.terminate()
        try:
            shell.wait(timeout=10)
        except subprocess.TimeoutExpired:
            shell.kill()
        log.close()

    output = open(LOG, errors="replace").read()
    pattern = r"(JS ERROR|TypeError|ReferenceError|CRITICAL)"
    errors = [line for line in output.splitlines()
              if "gnome-study-tracker@petri.local" in line
              and re.search(pattern, line)]
    check("no JS errors from the extension", not errors, "\n".join(errors[-10:]))

    if failures:
        print(f"\n{len(failures)} failure(s): {', '.join(failures)}")
        return 1
    print("\nall e2e checks passed")
    return 0


def int_arg(value):
    return GLib.Variant("(i)", (value,))


if __name__ == "__main__":
    sys.exit(main())
