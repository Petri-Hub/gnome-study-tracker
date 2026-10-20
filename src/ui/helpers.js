import St from 'gi://St';

export function label(text, styleClass = '', extra = {}) {
    return new St.Label({text, style_class: styleClass, ...extra});
}

export function button(child, styleClass, onClick, extra = {}) {
    const widget = new St.Button({
        style_class: styleClass,
        can_focus: true,
        child,
        ...extra,
    });
    if (onClick)
        widget.connect('clicked', onClick);
    return widget;
}

/**
 * St.BoxLayout has no construct-time `spacing` property in GNOME 49; spacing
 * is a CSS property there, so route it through the inline style.
 */
export function layout({vertical = false, spacing = 0, style = '', ...props} = {}) {
    return new St.BoxLayout({
        vertical,
        ...props,
        style: spacing > 0 ? `spacing: ${spacing}px; ${style}`.trim() : style,
    });
}

/** One-pixel rule used to separate sections instead of card backgrounds. */
export function divider(vertical = false) {
    return new St.Widget({
        style_class: `study-divider ${vertical ? 'study-divider-v' : 'study-divider-h'}`,
        x_expand: !vertical,
        y_expand: vertical,
    });
}

/**
 * Repaint a St.DrawingArea in logical coordinates, accounting for HiDPI scale.
 * `draw(cr, width, height)` must stay free of St/Clutter so it can be tested
 * outside the shell.
 */
export function paintArea(area, draw) {
    const cr = area.get_context();
    const width = area.width;
    const height = area.height;
    if (!width || !height) {
        cr.$dispose();
        return;
    }
    const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    cr.save();
    cr.scale(scale, scale);
    draw(cr, width, height);
    cr.restore();
    cr.$dispose();
}
