import Cairo from 'gi://cairo';

import {PALETTE, setSourceHex} from './palette.js';

/**
 * The extension mark: a small tomato. It fits any square area so the panel and
 * the Today tab can share the same drawing at different sizes.
 */
export function drawTomato(cr, width, height, {alpha = 1} = {}) {
    const size = Math.min(width, height);
    if (!size)
        return;

    const scale = size / 14;
    cr.save();
    cr.translate((width - 14 * scale) / 2, (height - 14 * scale) / 2);
    cr.scale(scale, scale);

    // Body: a slightly squat circle so it reads as a tomato at 12-14px.
    cr.save();
    cr.translate(7, 7.6);
    cr.scale(5.2, 4.8);
    cr.arc(0, 0, 1, 0, 2 * Math.PI);
    cr.restore();
    setSourceHex(cr, PALETTE.focus, alpha);
    cr.fill();

    // Leaf and stem, always green so the silhouette stays recognisable.
    setSourceHex(cr, '#86d98f', alpha * 0.95);
    cr.moveTo(7, 3.4);
    cr.curveTo(5.6, 1.7, 3.7, 1.8, 2.7, 2.8);
    cr.curveTo(4.1, 3.5, 5.7, 3.8, 7, 3.4);
    cr.curveTo(8.3, 3.8, 9.9, 3.5, 11.3, 2.8);
    cr.curveTo(10.3, 1.8, 8.4, 1.7, 7, 3.4);
    cr.fill();

    setSourceHex(cr, '#5fae69', alpha * 0.95);
    cr.setLineWidth(1);
    cr.setLineCap(Cairo.LineCap.ROUND);
    cr.moveTo(7, 3.5);
    cr.lineTo(7.6, 1.0);
    cr.stroke();

    // A small highlight gives the body some volume.
    cr.arc(5.1, 6.0, 1.05, 0, 2 * Math.PI);
    cr.setSourceRGBA(1, 1, 1, 0.28 * alpha);
    cr.fill();

    cr.restore();
}
