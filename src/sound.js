import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const SOUND_DIR = GLib.build_filenamev([
    GLib.path_get_dirname(GLib.path_get_dirname(
        GLib.filename_from_uri(import.meta.url)[0])),
    'sounds',
]);

const FILES = {
    click: 'click.wav',
    water: 'water.wav',
    on: 'toggle-on.wav',
    off: 'toggle-off.wav',
    popup: 'popup.wav',
    complete: 'complete.wav',
};

const VOLUME_DB = {
    click: -4,
    water: -3,
    on: -4,
    off: -4,
    popup: -8,
    complete: -1,
};

const THROTTLE_MS = {click: 45, water: 55};

const PLAYERS = [
    {
        program: 'canberra-gtk-play',
        args: (path, volume) => [`--file=${path}`, `--volume=${volume}`],
    },
    {program: 'pw-play', args: path => [path]},
    {program: 'paplay', args: path => [path]},
    {program: 'aplay', args: path => ['-q', path]},
];

let enabled = true;
let volume = 60;
let player = null;
let resolvedPlayer = false;
const lastPlayed = new Map();

function findPlayer() {
    if (resolvedPlayer)
        return player;
    resolvedPlayer = true;
    for (const candidate of PLAYERS) {
        if (GLib.find_program_in_path(candidate.program)) {
            player = candidate;
            break;
        }
    }
    return player;
}

/**
 * Short, quiet UI feedback. All calls are no-ops in the E2E session and when
 * the user turns the Sound option off. Spawning is asynchronous so a click
 * never blocks the shell.
 */
export const sound = {
    setEnabled(value) {
        enabled = Boolean(value);
    },

    /** 0..100, where 100 keeps the WAV's authored level. */
    setVolume(value) {
        const next = Number(value);
        if (Number.isFinite(next))
            volume = Math.min(100, Math.max(0, next));
    },

    play(name) {
        if (!enabled || volume <= 0 || GLib.getenv('STUDY_TRACKER_TEST'))
            return;
        const file = FILES[name];
        if (!file)
            return;

        const now = GLib.get_monotonic_time() / 1000;
        const gap = THROTTLE_MS[name] ?? 40;
        if (now - (lastPlayed.get(name) ?? -Infinity) < gap)
            return;
        lastPlayed.set(name, now);

        const path = GLib.build_filenamev([SOUND_DIR, file]);
        if (!GLib.file_test(path, GLib.FileTest.EXISTS))
            return;
        const chosen = findPlayer();
        if (!chosen)
            return;

        try {
            const attenuation = 20 * Math.log10(volume / 100);
            const level = Math.max(-60, (VOLUME_DB[name] ?? -4) + attenuation);
            const process = Gio.Subprocess.new(
                [chosen.program, ...chosen.args(path, level.toFixed(1))],
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
            process.wait_async(null, null);
        } catch (error) {
            logError(error, 'Study Tracker: sound failed');
        }
    },
};
