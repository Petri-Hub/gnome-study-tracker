import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {formatClock} from '../core/format.js';
import {progress, remainingMs} from '../core/timer.js';
import {drawProgress} from '../render/progress.js';
import {button, label, layout, paintArea} from './helpers.js';

const CYCLE_LENGTH = 4;

export class PomodoroCard {
    constructor({onToggle, onReset, onMode}) {
        this._fraction = 0;
        this._color = '#f2555a';

        this._focusTab = this._buildTab('Focus', 'focus', () => onMode('focus'));
        this._breakTab = this._buildTab('Break', 'break', () => onMode('break'));

        this._cycleDots = [];
        const cycle = layout({spacing: 4, x_expand: true});
        cycle.add_child(layout({x_expand: true}));
        for (let i = 0; i < CYCLE_LENGTH; i++) {
            const dot = new St.Widget({
                style_class: 'study-cycle-dot',
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._cycleDots.push(dot);
            cycle.add_child(dot);
        }
        cycle.add_child(layout({x_expand: true}));

        const tabs = layout({spacing: 8, x_expand: true});
        tabs.add_child(layout({x_expand: true}));
        tabs.add_child(this._focusTab);
        tabs.add_child(this._breakTab);
        tabs.add_child(layout({x_expand: true}));

        const head = layout({vertical: true, spacing: 3, x_expand: true});
        head.add_child(cycle);
        head.add_child(tabs);

        this._clock = label('1:30:00', 'study-clock', {
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._progressArea = new St.DrawingArea({
            style_class: 'study-progress',
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._progressArea.connect('repaint', () => {
            paintArea(this._progressArea, (cr, width, height) => {
                drawProgress(cr, width, height, this._fraction, this._color);
            });
        });

        this._primaryLabel = label('Start', 'study-primary-label');
        this._primary = button(this._primaryLabel, 'study-btn study-primary',
            () => onToggle(), {x_expand: false});
        const reset = button(
            new St.Icon({icon_name: 'view-refresh-symbolic', icon_size: 14}),
            'study-icon-button', () => onReset());

        const controls = layout({spacing: 6, x_expand: true});
        controls.add_child(layout({x_expand: true}));
        controls.add_child(this._primary);
        controls.add_child(reset);
        controls.add_child(layout({x_expand: true}));

        this.actor = layout({
            vertical: true,
            spacing: 7,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'study-pomodoro',
        });
        this.actor.add_child(head);
        this.actor.add_child(this._clock);
        this.actor.add_child(this._progressArea);
        this.actor.add_child(controls);
    }

    _buildTab(text, mode, onClick) {
        const actor = new St.Button({
            style_class: `study-tab ${mode}`,
            can_focus: true,
            child: label(text, 'study-tab-label'),
        });
        actor.connect('clicked', onClick);
        return actor;
    }

    update(timer, now, day) {
        const isFocus = timer.mode === 'focus';

        this._clock.set_text(formatClock(remainingMs(timer, now)));
        this._fraction = progress(timer, now);
        this._color = isFocus ? '#f2555a' : '#46a758';
        this._progressArea.queue_repaint();

        this._focusTab.set_style_class_name(
            `study-tab focus${isFocus ? ' active' : ''}`);
        this._breakTab.set_style_class_name(
            `study-tab break${isFocus ? '' : ' active'}`);

        this._primaryLabel.set_text(timer.status === 'running' ? 'Pause'
            : timer.status === 'paused' ? 'Resume' : 'Start');
        this._primary.set_style_class_name(
            `study-btn study-primary ${isFocus ? 'focus' : 'break'}`);

        const filled = (day?.focus ?? 0) % CYCLE_LENGTH;
        this._cycleDots.forEach((dot, index) => {
            dot.set_style_class_name(
                `study-cycle-dot${index < filled ? ' filled' : ''}`);
        });
    }
}
