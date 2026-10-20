import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {label, layout} from './helpers.js';

const ICONS_DIR = GLib.canonicalize_filename('../../icons',
    GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]));

/** A one-tap daily habit row, used by Sun and Walk. */
export class HabitCard {
    constructor({key, text, icon, iconFile = null, iconOnFile = null,
        fallbackIcon = null, onToggle}) {
        this._key = key;
        this._check = new St.Icon({
            icon_name: 'object-select-symbolic',
            icon_size: 11,
            style_class: 'study-habit-check',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });

        this._iconActor = new St.Icon({
            icon_size: 14,
            style_class: 'study-habit-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._icons = null;
        this._done = null;
        if (iconFile) {
            const load = name => Gio.FileIcon.new(Gio.File.new_for_path(
                GLib.build_filenamev([ICONS_DIR, name])));
            this._icons = {
                off: load(iconFile),
                on: load(iconOnFile ?? iconFile),
            };
            this._iconActor.gicon = this._icons.off;
        } else {
            this._iconActor.icon_name = icon;
            if (fallbackIcon)
                this._iconActor.fallback_icon_name = fallbackIcon;
        }

        const row = layout({spacing: 7, x_expand: true});
        row.add_child(this._iconActor);
        row.add_child(label(text, 'study-habit-label', {
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        }));
        row.add_child(this._check);

        this.actor = new St.Button({
            style_class: `study-habit study-habit-${key}`,
            can_focus: true,
            x_expand: true,
            child: row,
        });
        this.actor.connect('clicked', () => onToggle());
    }

    update(day) {
        const done = Boolean(day?.[this._key]);
        this.actor.set_style_class_name(
            `study-habit study-habit-${this._key}${done ? ' on' : ''}`);
        this._check.visible = done;
        if (this._icons && done !== this._done)
            this._iconActor.gicon = done ? this._icons.on : this._icons.off;
        this._done = done;
    }
}
