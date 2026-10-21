import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {formatClock, formatMinutes} from './core/format.js';
import {remainingMs} from './core/timer.js';
import {getTab, DEFAULT_TAB} from './ui/tabs.js';
import {createTomatoIcon} from './ui/tomatoIcon.js';
import {layout} from './ui/helpers.js';

export class PanelIndicator {
    constructor() {
        this.button = new PanelMenu.Button(0.0, 'Study Tracker', false);
        this.button.add_style_class_name('study-panel');
        this.button.accessible_name = 'Study Tracker';

        this._tab = DEFAULT_TAB;
        this._tomato = createTomatoIcon({
            size: 14,
            styleClass: 'study-panel-icon',
        });
        this._tabLabel = new St.Label({
            text: '',
            style_class: 'study-panel-tab',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._separator = new St.Label({
            text: '·',
            style_class: 'study-panel-separator',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._timerLabel = new St.Label({
            text: '90m',
            style_class: 'study-panel-timer',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const box = layout({
            spacing: 5,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._tomato);
        box.add_child(this._tabLabel);
        box.add_child(this._separator);
        box.add_child(this._timerLabel);
        this.button.add_child(box);

        this.setTab(DEFAULT_TAB);
        this.button.menu.setSourceAlignment(0.0);
        Main.panel.addToStatusArea('study-tracker', this.button, -1, 'left');
    }

    get text() {
        return `${this._tabLabel.get_text()} · ${this._timerLabel.get_text()}`;
    }

    get timerText() {
        return this._timerLabel.get_text();
    }

    get tab() {
        return this._tab;
    }

    get tabText() {
        return this._tabLabel.get_text();
    }

    setTab(key) {
        const tab = getTab(key);
        this._tab = tab.key;
        this._tabLabel.set_text(tab.label);
    }

    update(timer, now) {
        const remaining = remainingMs(timer, now);
        this._timerLabel.set_text(timer.status === 'idle'
            ? formatMinutes(remaining)
            : formatClock(remaining));
        this._timerLabel.set_style_class_name(
            `study-panel-timer ${timer.mode} ${timer.status}`);
    }

    destroy() {
        this.button.destroy();
    }
}
