import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {formatLiters} from '../core/format.js';
import {drawWater} from '../render/water.js';
import {layout, paintArea} from './helpers.js';

const DEFAULT_STEP_ML = 250;
const SCROLL_COOLDOWN_MS = 40;
const FRAME_MS = 16;
const FILL_TAU_MS = 90;

export class WaterCard {
    constructor({onAdd}) {
        this._onAdd = onAdd;
        this._milliliters = 0;
        this._goal = 2000;
        this._step = DEFAULT_STEP_ML;
        this._fill = 0;
        this._targetFill = 0;
        this._initialized = false;
        this._hovering = false;
        this._phase = 0;
        this._animation = 0;
        this._lastFrame = 0;
        this._scrollDelta = 0;
        this._lastScrollAt = -SCROLL_COOLDOWN_MS;

        this._tank = new St.DrawingArea({
            style_class: 'study-water-tank',
            x_expand: true,
            reactive: true,
        });
        this._tank.connect('repaint', () => this._paint());
        this._tank.connect('scroll-event', (actor, event) => this._onScroll(event));
        this._tank.connect('enter-event', () => {
            this._hovering = true;
            this._tank.queue_repaint();
            return Clutter.EVENT_PROPAGATE;
        });
        this._tank.connect('leave-event', () => {
            this._hovering = false;
            this._tank.queue_repaint();
            return Clutter.EVENT_PROPAGATE;
        });

        this.actor = layout({vertical: true, x_expand: true});
        this.actor.add_child(this._tank);
    }

    _paint() {
        paintArea(this._tank, (cr, width, height) => {
            drawWater(cr, width, height, {
                fill: this._fill,
                phase: this._phase,
                amount: formatLiters(this._milliliters),
                goal: `of ${formatLiters(this._goal)}`,
                hint: this._hovering ? `scroll ±${this._step} ml` : false,
            });
        });
    }

    /** Scroll wheel and two-finger scroll over the tank move it by one step. */
    _onScroll(event) {
        const direction = event.get_scroll_direction();
        let notches = 0;

        if (direction === Clutter.ScrollDirection.UP)
            notches = 1;
        else if (direction === Clutter.ScrollDirection.DOWN)
            notches = -1;
        else if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [, dy] = event.get_scroll_delta();
            this._scrollDelta += dy;
            if (Math.abs(this._scrollDelta) >= 1) {
                notches = this._scrollDelta > 0 ? -1 : 1;
                this._scrollDelta = 0;
            }
        }

        if (notches !== 0) {
            // Some wheels emit two events for one detent. Collapse those into
            // a single step without making normal fast scrolling feel dead.
            const now = GLib.get_monotonic_time() / 1000;
            if (now - this._lastScrollAt >= SCROLL_COOLDOWN_MS) {
                this._lastScrollAt = now;
                this._onAdd(notches * this._step);
            }
            this._scrollDelta = 0;
        }
        return Clutter.EVENT_STOP;
    }

    update(day, settings) {
        const goal = settings.waterGoalMl;
        this._milliliters = day?.water ?? 0;
        this._goal = goal;
        this._step = settings.waterStepMl ?? DEFAULT_STEP_ML;
        this._targetFill = goal > 0 ? Math.min(1, this._milliliters / goal) : 0;
        if (!this._initialized) {
            this._fill = this._targetFill;
            this._initialized = true;
        }
        this._tank.queue_repaint();
    }

    startAnimation() {
        if (this._animation)
            return;
        this._lastFrame = GLib.get_monotonic_time() / 1000;
        this._animation = GLib.timeout_add(GLib.PRIORITY_DEFAULT, FRAME_MS, () => {
            const now = GLib.get_monotonic_time() / 1000;
            const dt = Math.min(50, Math.max(1, now - this._lastFrame));
            this._lastFrame = now;

            const diff = this._targetFill - this._fill;
            if (Math.abs(diff) < 0.0005)
                this._fill = this._targetFill;
            else
                this._fill += diff * (1 - Math.exp(-dt / FILL_TAU_MS));

            this._phase += dt * 0.00233;
            this._tank.queue_repaint();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopAnimation() {
        if (!this._animation)
            return;
        GLib.source_remove(this._animation);
        this._animation = 0;
    }
}
