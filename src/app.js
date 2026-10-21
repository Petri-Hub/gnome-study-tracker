import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import {
    addWater,
    createState,
    dayLevel,
    dayScore,
    DEFAULT_SETTINGS,
    getDay,
    normalize,
    prune,
    recordFocus,
    toggleSun,
    toggleWalk,
} from './core/state.js';
import {
    idleTimer,
    nextMode,
    pause,
    remainingMs,
    reset,
    start,
} from './core/timer.js';
import {PanelIndicator} from './panel.js';
import {Popup} from './popup.js';
import {sound} from './sound.js';
import {Store} from './store.js';
import {exportTestInterface} from './testInterface.js';

const TICK_INTERVAL_SECONDS = 1;
const STATE_PRUNE_DAYS = 400;

const SETTING_STEPS = {
    waterGoalMl: {min: 500, max: 5000, step: 250},
    waterStepMl: {min: 50, max: 1000, step: 50},
    focusMinutes: {min: 5, max: 180, step: 5},
    breakMinutes: {min: 5, max: 180, step: 5},
    soundVolume: {min: 0, max: 100, step: 10},
};

export class StudyTracker {
    constructor() {
        this._store = new Store();
        this._state = null;
        this._panel = null;
        this._popup = null;
        this._popupOpen = false;
        this._tickId = 0;
        this._clockOffset = 0;
        this._test = null;
    }

    enable() {
        const loaded = this._store.load();
        this._state = normalize(loaded ?? createState());
        if (loaded && (Number(loaded.version) || 1) < this._state.version)
            this._persist();
        sound.setEnabled(this._state.settings.sound);
        sound.setVolume(this._state.settings.soundVolume);
        this._recoverExpired();
        this._panel = new PanelIndicator();
        this._popup = new Popup(this);
        this._popup.attach(this._panel.button.menu);
        this._sync();
        this._ensureTick();
        this._test = exportTestInterface(this);
    }

    disable() {
        this._test?.unexport();
        this._test = null;
        this._stopTick();
        this._popup?.destroy();
        this._panel?.destroy();
        this._popup = null;
        this._panel = null;
        this._state = null;
    }

    get state() {
        return this._state;
    }

    now() {
        return Date.now() + this._clockOffset;
    }

    setPopupOpen(open) {
        this._popupOpen = open;
        if (open)
            sound.play('popup');
    }

    addWater(milliliters) {
        const before = getDay(this._state, this.now())?.water ?? 0;
        addWater(this._state, this.now(), milliliters);
        const after = getDay(this._state, this.now())?.water ?? 0;
        if (after !== before)
            sound.play('water');
        this._afterChange();
    }

    toggleSun() {
        this._toggleHabit('sun', toggleSun);
    }

    toggleWalk() {
        this._toggleHabit('walk', toggleWalk);
    }

    _toggleHabit(key, toggle) {
        const before = Boolean(getDay(this._state, this.now())?.[key]);
        toggle(this._state, this.now());
        const after = Boolean(getDay(this._state, this.now())?.[key]);
        if (after !== before)
            sound.play(after ? 'on' : 'off');
        this._afterChange();
    }

    toggleTimer() {
        const mode = this._state.viewMode;
        const before = this._state.timers[mode].status;
        const now = this.now();
        if (before === 'running') {
            this._state.timers[mode] = pause(this._state.timers[mode], now);
        } else {
            this._pauseOther(mode, now);
            this._state.timers[mode] = start(
                this._state.timers[mode], now, this._state.settings);
        }
        const after = this._state.timers[mode].status;
        if (after !== before)
            sound.play(after === 'running' ? 'on' : 'off');
        this._afterChange();
    }

    startTimer() {
        const mode = this._state.viewMode;
        const before = this._state.timers[mode].status;
        const now = this.now();
        this._pauseOther(mode, now);
        this._state.timers[mode] = start(
            this._state.timers[mode], now, this._state.settings);
        if (before !== 'running')
            sound.play('on');
        this._afterChange();
    }

    pauseTimer() {
        const mode = this._state.viewMode;
        const before = this._state.timers[mode].status;
        this._state.timers[mode] = pause(this._state.timers[mode], this.now());
        if (before === 'running' && this._state.timers[mode].status === 'paused')
            sound.play('off');
        this._afterChange();
    }

    resetTimer() {
        const mode = this._state.viewMode;
        this._state.timers[mode] = reset(
            this._state.timers[mode], this._state.settings);
        sound.play('click');
        this._afterChange();
    }

    selectMode(mode) {
        const next = mode === 'break' ? 'break' : 'focus';
        if (next === this._state.viewMode)
            return;
        this._state.viewMode = next;
        sound.play('click');
        this._afterChange();
    }

    toggleSetting(key) {
        if (!(key in this._state.settings))
            return;
        const was = this._state.settings[key];
        if (typeof was !== 'boolean')
            return;
        this._state.settings[key] = !was;
        if (key === 'sound') {
            if (was) {
                sound.play('off');
                sound.setEnabled(false);
            } else {
                sound.setEnabled(true);
                sound.play('on');
            }
        } else {
            sound.play(this._state.settings[key] ? 'on' : 'off');
        }
        this._afterChange();
    }

    adjustSetting(key, delta) {
        const limits = SETTING_STEPS[key];
        if (!limits || !Number.isFinite(delta))
            return;

        const current = Number(this._state.settings[key]);
        let next = current + delta * limits.step;
        if (delta < 0 && current <= limits.min)
            next = current;
        else if (delta > 0 && current >= limits.max)
            next = current;
        next = Math.min(limits.max, Math.max(limits.min, next));
        if (next === current)
            return;

        this._state.settings[key] = next;
        if (key === 'soundVolume') {
            sound.setVolume(next);
            sound.play('click');
        } else {
            if (key === 'focusMinutes' || key === 'breakMinutes')
                this._applyIdleDuration();
            sound.play('click');
        }
        this._afterChange();
    }

    resetSettings() {
        this._state.settings = {...DEFAULT_SETTINGS};
        sound.setEnabled(this._state.settings.sound);
        sound.setVolume(this._state.settings.soundVolume);
        this._applyIdleDuration();
        sound.play('click');
        this._afterChange();
    }

    _applyIdleDuration() {
        for (const mode of ['focus', 'break']) {
            if (this._state.timers[mode].status === 'idle')
                this._state.timers[mode] = idleTimer(mode, this._state.settings);
        }
    }

    _pauseOther(mode, now) {
        for (const other of ['focus', 'break']) {
            if (other === mode)
                continue;
            if (this._state.timers[other].status === 'running')
                this._state.timers[other] = pause(this._state.timers[other], now);
        }
    }

    _activeTimer() {
        const timers = this._state.timers;
        for (const mode of ['focus', 'break']) {
            if (timers[mode].status === 'running')
                return timers[mode];
        }
        const view = timers[this._state.viewMode];
        if (view.status === 'paused')
            return view;
        for (const mode of ['focus', 'break']) {
            if (timers[mode].status === 'paused')
                return timers[mode];
        }
        return view;
    }

    _anyRunning() {
        return ['focus', 'break'].some(mode =>
            this._state.timers[mode].status === 'running');
    }

    setActiveTab(tab) {
        this._panel?.setTab(tab);
    }

    setTab(tab) {
        this._popup.setTab(tab);
    }

    toggleDetails() {
        this._popup.toggleDetails();
    }

    toggleSettings() {
        this._popup.toggleSettings();
    }

    openMenu() {
        if (!this._panel.button.menu.isOpen)
            this._panel.button.menu.open();
    }

    closeMenu() {
        if (this._panel.button.menu.isOpen)
            this._panel.button.menu.close();
    }

    advance(seconds) {
        this._clockOffset += seconds * 1000;
        this._onTick();
    }

    async screenshot(path) {
        try {
            const stream = Gio.MemoryOutputStream.new_resizable();
            await new Shell.Screenshot().screenshot(false, stream);
            stream.close(null);
            const bytes = stream.steal_as_bytes();
            Gio.File.new_for_path(path).replace_contents(
                bytes.get_data(), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (error) {
            logError(error, 'Study Tracker: screenshot failed');
        }
    }

    snapshot() {
        const now = this.now();
        const day = getDay(this._state, now) ?? {
            water: 0, sun: false, walk: false, focus: 0, focusMinutes: 0,
        };
        const timer = this._state.timers[this._state.viewMode];
        const active = this._activeTimer();
        const menu = this._panel.button.menu.actor;
        return {
            now,
            panel: {
                label: this._panel.text,
                tab: this._panel.tab,
                tabLabel: this._panel.tabText,
                timer: this._panel.timerText,
                status: active.status,
            },
            popup: {
                open: this._popupOpen,
                width: menu.width,
                height: menu.height,
                contentHeight: this._popup.actor.height,
                tab: this._popup.tab,
                details: this._popup.detailsOpen,
                settings: this._popup.settingsOpen,
            },
            timer: {...timer, remaining: remainingMs(timer, now)},
            activeTimer: {...active, remaining: remainingMs(active, now)},
            timers: {
                focus: {
                    ...this._state.timers.focus,
                    remaining: remainingMs(this._state.timers.focus, now),
                },
                break: {
                    ...this._state.timers.break,
                    remaining: remainingMs(this._state.timers.break, now),
                },
            },
            viewMode: this._state.viewMode,
            settings: {...this._state.settings},
            day,
            score: dayScore(day, this._state.settings),
            level: dayLevel(day, this._state.settings),
            statePath: this._store.path,
        };
    }

    _afterChange() {
        this._persist();
        this._sync();
        this._ensureTick();
    }

    _sync() {
        const now = this.now();
        this._panel.update(this._activeTimer(), now);
        if (this._popupOpen)
            this._popup.update(this._state, now);
    }

    _persist() {
        try {
            prune(this._state, this.now(), STATE_PRUNE_DAYS);
            this._store.save(this._state);
        } catch (error) {
            logError(error, 'Study Tracker: failed to save state');
        }
    }

    _ensureTick() {
        if (!this._anyRunning()) {
            this._stopTick();
            return;
        }
        if (this._tickId)
            return;
        this._tickId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, TICK_INTERVAL_SECONDS, () => this._onTickSource());
    }

    _stopTick() {
        if (!this._tickId)
            return;
        GLib.source_remove(this._tickId);
        this._tickId = 0;
    }

    _onTickSource() {
        this._onTick();
        if (this._anyRunning())
            return GLib.SOURCE_CONTINUE;
        this._tickId = 0;
        return GLib.SOURCE_REMOVE;
    }

    _onTick() {
        const now = this.now();
        for (const mode of ['focus', 'break']) {
            const timer = this._state.timers[mode];
            if (timer.status !== 'running' || remainingMs(timer, now) > 0)
                continue;
            this._completeTimer(mode, timer, now);
        }
        this._sync();
    }

    _completeTimer(mode, timer, now) {
        const settings = this._state.settings;
        const minutes = timer.totalMs / 60000;
        const next = nextMode(mode);

        this._state.timers[mode] = idleTimer(mode, settings);
        this._state.timers[next] = idleTimer(next, settings);
        this._state.viewMode = next;

        if (mode === 'focus')
            recordFocus(this._state, now, minutes);
        if (settings.autoStartNext)
            this._state.timers[next] = start(
                this._state.timers[next], now, settings);

        this._persist();
        this._notify(
            mode === 'focus' ? 'Focus block complete' : 'Break over',
            mode === 'focus'
                ? `${Math.round(minutes)} minutes logged. Time for a ${settings.breakMinutes} minute break.`
                : 'Ready for the next focus block.');
        sound.play('complete');
    }

    _recoverExpired() {
        const settings = this._state.settings;
        let recovered = false;
        const now = this.now();

        for (const mode of ['focus', 'break']) {
            const timer = this._state.timers[mode];
            if (timer.status !== 'running' || remainingMs(timer, now) > 0)
                continue;

            const next = nextMode(mode);
            this._state.timers[mode] = idleTimer(mode, settings);
            this._state.timers[next] = idleTimer(next, settings);
            this._state.viewMode = next;
            if (mode === 'focus')
                recordFocus(this._state, now, timer.totalMs / 60000);
            recovered = true;
        }

        if (recovered)
            this._persist();
    }

    _notify(title, body) {
        if (GLib.getenv('STUDY_TRACKER_TEST'))
            return;
        try {
            Gio.DBus.session.call(
                'org.freedesktop.Notifications',
                '/org/freedesktop/Notifications',
                'org.freedesktop.Notifications',
                'Notify',
                new GLib.Variant('(susssasa{sv}i)', [
                    'Study Tracker', 0, 'appointment-soon-symbolic',
                    title, body, [], {}, 6000,
                ]),
                null, Gio.DBusCallFlags.NONE, -1, null, null);
        } catch (error) {
            logError(error, 'Study Tracker: notification failed');
        }
    }
}
