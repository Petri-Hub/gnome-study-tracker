import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

import {setSourceHex} from './palette.js';

export function roundedRect(cr, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    cr.newSubPath();
    cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    cr.arc(x + width - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI);
    cr.arc(x + width - r, y + height - r, r, 0, 0.5 * Math.PI);
    cr.arc(x + r, y + height - r, r, 0.5 * Math.PI, Math.PI);
    cr.closePath();
}

/**
 * Draw a single line of text with Pango.
 * `x`/`y` refer to the top-left (or the aligned edge) of the text box.
 */
export function drawText(cr, text, {
    x = 0,
    y = 0,
    font = 'Cantarell 11',
    color = '#ffffff',
    alpha = 1,
    align = 'left',
    valign = 'top',
} = {}) {
    const layout = PangoCairo.create_layout(cr);
    layout.set_font_description(Pango.FontDescription.from_string(font));
    layout.set_text(String(text), -1);
    const [width, height] = layout.get_pixel_size();

    let px = x;
    if (align === 'center')
        px = x - width / 2;
    else if (align === 'right')
        px = x - width;

    let py = y;
    if (valign === 'middle')
        py = y - height / 2;
    else if (valign === 'bottom')
        py = y - height;

    cr.moveTo(px, py);
    setSourceHex(cr, color, alpha);
    PangoCairo.show_layout(cr, layout);
    return {width, height};
}
