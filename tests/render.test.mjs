// Renders the hand-drawn widgets to PNGs so they can be inspected without
// restarting the shell. Run with: gjs -m tests/render.test.mjs
import Cairo from 'gi://cairo';
import GLib from 'gi://GLib';

import {drawWater} from '../src/render/water.js';
import {drawHeatmap, heatmapSize} from '../src/render/heatmap.js';
import {drawStatus} from '../src/render/dot.js';
import {drawProgress} from '../src/render/progress.js';

const SCALE = 2;
const OUT = GLib.build_filenamev([GLib.get_current_dir(), 'renders']);
GLib.mkdir_with_parents(OUT, 0o755);

function render(name, width, height, draw, background = '#17171a') {
    const surface = new Cairo.ImageSurface(
        Cairo.Format.ARGB32, width * SCALE, height * SCALE);
    const cr = new Cairo.Context(surface);
    cr.scale(SCALE, SCALE);

    cr.setSourceRGB(0.09, 0.09, 0.10);
    cr.paint();
    if (background) {
        cr.setSourceRGB(
            parseInt(background.slice(1, 3), 16) / 255,
            parseInt(background.slice(3, 5), 16) / 255,
            parseInt(background.slice(5, 7), 16) / 255);
        cr.paint();
    }

    draw(cr, width, height);
    cr.$dispose();
    surface.writeToPNG(`${OUT}/${name}.png`);
    print(`rendered ${name}.png`);
}

const TANK_W = 208;
const TANK_H = 150;

render('water-0', TANK_W, TANK_H, (cr, w, h) => {
    drawWater(cr, w, h, {fill: 0, amount: '0.00 L', goal: 'of 2.00 L'});
});
render('water-40', TANK_W, TANK_H, (cr, w, h) => {
    drawWater(cr, w, h, {fill: 0.4, phase: 1.4, amount: '0.80 L', goal: 'of 2.00 L'});
});
render('water-100', TANK_W, TANK_H, (cr, w, h) => {
    drawWater(cr, w, h, {fill: 1, phase: 2.2, amount: '2.00 L', goal: 'of 2.00 L'});
});
render('water-small', 140, 112, (cr, w, h) => {
    drawWater(cr, w, h, {
        fill: 0.75, phase: 1.8, amount: '1.50 L', goal: 'of 2.00 L', hint: true,
    });
});

const WEEKS = 14;
const size = heatmapSize(WEEKS);
const columns = Array.from({length: WEEKS}, (_, col) =>
    Array.from({length: 7}, (_, row) => ({
        key: `${col}-${row}`,
        ms: 0,
        level: (col * 3 + row * 5) % 6,
        water: 0,
        sun: false,
        walk: false,
        focus: 0,
        score: 0,
    })));
render('heatmap', size.width, size.height, (cr, w, h) => {
    drawHeatmap(cr, {
        columns,
        labels: [{index: 0, label: 'Jul'}, {index: 3, label: 'Aug'},
            {index: 7, label: 'Sep'}, {index: 11, label: 'Oct'}],
        todayKey: '13-6',
    });
});

render('status', 26, 14, (cr, w, h) => {
    drawStatus(cr, w, h, {mode: 'focus', status: 'running'});
});
render('status-paused', 26, 14, (cr, w, h) => {
    drawStatus(cr, w, h, {mode: 'focus', status: 'paused'});
});
render('status-break', 26, 14, (cr, w, h) => {
    drawStatus(cr, w, h, {mode: 'break', status: 'running'});
});

render('progress', 240, 6, (cr, w, h) => {
    drawProgress(cr, w, h, 0.62, '#f2555a');
});
