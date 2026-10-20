import {roundedRect} from './cairo.js';
import {setSourceHex} from './palette.js';

export function drawProgress(cr, width, height, fraction, color) {
    const radius = height / 2;
    roundedRect(cr, 0, 0, width, height, radius);
    cr.setSourceRGBA(1, 1, 1, 0.08);
    cr.fill();

    const filled = Math.min(1, Math.max(0, fraction)) * width;
    if (filled <= 0)
        return;
    cr.save();
    roundedRect(cr, 0, 0, width, height, radius);
    cr.clip();
    roundedRect(cr, 0, 0, Math.max(height, filled), height, radius);
    setSourceHex(cr, color, 1);
    cr.fill();
    cr.restore();
}
