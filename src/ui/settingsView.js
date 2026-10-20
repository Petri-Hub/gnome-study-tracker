import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {formatLiters} from '../core/format.js';
import {button, divider, label, layout} from './helpers.js';

const FORMATTERS = {
    waterGoalMl: value => formatLiters(value),
    waterStepMl: value => `${value} ml`,
    focusMinutes: value => `${value} min`,
    breakMinutes: value => `${value} min`,
    soundVolume: value => `${value}%`,
};

/**
 * The in-popup settings page. It replaces the dashboard while open so the
 * extension can stay compact instead of growing a tall preferences window.
 */
export class SettingsView {
    constructor({onAdjust, onToggle, onReset, onDone}) {
        this._onAdjust = onAdjust;
        this._onToggle = onToggle;
        this._steppers = {};
        this._toggles = {};

        this.actor = layout({
            vertical: true,
            spacing: 0,
            x_expand: true,
            style_class: 'study-settings',
        });

        const title = layout({
            spacing: 8,
            x_expand: true,
            style_class: 'study-settings-header',
        });
        title.add_child(label('Settings', 'study-settings-title'));
        title.add_child(layout({x_expand: true}));
        title.add_child(button(
            label('Done', 'study-settings-done-label'),
            'study-settings-done', onDone));
        this.actor.add_child(title);

        const water = layout({
            vertical: true,
            spacing: 6,
            x_expand: true,
            style_class: 'study-settings-column',
        });
        water.add_child(label('WATER', 'study-settings-heading'));
        water.add_child(this._stepper('Goal', 'waterGoalMl'));
        water.add_child(this._stepper('Scroll', 'waterStepMl'));

        const pomodoro = layout({
            vertical: true,
            spacing: 6,
            x_expand: true,
            style_class: 'study-settings-column',
        });
        pomodoro.add_child(label('POMODORO', 'study-settings-heading'));
        pomodoro.add_child(this._stepper('Focus', 'focusMinutes'));
        pomodoro.add_child(this._stepper('Break', 'breakMinutes'));

        const columns = layout({
            spacing: 14,
            x_expand: true,
            style_class: 'study-settings-body',
        });
        columns.add_child(water);
        columns.add_child(divider(true));
        columns.add_child(pomodoro);
        this.actor.add_child(columns);

        this.actor.add_child(divider(false));

        const footer = layout({
            spacing: 12,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'study-settings-footer',
        });
        this._toggles.autoStartNext = this._toggle('Auto-start', 'autoStartNext');
        this._toggles.sound = this._toggle('Sound', 'sound');
        footer.add_child(this._toggles.autoStartNext.actor);
        footer.add_child(this._toggles.sound.actor);
        footer.add_child(this._stepper('Volume', 'soundVolume', false));
        footer.add_child(layout({x_expand: true}));
        footer.add_child(button(
            label('Reset', 'study-settings-reset-label'),
            'study-settings-reset', onReset));
        this.actor.add_child(footer);
    }

    _stepper(text, key, expand = true) {
        const row = layout({spacing: 5, x_expand: expand});
        row.add_child(label(text, 'study-settings-label'));
        if (expand)
            row.add_child(layout({x_expand: true}));

        row.add_child(button(
            label('−', 'study-step-glyph'),
            'study-step', () => this._onAdjust(key, -1)));
        const value = label('', 'study-settings-value', {
            x_align: Clutter.ActorAlign.CENTER,
        });
        row.add_child(value);
        row.add_child(button(
            label('+', 'study-step-glyph'),
            'study-step', () => this._onAdjust(key, 1)));

        this._steppers[key] = {
            value,
            format: FORMATTERS[key] ?? (raw => `${raw}`),
        };
        return row;
    }

    _toggle(text, key) {
        const row = layout({spacing: 5});
        row.add_child(new St.Widget({
            style_class: 'study-option-dot',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        row.add_child(label(text, 'study-option-label'));

        const actor = new St.Button({
            style_class: 'study-option',
            can_focus: true,
            child: row,
        });
        actor.connect('clicked', () => this._onToggle(key));
        return {
            actor,
            setOn: on => actor.set_style_class_name(`study-option${on ? ' on' : ''}`),
        };
    }

    update(settings) {
        for (const [key, stepper] of Object.entries(this._steppers))
            stepper.value.text = stepper.format(settings[key]);

        this._toggles.autoStartNext.setOn(settings.autoStartNext);
        this._toggles.sound.setOn(settings.sound);
    }
}
