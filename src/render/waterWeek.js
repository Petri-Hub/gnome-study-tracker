import {drawText, roundedRect} from './cairo.js';
import {setSourceHex} from './palette.js';

/**
 * Seven water bars for the details tab. The goal is a dashed line behind the
 * bars so the chart still reads when everyone hits the target every day.
 */
export function drawWaterWeek(cr, width, height, series, {
    goal = 2000,
    accent = '#38bdf8',
    todayKey = null,
    labelHeight = 12,
} = {}) {
    if (!series.length)
        return;

    const gap = 6;
    const barWidth = (width - gap * (series.length - 1)) / series.length;
    const chartHeight = height - labelHeight;
    const peak = Math.max(goal, ...series.map(day => day.water), 1);

    series.forEach((day, index) => {
        const x = index * (barWidth + gap);
        roundedRect(cr, x, 0, barWidth, chartHeight, 4);
        cr.setSourceRGBA(1, 1, 1, 0.025);
        cr.fill();

        const barHeight = Math.max(2, (day.water / peak) * chartHeight);
        roundedRect(cr, x, chartHeight - barHeight, barWidth, barHeight, 4);
        const alpha = day.key === todayKey ? 0.95 : day.water >= goal ? 0.68 : 0.34;
        setSourceHex(cr, accent, alpha);
        cr.fill();

        drawText(cr, day.initial ?? day.label.slice(0, 1), {
            x: x + barWidth / 2,
            y: chartHeight + 2,
            font: 'Cantarell 8',
            color: '#ffffff',
            alpha: day.key === todayKey ? 0.8 : 0.4,
            align: 'center',
        });
    });

    if (goal > 0) {
        const y = chartHeight - (goal / peak) * chartHeight;
        cr.save();
        cr.setDash([2, 3], 0);
        cr.setSourceRGBA(1, 1, 1, 0.2);
        cr.setLineWidth(1);
        cr.moveTo(0, y);
        cr.lineTo(width, y);
        cr.stroke();
        cr.restore();
    }
}
