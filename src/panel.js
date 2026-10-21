import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {formatClock, formatMinutes} from './core/format.js';
import {remainingMs} from './core/timer.js';
import {getTab, DEFAULT_TAB} from './ui/tabs.js';
import {createTomatoIcon} from './ui/tomatoIcon.js';
import {layout} from './ui/helpers.js';

const MEDIA_ROLE = 'Media Controls';
const LEFT_BOX_INDEX = 1;

export class PanelIndicator {
    constructor() {
        this.button = new PanelMenu.Button(0.0, 'Study Tracker', false);
        this.button.add_style_class_name('study-panel');
        this.button.accessible_name = 'Study Tracker';

        this._tab = DEFAULT_TAB;
        this._leftBox = Main.panel._leftBox;
        this._orderSource = 0;
        this._orderIds = [];
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
        Main.panel.addToStatusArea('study-tracker', this.button, LEFT_BOX_INDEX, 'left');
        this._orderIds.push(
            this._leftBox.connect('child-added', () => this._scheduleOrder()),
            this._leftBox.connect('child-removed', () => this._scheduleOrder()));
        this._scheduleOrder();
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

    get box() {
        const parent = this.button.container.get_parent();
        if (parent === Main.panel._leftBox)
            return 'left';
        if (parent === Main.panel._centerBox)
            return 'center';
        if (parent === Main.panel._rightBox)
            return 'right';
        return null;
    }

    get index() {
        const parent = this.button.container.get_parent();
        return parent ? parent.get_children().indexOf(this.button.container) : -1;
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

    _scheduleOrder() {
        if (this._orderSource)
            return;
        this._orderSource = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._orderSource = 0;
            this._enforceOrder();
            return GLib.SOURCE_REMOVE;
        });
    }

    _enforceOrder() {
        if (!this._leftBox || !this.button.container)
            return;
        if (this.button.container.get_parent() !== this._leftBox)
            return;

        if (this.index !== LEFT_BOX_INDEX)
            this._leftBox.set_child_at_index(this.button.container, LEFT_BOX_INDEX);

        const media = Main.panel.statusArea[MEDIA_ROLE]?.container;
        if (!media || media.get_parent() !== this._leftBox)
            return;

        const mediaIndex = this._leftBox.get_children().indexOf(media);
        if (mediaIndex !== LEFT_BOX_INDEX + 1)
            this._leftBox.set_child_at_index(media, LEFT_BOX_INDEX + 1);
    }

    destroy() {
        for (const id of this._orderIds)
            this._leftBox?.disconnect(id);
        this._orderIds = [];
        if (this._orderSource) {
            GLib.source_remove(this._orderSource);
            this._orderSource = 0;
        }
        this._leftBox = null;
        this.button.destroy();
    }
}
