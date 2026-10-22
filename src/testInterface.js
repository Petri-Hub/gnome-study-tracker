import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {dayMs} from './core/state.js';

const OBJECT_PATH = '/org/gnome/Shell/Extensions/StudyTracker';

const XML = `
<node>
  <interface name="org.gnome.Shell.Extensions.StudyTracker">
    <method name="Ping">
      <arg type="s" direction="out"/>
    </method>
    <method name="Snapshot">
      <arg type="s" direction="out"/>
    </method>
    <method name="AddWater">
      <arg type="i" direction="in"/>
    </method>
    <method name="ToggleSun"/>
    <method name="ToggleWalk"/>
    <method name="ToggleTimer"/>
    <method name="Start"/>
    <method name="Pause"/>
    <method name="Reset"/>
    <method name="SetMode">
      <arg type="s" direction="in"/>
    </method>
    <method name="Advance">
      <arg type="i" direction="in"/>
    </method>
    <method name="OpenMenu"/>
    <method name="CloseMenu"/>
    <method name="SetTab">
      <arg type="s" direction="in"/>
    </method>
    <method name="ToggleDetails"/>
    <method name="ToggleSettings"/>
    <method name="ToggleHistory"/>
    <method name="SelectDay">
      <arg type="s" direction="in"/>
    </method>
    <method name="AddDayWater">
      <arg type="s" direction="in"/>
      <arg type="i" direction="in"/>
    </method>
    <method name="ToggleDayHabit">
      <arg type="s" direction="in"/>
      <arg type="s" direction="in"/>
    </method>
    <method name="AdjustSetting">
      <arg type="s" direction="in"/>
      <arg type="i" direction="in"/>
    </method>
    <method name="ResetSettings"/>
    <method name="Screenshot">
      <arg type="s" direction="in"/>
    </method>
  </interface>
</node>`;

/**
 * Test-only D-Bus surface. It is never exported unless STUDY_TRACKER_TEST=1,
 * so the shipped extension has no extra attack surface.
 */
export function exportTestInterface(app) {
    if (!GLib.getenv('STUDY_TRACKER_TEST'))
        return null;

    const implementation = {
        Ping: () => 'pong',
        Snapshot: () => JSON.stringify(app.snapshot()),
        AddWater: milliliters => app.addWater(milliliters),
        ToggleSun: () => app.toggleSun(),
        ToggleWalk: () => app.toggleWalk(),
        ToggleTimer: () => app.toggleTimer(),
        Start: () => app.startTimer(),
        Pause: () => app.pauseTimer(),
        Reset: () => app.resetTimer(),
        SetMode: mode => app.selectMode(mode),
        Advance: seconds => app.advance(seconds),
        OpenMenu: () => app.openMenu(),
        CloseMenu: () => app.closeMenu(),
        SetTab: tab => app.setTab(tab),
        ToggleDetails: () => app.toggleDetails(),
        ToggleSettings: () => app.toggleSettings(),
        ToggleHistory: () => app.toggleHistory(),
        SelectDay: key => app.selectHistoryDay(key),
        AddDayWater: (key, milliliters) => {
            const ms = dayMs(key);
            if (ms !== null)
                app.addWaterForDay(ms, milliliters);
        },
        ToggleDayHabit: (key, habit) => {
            const ms = dayMs(key);
            if (ms !== null)
                app.toggleDayHabit(ms, habit);
        },
        AdjustSetting: (key, delta) => app.adjustSetting(key, delta),
        ResetSettings: () => app.resetSettings(),
        Screenshot: path => app.screenshot(path),
    };

    const exported = Gio.DBusExportedObject.wrapJSObject(XML, implementation);
    exported.export(Gio.DBus.session, OBJECT_PATH);
    return exported;
}
