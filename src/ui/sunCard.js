import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {label, layout} from './helpers.js';

export class SunCard {
    constructor(onToggle) {
        this._check = new St.Icon({
            icon_name: 'object-select-symbolic',
            icon_size: 11,
            style_class: 'study-sun-check',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });

        const row = layout({spacing: 7, x_expand: true});
        row.add_child(new St.Icon({
            icon_name: 'weather-clear-symbolic',
            icon_size: 14,
            style_class: 'study-sun-icon',
            y_align: Clutter.ActorAlign.CENTER,
        }));
        row.add_child(label('Sun', 'study-sun-label', {
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        row.add_child(this._check);

        this.actor = new St.Button({
            style_class: 'study-sun',
            can_focus: true,
            x_expand: true,
            child: row,
        });
        this.actor.connect('clicked', () => onToggle());
    }

    update(day) {
        const done = Boolean(day?.sun);
        this.actor.set_style_class_name(`study-sun${done ? ' on' : ''}`);
        this._check.visible = done;
    }
}
