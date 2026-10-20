import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {formatDurationWords} from '../core/format.js';
import {divider, layout} from './helpers.js';

function createStat(caption) {
    const value = new St.Label({
        text: '—',
        style_class: 'study-stat-value',
        x_align: Clutter.ActorAlign.START,
    });
    const captionLabel = new St.Label({
        text: caption,
        style_class: 'study-stat-label',
        x_align: Clutter.ActorAlign.START,
    });
    const actor = layout({
        vertical: true,
        spacing: 1,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'study-stat',
    });
    actor.add_child(value);
    actor.add_child(captionLabel);
    return {actor, setValue: text => value.set_text(text)};
}

export class TodayCard {
    constructor() {
        this._focus = createStat('focus today');
        this._minutes = createStat('minutes today');
        const row = layout({x_expand: true, y_expand: true});
        row.add_child(this._focus.actor);
        row.add_child(divider(true));
        row.add_child(this._minutes.actor);
        this.actor = layout({vertical: true, x_expand: true, y_expand: true});
        this.actor.add_child(row);
    }

    update(day) {
        this._focus.setValue(String(day?.focus ?? 0));
        this._minutes.setValue(formatDurationWords(day?.focusMinutes ?? 0));
    }
}
