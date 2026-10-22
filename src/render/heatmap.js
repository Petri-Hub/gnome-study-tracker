import {drawText, roundedRect} from './cairo.js';

export const HEATMAP_METRICS = Object.freeze({
    cell: 12,
    gap: 3,
    top: 26,
});

const LEVEL_COLORS = [
    ['#ffffff', 0.06],
    ['#123f25', 1],
    ['#166534', 1],
    ['#22c55e', 1],
    ['#4ade80', 1],
    ['#86efac', 1],
];

const INTENSITY_STOPS = [
    {at: 0, rgb: [18, 63, 37]},
    {at: 0.35, rgb: [22, 101, 52]},
    {at: 0.7, rgb: [34, 197, 94]},
    {at: 1, rgb: [134, 239, 172]},
];

const STEP = HEATMAP_METRICS.cell + HEATMAP_METRICS.gap;

function mix(start, end, amount) {
    return start + (end - start) * amount;
}

function intensityColor(value) {
    const target = Math.min(1, Math.max(0.12, value));
    let left = INTENSITY_STOPS[0];
    let right = INTENSITY_STOPS[INTENSITY_STOPS.length - 1];
    for (let i = 0; i < INTENSITY_STOPS.length - 1; i++) {
        if (target <= INTENSITY_STOPS[i + 1].at) {
            left = INTENSITY_STOPS[i];
            right = INTENSITY_STOPS[i + 1];
            break;
        }
    }
    const span = right.at - left.at || 1;
    const local = (target - left.at) / span;
    return [
        mix(left.rgb[0], right.rgb[0], local) / 255,
        mix(left.rgb[1], right.rgb[1], local) / 255,
        mix(left.rgb[2], right.rgb[2], local) / 255,
    ];
}

function cellColor(cell) {
    if (Number.isFinite(cell.intensity)) {
        if (cell.intensity <= 0)
            return [1, 1, 1, 0.06];
        return [...intensityColor(cell.intensity), 1];
    }
    const [color, alpha] = LEVEL_COLORS[cell.level] ?? LEVEL_COLORS[0];
    return [
        parseInt(color.slice(1, 3), 16) / 255,
        parseInt(color.slice(3, 5), 16) / 255,
        parseInt(color.slice(5, 7), 16) / 255,
        alpha,
    ];
}

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
            roundedRect(cr, x, y, metrics.cell, metrics.cell, 3);
            const [red, green, blue, alpha] = cellColor(cell);
            cr.setSourceRGBA(red, green, blue, alpha);
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
