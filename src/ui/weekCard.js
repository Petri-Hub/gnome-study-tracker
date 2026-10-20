import St from 'gi://St';

import {weekSeries} from '../core/state.js';
import {drawWeek} from '../render/week.js';
import {layout, paintArea} from './helpers.js';

export class WeekCard {
    constructor() {
        this._series = [];
        this._todayKey = null;

        this._area = new St.DrawingArea({
            style_class: 'study-week',
            x_expand: true,
        });
        this._area.connect('repaint', () => {
            paintArea(this._area, (cr, width, height) => {
                drawWeek(cr, width, height, this._series, {
                    accent: '#f2555a',
                    todayKey: this._todayKey,
                });
            });
        });

        this.actor = layout({vertical: true, x_expand: true});
        this.actor.add_child(this._area);
    }

    update(state, now) {
        this._series = weekSeries(state, now);
        this._todayKey = this._series.at(-1)?.key ?? null;
        this._area.queue_repaint();
    }
}
