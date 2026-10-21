import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {drawTomato} from '../render/tomato.js';
import {paintArea} from './helpers.js';

/** The tomato mark used in the panel and on the Today tab. */
export function createTomatoIcon({size = 14, styleClass = 'study-tomato'} = {}) {
    const area = new St.DrawingArea({
        style_class: styleClass,
        style: `min-width: ${size}px; min-height: ${size}px;`,
        y_align: Clutter.ActorAlign.CENTER,
    });
    area.connect('repaint', () => {
        paintArea(area, (cr, width, height) => drawTomato(cr, width, height));
    });
    return area;
}
