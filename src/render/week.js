import {drawText, roundedRect} from './cairo.js';
import {setSourceHex} from './palette.js';

/**
 * Seven vertical bars, one per day, scaled to the busiest day (minimum 60
 * minutes so a quiet week does not fill the whole card).
 */
export function drawWeek(cr, width, height, series, {
    accent = '#f2555a',
    todayKey = null,
    labelHeight = 14,
} = {}) {
    const gap = 8;
    const barWidth = (width - gap * (series.length - 1)) / series.length;
    const chartHeight = height - labelHeight;
    const peak = Math.max(60, ...series.map(day => day.minutes));

    series.forEach((day, index) => {
        const x = index * (barWidth + gap);

        roundedRect(cr, x, 0, barWidth, chartHeight, 4);
        cr.setSourceRGBA(1, 1, 1, 0.025);
        cr.fill();

        const barHeight = Math.max(3, (day.minutes / peak) * (chartHeight - 4));
        roundedRect(cr, x, chartHeight - barHeight, barWidth, barHeight, 4);
        setSourceHex(cr, accent, day.key === todayKey ? 0.95 : 0.5);
        cr.fill();

        drawText(cr, day.label, {
            x: x + barWidth / 2,
            y: chartHeight + 2,
            font: 'Cantarell 8',
            color: '#ffffff',
            alpha: day.key === todayKey ? 0.8 : 0.4,
            align: 'center',
        });
    });
}
