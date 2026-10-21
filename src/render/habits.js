import {drawText, roundedRect} from './cairo.js';
import {PALETTE, setSourceHex} from './palette.js';

/**
 * Two rows of seven squares: sunlight on top, walks below. Filled means the
 * habit was checked that day; the outline marks today.
 */
export function drawHabits(cr, width, height, series, {
    todayKey = null,
    sunColor = PALETTE.sun,
    walkColor = PALETTE.walk,
} = {}) {
    if (!series.length)
        return;

    const labelWidth = 26;
    const gap = 4;
    const available = width - labelWidth;
    const cell = Math.max(6, Math.min(12,
        (available - gap * (series.length - 1)) / series.length));
    const rowHeight = cell + gap;
    const totalHeight = rowHeight * 2 - gap;
    const top = Math.max(0, (height - totalHeight) / 2);

    const rows = [
        {key: 'sun', text: 'Sun', color: sunColor},
        {key: 'walk', text: 'Walk', color: walkColor},
    ];

    rows.forEach((row, rowIndex) => {
        const y = top + rowIndex * rowHeight;
        drawText(cr, row.text, {
            x: 0,
            y: y + cell / 2,
            font: 'Cantarell 8',
            color: '#ffffff',
            alpha: 0.42,
            valign: 'middle',
        });

        series.forEach((day, index) => {
            const x = labelWidth + index * (cell + gap);
            const done = Boolean(day[row.key]);

            roundedRect(cr, x, y, cell, cell, 3);
            if (done)
                setSourceHex(cr, row.color, 0.86);
            else
                cr.setSourceRGBA(1, 1, 1, 0.06);
            cr.fill();

            if (day.key === todayKey) {
                roundedRect(cr, x + 0.5, y + 0.5, cell - 1, cell - 1, 3);
                cr.setSourceRGBA(1, 1, 1, 0.62);
                cr.setLineWidth(1);
                cr.stroke();
            }
        });
    });
}
