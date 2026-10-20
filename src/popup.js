import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {getDay} from './core/state.js';
import {sound} from './sound.js';
import {HabitCard} from './ui/habitCard.js';
import {HeatmapCard} from './ui/heatmapCard.js';
import {PomodoroCard} from './ui/pomodoroCard.js';
import {SettingsView} from './ui/settingsView.js';
import {TodayCard} from './ui/todayCard.js';
import {WaterCard} from './ui/waterCard.js';
import {WeekCard} from './ui/weekCard.js';
import {divider, layout} from './ui/helpers.js';

export class Popup {
    constructor(app) {
        this._app = app;
        this._detailsOpen = false;
        this._settingsOpen = false;

        this._sun = new HabitCard({
            key: 'sun',
            text: 'Sun',
            icon: 'weather-clear-symbolic',
            onToggle: () => app.toggleSun(),
        });
        this._walk = new HabitCard({
            key: 'walk',
            text: 'Walk',
            iconFile: 'study-walk-symbolic.svg',
            iconOnFile: 'study-walk-on-symbolic.svg',
            onToggle: () => app.toggleWalk(),
        });
        this._water = new WaterCard({onAdd: milliliters => app.addWater(milliliters)});
        this._heatmap = new HeatmapCard();
        this._week = new WeekCard();
        this._today = new TodayCard();
        this._pomodoro = new PomodoroCard({
            onToggle: () => app.toggleTimer(),
            onReset: () => app.resetTimer(),
            onMode: mode => app.selectMode(mode),
        });

        this._scoreDots = {};
        const dots = layout({spacing: 5, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        for (const key of ['water', 'sun', 'walk', 'focus']) {
            const dot = new St.Widget({
                style_class: `study-score-dot ${key}`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._scoreDots[key] = dot;
            dots.add_child(dot);
        }

        this._detailsIcon = new St.Icon({
            icon_name: 'pan-down-symbolic',
            icon_size: 11,
        });
        this._detailsButton = new St.Button({
            style_class: 'study-icon-button',
            can_focus: true,
            child: this._detailsIcon,
        });
        this._detailsButton.connect('clicked', () => this.toggleDetails());

        this._settingsButton = new St.Button({
            style_class: 'study-icon-button',
            can_focus: true,
            child: new St.Icon({
                icon_name: 'emblem-system-symbolic',
                icon_size: 12,
            }),
        });
        this._settingsButton.connect('clicked', () => this.toggleSettings());

        const header = layout({
            spacing: 6,
            x_expand: true,
            style_class: 'study-header',
        });
        header.add_child(dots);
        header.add_child(this._detailsButton);
        header.add_child(this._settingsButton);

        this.actor = layout({
            vertical: true,
            spacing: 0,
            x_expand: true,
        });
        this.actor.add_child(header);
        this.actor.add_child(divider(false));

        this._main = this._buildMain();
        this.actor.add_child(this._main);

        this._details = this._buildDetails();
        this._details.visible = false;
        this.actor.add_child(this._details);

        this._settings = new SettingsView({
            onAdjust: (key, delta) => app.adjustSetting(key, delta),
            onToggle: key => app.toggleSetting(key),
            onReset: () => app.resetSettings(),
            onDone: () => this.toggleSettings(),
        });
        this._settings.actor.visible = false;
        this.actor.add_child(this._settings.actor);
    }

    get detailsOpen() {
        return this._detailsOpen;
    }

    get settingsOpen() {
        return this._settingsOpen;
    }

    _buildMain() {
        const left = layout({
            vertical: true,
            spacing: 6,
            x_expand: false,
            style_class: 'study-pane-left',
        });
        left.add_child(this._sun.actor);
        left.add_child(this._walk.actor);
        left.add_child(this._water.actor);

        this._heatmap.actor.add_style_class_name('study-pane-heatmap');
        this._pomodoro.actor.add_style_class_name('study-pane-timer');

        const row = layout({spacing: 0, x_expand: true});
        row.add_child(left);
        row.add_child(divider(true));
        row.add_child(this._heatmap.actor);
        row.add_child(divider(true));
        row.add_child(this._pomodoro.actor);
        return row;
    }

    _buildDetails() {
        this._week.actor.add_style_class_name('study-pane-week');
        this._today.actor.add_style_class_name('study-pane-today');

        const row = layout({spacing: 0, x_expand: true});
        row.add_child(this._week.actor);
        row.add_child(divider(true));
        row.add_child(this._today.actor);

        const drawer = layout({vertical: true, spacing: 0, x_expand: true});
        drawer.add_child(divider(false));
        drawer.add_child(row);
        return drawer;
    }

    attach(menu) {
        menu.actor.add_style_class_name('study-popup');
        menu.setSourceAlignment(0.0);

        const section = new PopupMenu.PopupMenuSection();
        section.box.add_style_class_name('study-section');
        section.box.add_child(this.actor);
        menu.addMenuItem(section);

        menu.connect('open-state-changed', (source, open) => this.onOpenChanged(open));
    }

    onOpenChanged(open) {
        this._app.setPopupOpen(open);
        if (open) {
            this.setDetailsOpen(false);
            this.setSettingsOpen(false);
            this.update();
            this._water.startAnimation();
        } else {
            this._water.stopAnimation();
        }
    }

    toggleDetails() {
        sound.play('click');
        this.setDetailsOpen(!this._detailsOpen);
    }

    setDetailsOpen(open) {
        if (open && this._settingsOpen)
            this.setSettingsOpen(false);
        this._detailsOpen = open;
        this._details.visible = open;
        this._detailsIcon.set_icon_name(open ? 'pan-up-symbolic' : 'pan-down-symbolic');
        this._detailsButton.set_style_class_name(
            `study-icon-button${open ? ' on' : ''}`);
        if (open)
            this._reveal(this._details);
    }

    toggleSettings() {
        sound.play('click');
        this.setSettingsOpen(!this._settingsOpen);
    }

    setSettingsOpen(open) {
        if (open && this._detailsOpen)
            this.setDetailsOpen(false);

        this._settingsOpen = open;
        this._settings.actor.visible = open;
        this._main.visible = !open;
        this._detailsButton.visible = !open;
        this._settingsButton.set_style_class_name(
            `study-icon-button${open ? ' on' : ''}`);
        if (open) {
            this._settings.update(this._app.state.settings);
            this._reveal(this._settings.actor);
        }
    }

    _reveal(actor) {
        actor.opacity = 0;
        actor.ease({opacity: 255, duration: 140});
    }

    update(state = this._app.state, now = this._app.now()) {
        const day = getDay(state, now);
        const {settings} = state;

        this._setDot('water', (day?.water ?? 0) >= settings.waterGoalMl);
        this._setDot('sun', Boolean(day?.sun));
        this._setDot('walk', Boolean(day?.walk));
        this._setDot('focus', (day?.focus ?? 0) >= 1);

        this._sun.update(day);
        this._walk.update(day);
        this._water.update(day, settings);
        this._heatmap.update(state, now);
        this._week.update(state, now);
        this._today.update(day);
        this._pomodoro.update(state.timers[state.viewMode], now, day);
        this._settings.update(settings);
    }

    _setDot(key, on) {
        this._scoreDots[key].set_style_class_name(
            `study-score-dot ${key}${on ? ' on' : ''}`);
    }

    destroy() {
        this._water.stopAnimation();
    }
}
