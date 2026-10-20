import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {formatLiters} from '../core/format.js';
import {dayKey, heatmapData, streak} from '../core/state.js';
import {cellAt, drawHeatmap} from '../render/heatmap.js';
import {sound} from '../sound.js';
import {label, layout, paintArea} from './helpers.js';

const WEEKS = 14;
const MAX_OFFSET_WEEKS = 26;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(ms) {
    const date = new Date(ms);
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export class HeatmapCard {
    constructor() {
        this._state = null;
        this._now = 0;
        this._offsetWeeks = 0;
        this._data = {columns: [], labels: []};
        this._todayKey = null;
        this._streak = 0;
        this._hovering = false;
        this._scrollDelta = 0;
        this._dragStartX = null;

        this._area = new St.DrawingArea({
            style_class: 'study-heatmap',
            reactive: true,
        });
        this._area.connect('repaint', () => this._paint());
        this._area.connect('motion-event', (actor, event) => this._onMotion(actor, event));
        this._area.connect('leave-event', () => this._onLeave());
        this._area.connect('scroll-event', (actor, event) => this._onScroll(event));
        this._area.connect('button-press-event', (actor, event) => this._onPress(event));
        this._area.connect('button-release-event', () => {
            this._dragStartX = null;
            return Clutter.EVENT_PROPAGATE;
        });

        this._caption = label('', 'study-caption', {
            x_align: Clutter.ActorAlign.START,
        });

        this.actor = layout({vertical: true, spacing: 6, x_expand: true});
        this.actor.add_child(this._area);
        this.actor.add_child(this._caption);
    }

    _paint() {
        paintArea(this._area, (cr, width, height) => {
            drawHeatmap(cr, {
                columns: this._data.columns,
                labels: this._data.labels,
                todayKey: this._todayKey,
            });
        });
    }

    _onMotion(actor, event) {
        const [stageX, stageY] = event.get_coords();
        const [actorX, actorY] = actor.get_transformed_position();

        if (this._dragStartX !== null &&
            (event.get_state() & Clutter.ModifierType.BUTTON1_MASK)) {
            const delta = stageX - this._dragStartX;
            if (Math.abs(delta) >= 24) {
                this._shift(-Math.trunc(delta / 24));
                this._dragStartX = stageX;
            }
            return Clutter.EVENT_STOP;
        }

        const cell = cellAt(stageX - actorX, stageY - actorY, this._data.columns);
        if (!cell)
            return Clutter.EVENT_PROPAGATE;

        this._hovering = true;
        const parts = [
            shortDate(cell.ms),
            cell.water > 0 ? formatLiters(cell.water) : null,
            cell.sun ? 'sun' : null,
            cell.walk ? 'walk' : null,
            cell.focus > 0 ? `${cell.focus}×` : null,
        ].filter(Boolean);
        this._caption.set_text(parts.join(' · '));
        return Clutter.EVENT_PROPAGATE;
    }

    _onLeave() {
        this._hovering = false;
        this._dragStartX = null;
        this._resetCaption();
        return Clutter.EVENT_PROPAGATE;
    }

    /** Scroll or drag sideways to walk through the weeks; double-click resets. */
    _onScroll(event) {
        const direction = event.get_scroll_direction();
        let step = 0;

        if (direction === Clutter.ScrollDirection.UP)
            step = 1;
        else if (direction === Clutter.ScrollDirection.DOWN)
            step = -1;
        else if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [, dy] = event.get_scroll_delta();
            this._scrollDelta += dy;
            if (Math.abs(this._scrollDelta) >= 1) {
                step = this._scrollDelta > 0 ? -1 : 1;
                this._scrollDelta = 0;
            }
        }

        if (step !== 0)
            this._shift(step);
        return Clutter.EVENT_STOP;
    }

    _onPress(event) {
        if (event.get_click_count() === 2 && this._offsetWeeks !== 0) {
            this._dragStartX = null;
            this._shift(-this._offsetWeeks);
            return Clutter.EVENT_STOP;
        }
        this._dragStartX = event.get_coords()[0];
        return Clutter.EVENT_PROPAGATE;
    }

    _shift(weeks) {
        const next = Math.min(MAX_OFFSET_WEEKS,
            Math.max(0, this._offsetWeeks + weeks));
        if (next === this._offsetWeeks)
            return false;
        this._offsetWeeks = next;
        this._hovering = false;
        this._refresh();
        sound.play('click');
        return true;
    }

    _resetCaption() {
        if (this._hovering)
            return;
        if (this._offsetWeeks > 0)
            this._caption.set_text(`${this._offsetWeeks}w back`);
        else if (this._streak > 1)
            this._caption.set_text(`${this._streak}d streak`);
        else
            this._caption.set_text('');
    }

    _refresh() {
        if (!this._state)
            return;
        const viewNow = this._now - this._offsetWeeks * 7 * DAY_MS;
        this._data = heatmapData(this._state, viewNow, WEEKS);
        this._todayKey = dayKey(this._now);
        this._streak = streak(this._state, this._now);
        this._resetCaption();
        this._area.queue_repaint();
    }

    update(state, now) {
        this._state = state;
        this._now = now;
        this._refresh();
    }
}
