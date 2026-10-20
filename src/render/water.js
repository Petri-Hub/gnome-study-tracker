import Cairo from 'gi://cairo';

import {drawText, roundedRect} from './cairo.js';
import {PALETTE, setSourceHex} from './palette.js';

function wavePath(cr, width, height, baseY, amplitude, phase) {
    cr.moveTo(0, baseY);
    for (let x = 0; x <= width; x += 2) {
        const y = baseY
            + Math.sin((x / width) * Math.PI * 3 + phase) * amplitude
            + Math.sin((x / width) * Math.PI * 5.3 - phase * 1.7) * amplitude * 0.35;
        cr.lineTo(x, y);
    }
    cr.lineTo(width, height);
    cr.lineTo(0, height);
    cr.closePath();
}

function crestPath(cr, width, baseY, amplitude, phase) {
    cr.moveTo(0, baseY);
    for (let x = 0; x <= width; x += 2) {
        const y = baseY
            + Math.sin((x / width) * Math.PI * 3 + phase) * amplitude
            + Math.sin((x / width) * Math.PI * 5.3 - phase * 1.7) * amplitude * 0.35;
        cr.lineTo(x, y);
    }
}

/**
 * A glass of water: rounded tank, two animated waves, amount text.
 * `fill` is 0..1, `phase` is a free-running animation phase.
 */
export function drawWater(cr, width, height, {
    fill = 0,
    phase = 0,
    amount = '0.00 L',
    goal = 'of 2.00 L',
    showText = true,
    hint = false,
} = {}) {
    cr.save();
    roundedRect(cr, 0, 0, width, height, 14);
    cr.clip();

    const bg = new Cairo.LinearGradient(0, 0, 0, height);
    bg.addColorStopRGBA(0, 0.05, 0.11, 0.17, 1);
    bg.addColorStopRGBA(1, 0.03, 0.07, 0.11, 1);
    cr.setSource(bg);
    cr.paint();

    const level = Math.min(1, Math.max(0, fill));
    const baseY = height - level * height;
    const amplitude = 3.2;

    // Back wave, softer and slower.
    cr.save();
    wavePath(cr, width, height, baseY + 2, amplitude * 1.2, phase * 0.7 + 1.2);
    cr.setSourceRGBA(0.12, 0.55, 0.78, 0.55);
    cr.fill();
    cr.restore();

    // Front wave with a vertical gradient.
    const wave = new Cairo.LinearGradient(0, baseY, 0, height);
    wave.addColorStopRGBA(0, 0.22, 0.74, 0.97, 0.92);
    wave.addColorStopRGBA(1, 0.04, 0.40, 0.60, 0.98);
    wavePath(cr, width, height, baseY, amplitude, phase);
    cr.setSource(wave);
    cr.fill();

    // Crest highlight.
    cr.save();
    crestPath(cr, width, baseY, amplitude, phase);
    cr.setLineWidth(1.6);
    cr.setLineCap(Cairo.LineCap.ROUND);
    cr.setSourceRGBA(0.65, 0.92, 1.0, 0.75);
    cr.stroke();
    cr.restore();

    // Inner vignette so the tank reads as glass.
    const shade = new Cairo.LinearGradient(0, 0, 0, height);
    shade.addColorStopRGBA(0, 1, 1, 1, 0.06);
    shade.addColorStopRGBA(0.4, 1, 1, 1, 0.0);
    shade.addColorStopRGBA(1, 0, 0, 0, 0.18);
    cr.setSource(shade);
    cr.paint();
    cr.restore();

    if (showText) {
        cr.save();
        roundedRect(cr, 0, 0, width, height, 14);
        cr.clip();
        const compact = width < 180;
        const amountSize = compact ? 18 : 22;
        const textY = height * 0.26;
        drawText(cr, amount, {
            x: width / 2,
            y: textY + 1,
            font: `JetBrains Mono SemiBold ${amountSize}`,
            color: '#000000',
            alpha: 0.35,
            align: 'center',
        });
        drawText(cr, amount, {
            x: width / 2,
            y: textY,
            font: `JetBrains Mono SemiBold ${amountSize}`,
            color: '#ffffff',
            align: 'center',
        });
        drawText(cr, goal, {
            x: width / 2,
            y: textY + (compact ? 27 : 31),
            font: `Cantarell ${compact ? 9 : 10}`,
            color: '#d7f1ff',
            alpha: 0.8,
            align: 'center',
        });
        cr.restore();
    }

    if (hint && height >= 60) {
        cr.save();
        roundedRect(cr, 0, 0, width, height, 14);
        cr.clip();
        const hintText = typeof hint === 'string' ? hint : 'scroll ±250 ml';
        const hintY = height - 16;
        roundedRect(cr, width / 2 - 44, hintY - 3, 88, 14, 7);
        cr.setSourceRGBA(0, 0, 0, 0.24);
        cr.fill();
        drawText(cr, hintText, {
            x: width / 2,
            y: hintY,
            font: 'Cantarell 8',
            color: '#ffffff',
            alpha: 0.82,
            align: 'center',
        });
        cr.restore();
    }

    // Border.
    roundedRect(cr, 0.5, 0.5, width - 1, height - 1, 14);
    setSourceHex(cr, '#ffffff', 0.10);
    cr.setLineWidth(1);
    cr.stroke();

    // Highlight on the top edge.
    cr.save();
    cr.moveTo(16, 1.5);
    cr.lineTo(width - 16, 1.5);
    cr.setLineWidth(1);
    cr.setSourceRGBA(1, 1, 1, 0.10);
    cr.stroke();
    cr.restore();
}
