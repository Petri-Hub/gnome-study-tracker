import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class Store {
    constructor() {
        const directory = Gio.File.new_for_path(
            GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-study-tracker']));
        this._file = directory.get_child('state.json');
        this._directory = directory;
    }

    get path() {
        return this._file.get_path();
    }

    load() {
        if (!this._file.query_exists(null))
            return null;
        try {
            const [, contents] = this._file.load_contents(null);
            return JSON.parse(new TextDecoder('utf-8').decode(contents));
        } catch (error) {
            logError(error, 'Study Tracker: failed to read state');
            return null;
        }
    }

    save(state) {
        try {
            this._directory.make_directory_with_parents(null);
        } catch (error) {
            if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                throw error;
        }

        const data = new TextEncoder().encode(`${JSON.stringify(state, null, 2)}\n`);
        this._file.replace_contents(
            data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    }
}
