export const PALETTE = {
    card: '#17171a',
    border: 'rgba(255,255,255,0.09)',
    text: '#f4f4f5',
    muted: 'rgba(255,255,255,0.55)',
    focus: '#f2555a',
    break: '#46a758',
    water: '#38bdf8',
    waterDeep: '#0b6b9e',
    sun: '#f5b544',
    grid: 'rgba(255,255,255,0.06)',
};

export function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return {
        r: parseInt(clean.slice(0, 2), 16) / 255,
        g: parseInt(clean.slice(2, 4), 16) / 255,
        b: parseInt(clean.slice(4, 6), 16) / 255,
    };
}

export function setSourceHex(cr, hex, alpha = 1) {
    const {r, g, b} = hexToRgb(hex);
    cr.setSourceRGBA(r, g, b, alpha);
}
