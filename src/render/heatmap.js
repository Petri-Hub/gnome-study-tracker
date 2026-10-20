import {drawText, roundedRect} from './cairo.js';

export const HEATMAP_METRICS = Object.freeze({
    cell: 12,
    gap: 3,
    top: 26,
});

const LEVEL_COLORS = [
    ['#ffffff', 0.06],
    ['#0e4429', 1],
    ['#006d32', 1],
    ['#26a641', 1],
    ['#39d353', 1],
    ['#7ee787', 1],
];

const STEP = HEATMAP_METRICS.cell + HEATMAP_METRICS.gap;

export function heatmapSize(weeks, metrics = HEATMAP_METRICS) {
    return {
        width: weeks * (metrics.cell + metrics.gap) - metrics.gap,
        height: metrics.top + 7 * (metrics.cell + metrics.gap) - metrics.gap,
    };
}

export function cellAt(x, y, columns, metrics = HEATMAP_METRICS) {
    const step = metrics.cell + metrics.gap;
    const col = Math.floor(x / step);
    const row = Math.floor((y - metrics.top) / step);
    if (col < 0 || col >= columns.length || row < 0 || row > 6)
        return null;
    if (x - col * step > metrics.cell || y - metrics.top - row * step > metrics.cell)
        return null;
    return columns[col]?.[row] ?? null;
}

export function drawHeatmap(cr, {
    columns,
    labels = [],
    todayKey = null,
    metrics = HEATMAP_METRICS,
    showMonths = true,
} = {}) {
    const step = metrics.cell + metrics.gap;
    const top = metrics.top;

    if (showMonths) {
        let lastLabelX = -Infinity;
        for (const {index, label} of labels) {
            const x = index * step;
            if (x - lastLabelX < 36)
                continue;
            lastLabelX = x;
            drawText(cr, label, {
                x,
                y: Math.max(0, top - 24),
                font: 'Cantarell 9',
                color: '#ffffff',
                alpha: 0.5,
            });
        }
    }

    columns.forEach((column, col) => {
        column.forEach((cell, row) => {
            if (!cell)
                return;
            const x = col * step;
            const y = top + row * step;
            const [color, alpha] = LEVEL_COLORS[cell.level] ?? LEVEL_COLORS[0];
            roundedRect(cr, x, y, metrics.cell, metrics.cell, 3);
            cr.setSourceRGBA(
                parseInt(color.slice(1, 3), 16) / 255,
                parseInt(color.slice(3, 5), 16) / 255,
                parseInt(color.slice(5, 7), 16) / 255,
                alpha);
            cr.fill();

            if (todayKey && cell.key === todayKey) {
                roundedRect(cr, x + 0.5, y + 0.5, metrics.cell - 1, metrics.cell - 1, 3);
                cr.setSourceRGBA(1, 1, 1, 0.75);
                cr.setLineWidth(1);
                cr.stroke();
            }
        });
    });
}
