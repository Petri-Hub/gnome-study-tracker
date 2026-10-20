import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {formatClock, formatMinutes} from './core/format.js';
import {remainingMs} from './core/timer.js';
import {drawStatus} from './render/dot.js';
import {layout, paintArea} from './ui/helpers.js';

export class PanelIndicator {
    constructor() {
        this.button = new PanelMenu.Button(0.0, 'Study Tracker', false);
        this.button.add_style_class_name('study-panel');
        this.button.accessible_name = 'Study Tracker';

        this._status = {mode: 'focus', status: 'idle'};
        this._dot = new St.DrawingArea({
            style_class: 'study-panel-dot',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._dot.connect('repaint', () => {
            paintArea(this._dot, (cr, width, height) => {
                drawStatus(cr, width, height, this._status);
            });
        });

        this._label = new St.Label({
            text: '90m',
            style_class: 'study-panel-label',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const box = layout({
            spacing: 6,
            y_align: Clutter.ActorAlign.CENTER,
        });
        box.add_child(this._dot);
        box.add_child(this._label);
        this.button.add_child(box);

        this.button.menu.setSourceAlignment(0.0);
        Main.panel.addToStatusArea('study-tracker', this.button, 1, 'left');
    }

    get text() {
        return this._label.get_text();
    }

    update(timer, now) {
        const remaining = remainingMs(timer, now);
        this._label.set_text(timer.status === 'idle'
            ? formatMinutes(remaining)
            : formatClock(remaining));
        this._label.set_style_class_name(
            `study-panel-label${timer.status === 'paused' ? ' paused' : ''}`);

        this._status = {mode: timer.mode, status: timer.status};
        this._dot.queue_repaint();
    }

    destroy() {
        this.button.destroy();
    }
}
