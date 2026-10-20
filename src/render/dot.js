import Cairo from 'gi://cairo';

import {roundedRect} from './cairo.js';
import {PALETTE, setSourceHex} from './palette.js';

/**
 * Panel mark: a small tomato for the Pomodoro timer. The body follows the
 * active mode, idle is muted, and paused keeps the pause bars.
 */
export function drawStatus(cr, width, height, {mode = 'focus', status = 'idle'} = {}) {
    const cy = height / 2;
    const color = mode === 'break' ? PALETTE.break : PALETTE.focus;
    const idle = status === 'idle';
    const alpha = idle || status === 'paused' ? 0.6 : 1;

    // Body: a slightly squat circle so it reads as a tomato at 12-14px.
    cr.save();
    cr.translate(7, cy + 0.6);
    cr.scale(5.2, 4.8);
    cr.arc(0, 0, 1, 0, 2 * Math.PI);
    cr.restore();
    setSourceHex(cr, color, alpha);
    cr.fill();

    // Leaf and stem, always green so the silhouette stays recognisable.
    cr.save();
    setSourceHex(cr, '#86d98f', idle ? 0.65 : 0.95);
    cr.moveTo(7, 3.4);
    cr.curveTo(5.6, 1.7, 3.7, 1.8, 2.7, 2.8);
    cr.curveTo(4.1, 3.5, 5.7, 3.8, 7, 3.4);
    cr.curveTo(8.3, 3.8, 9.9, 3.5, 11.3, 2.8);
    cr.curveTo(10.3, 1.8, 8.4, 1.7, 7, 3.4);
    cr.fill();

    setSourceHex(cr, '#5fae69', idle ? 0.55 : 0.95);
    cr.setLineWidth(1);
    cr.setLineCap(Cairo.LineCap.ROUND);
    cr.moveTo(7, 3.5);
    cr.lineTo(7.6, 1.0);
    cr.stroke();
    cr.restore();

    // A small highlight gives the filled body some volume.
    if (!idle) {
        cr.save();
        cr.arc(5.1, cy - 1.0, 1.05, 0, 2 * Math.PI);
        cr.setSourceRGBA(1, 1, 1, 0.28 * alpha);
        cr.fill();
        cr.restore();
    }

    if (status === 'paused') {
        cr.setSourceRGBA(1, 1, 1, 0.8);
        roundedRect(cr, 16, cy - 4, 2, 8, 1);
        cr.fill();
        roundedRect(cr, 20, cy - 4, 2, 8, 1);
        cr.fill();
    }
}
