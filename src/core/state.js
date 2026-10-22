import {idleTimer} from './timer.js';

export const VERSION = 4;

export const DEFAULT_SETTINGS = Object.freeze({
    focusMinutes: 90,
    breakMinutes: 20,
    waterGoalMl: 2000,
    waterStepMl: 250,
    autoStartNext: false,
    sound: true,
    soundVolume: 60,
});

const DAY_DEFAULTS = Object.freeze({
    water: 0,
    sun: false,
    walk: false,
    focus: 0,
    focusMinutes: 0,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function dayKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Resolve a saved `YYYY-MM-DD` key to local noon, avoiding DST edges. */
export function dayMs(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12);
    return dayKey(date.getTime()) === key ? date.getTime() : null;
}

export function createState(overrides = {}) {
    const settings = normalizeSettings(overrides);
    return {
        version: VERSION,
        settings,
        days: {},
        timers: {
            focus: idleTimer('focus', settings),
            break: idleTimer('break', settings),
        },
        viewMode: 'focus',
    };
}

function normalizeSettings(raw = {}) {
    const positive = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    };
    const volume = Number(raw.soundVolume);
    const hasVolume = raw.soundVolume !== undefined && raw.soundVolume !== null;
    return {
        focusMinutes: clamp(positive(raw.focusMinutes,
            DEFAULT_SETTINGS.focusMinutes), 5, 600),
        breakMinutes: clamp(positive(raw.breakMinutes,
            DEFAULT_SETTINGS.breakMinutes), 1, 180),
        waterGoalMl: clamp(positive(raw.waterGoalMl,
            DEFAULT_SETTINGS.waterGoalMl), 250, 10000),
        waterStepMl: clamp(positive(raw.waterStepMl,
            DEFAULT_SETTINGS.waterStepMl), 25, 1000),
        autoStartNext: Boolean(raw.autoStartNext ?? DEFAULT_SETTINGS.autoStartNext),
        sound: Boolean(raw.sound ?? DEFAULT_SETTINGS.sound),
        soundVolume: clamp(hasVolume && Number.isFinite(volume)
            ? volume : DEFAULT_SETTINGS.soundVolume, 0, 100),
    };
}

function normalizeDay(raw) {
    if (!raw || typeof raw !== 'object')
        return {...DAY_DEFAULTS};
    return {
        water: Math.max(0, Number(raw.water) || 0),
        sun: Boolean(raw.sun),
        // Days saved before the walk habit existed keep null, so the new habit
        // does not retroactively lower their heatmap colour.
        walk: raw.walk === undefined || raw.walk === null
            ? null : Boolean(raw.walk),
        focus: Math.max(0, Number(raw.focus) || 0),
        focusMinutes: Math.max(0, Number(raw.focusMinutes) || 0),
    };
}

function normalizeTimer(raw, mode, settings) {
    const focusMs = settings.focusMinutes * 60000;
    const breakMs = settings.breakMinutes * 60000;
    const fallbackTotal = mode === 'focus' ? focusMs : breakMs;
    const totalMs = Math.max(1000, Number(raw?.totalMs) || fallbackTotal);
    const status = ['idle', 'running', 'paused'].includes(raw?.status)
        ? raw.status : 'idle';
    const remainingMs = clamp(Number(raw?.remainingMs) || totalMs, 0, totalMs);
    const startedAt = Number(raw?.startedAt) || null;

    if (status === 'running' && startedAt === null)
        return idleTimer(mode, settings);

    return {mode, status, totalMs, remainingMs, startedAt};
}

export function normalize(raw) {
    if (!raw || typeof raw !== 'object')
        return createState();

    const version = Number(raw.version) || 1;
    const settings = raw.settings && typeof raw.settings === 'object'
        ? {...raw.settings} : {};
    if (version < 2) {
        // The original build used a 2.5 L default; bring that one value over
        // to the 2 L goal, but leave a deliberately custom goal alone.
        if (settings.waterGoalMl === undefined || Number(settings.waterGoalMl) === 2500)
            settings.waterGoalMl = DEFAULT_SETTINGS.waterGoalMl;
    }
    if (version < 3) {
        // The first two versions defaulted breaks to 30 minutes.
        if (settings.breakMinutes === undefined || Number(settings.breakMinutes) === 30)
            settings.breakMinutes = DEFAULT_SETTINGS.breakMinutes;
    }

    const state = createState(settings);
    state.days = {};
    if (raw.days && typeof raw.days === 'object') {
        for (const [key, day] of Object.entries(raw.days)) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(key))
                state.days[key] = normalizeDay(day);
        }
    }

    const rawTimers = raw.timers && typeof raw.timers === 'object'
        ? raw.timers : null;
    const legacy = raw.timer && typeof raw.timer === 'object'
        ? raw.timer : null;
    const focusRaw = rawTimers?.focus
        ?? (legacy?.mode === 'focus' ? legacy : null);
    const breakRaw = rawTimers?.break
        ?? (legacy?.mode === 'break' ? legacy : null);
    state.timers = {
        focus: normalizeTimer(focusRaw, 'focus', state.settings),
        break: normalizeTimer(breakRaw, 'break', state.settings),
    };

    state.viewMode = raw.viewMode === 'break' || raw.viewMode === 'focus'
        ? raw.viewMode
        : legacy?.mode === 'break' ? 'break' : 'focus';

    // If a block was running or paused when the shell stopped, open on it so
    // the next interaction resumes the work the person actually cares about.
    const live = ['running', 'paused'].find(status =>
        ['focus', 'break'].some(mode => state.timers[mode].status === status));
    if (live) {
        state.viewMode = ['focus', 'break'].find(mode =>
            state.timers[mode].status === live) ?? state.viewMode;
    }

    return state;
}

export function getDay(state, ms) {
    return state.days[dayKey(ms)] ?? null;
}

export function ensureDay(state, ms) {
    const key = dayKey(ms);
    let day = state.days[key];
    if (!day) {
        day = {...DAY_DEFAULTS};
        state.days[key] = day;
    }
    return day;
}

export function addWater(state, ms, ml) {
    const day = ensureDay(state, ms);
    day.water = clamp(day.water + Number(ml || 0), 0, 20000);
    return day.water;
}

export function toggleSun(state, ms) {
    const day = ensureDay(state, ms);
    day.sun = !day.sun;
    return day.sun;
}

export function toggleWalk(state, ms) {
    const day = ensureDay(state, ms);
    day.walk = !day.walk;
    return day.walk;
}

export function recordFocus(state, ms, minutes) {
    const day = ensureDay(state, ms);
    day.focus += 1;
    day.focusMinutes += Math.max(0, Math.round(minutes));
    return day;
}

/** Number of the daily habits completed: water goal, sun, walk and focus. */
export function dayScore(day, settings) {
    if (!day)
        return 0;
    let done = 0;
    if ((day.water ?? 0) >= settings.waterGoalMl)
        done++;
    if (day.sun)
        done++;
    if (day.walk)
        done++;
    if ((day.focus ?? 0) >= 1)
        done++;
    return done;
}

/**
 * GitHub-style intensity: 0..5, with a bonus level when every habit tracked
 * that day is done and there are at least two focus blocks. Days before the
 * walk habit existed have walk === null and keep their old 0..4 scale.
 */
export function dayLevel(day, settings) {
    const done = dayScore(day, settings);
    const habits = day?.walk === null ? 3 : 4;
    if (done === habits && (day?.focus ?? 0) >= 2)
        return done + 1;
    return done;
}

/**
 * A 0..1 heatmap value for a day. The habits are weighted by progress rather
 * than by a yes/no count: a partial water goal, a partial focus block and a
 * second focus block all move the cell along the same green scale.
 */
export function dayIntensity(day, settings) {
    if (!day)
        return 0;

    const waterGoal = Math.max(1, Number(settings.waterGoalMl) || 1);
    const water = clamp((Number(day.water) || 0) / waterGoal, 0, 1);
    const sun = day.sun ? 1 : 0;
    const walk = day.walk ? 1 : 0;

    const focusGoal = Math.max(1, Number(settings.focusMinutes) || 90);
    const focusMinutes = Math.max(0, Number(day.focusMinutes) || 0);
    const focus = focusMinutes > 0
        ? clamp(focusMinutes / focusGoal, 0, 1.25)
        : clamp(Number(day.focus) || 0, 0, 1.25);

    // A full habit is 1; a second focus block adds a quarter so the brightest
    // cell still means "everything done, plus extra study".
    const progress = water + sun + walk + focus;
    if (progress <= 0)
        return 0;
    return clamp(progress / 4.25, 0.12, 1);
}

export function isActive(day, settings) {
    return dayScore(day, settings) > 0;
}

/**
 * Build the calendar grid used by the heatmap.
 * Columns are weeks starting on Sunday; the last column may contain nulls.
 */
export function heatmapData(state, nowMs, weeks = 25) {
    const end = new Date(nowMs);
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
    const start = new Date(endDate);
    start.setDate(start.getDate() - (weeks * 7 - 1));
    start.setDate(start.getDate() - start.getDay());

    const endKey = dayKey(endDate.getTime());
    const columns = [];
    let column = [];

    for (const cursor = new Date(start);
        dayKey(cursor.getTime()) <= endKey;
        cursor.setDate(cursor.getDate() + 1)) {
        const key = dayKey(cursor.getTime());
        const day = state.days[key];
        column.push({
            key,
            ms: cursor.getTime(),
            level: dayLevel(day, state.settings),
            intensity: dayIntensity(day, state.settings),
            water: day?.water ?? 0,
            sun: Boolean(day?.sun),
            walk: Boolean(day?.walk),
            focus: day?.focus ?? 0,
            score: dayScore(day, state.settings),
        });
        if (column.length === 7) {
            columns.push(column);
            column = [];
        }
    }
    while (column.length > 0 && column.length < 7)
        column.push(null);
    if (column.length)
        columns.push(column);

    const labels = [];
    let lastMonth = -1;
    columns.forEach((col, index) => {
        const first = col.find(cell => cell !== null);
        if (!first)
            return;
        const month = new Date(first.ms).getMonth();
        if (month !== lastMonth) {
            labels.push({index, label: MONTHS[month]});
            lastMonth = month;
        }
    });

    return {columns, labels, startKey: dayKey(start.getTime()), endKey};
}

/** Consecutive active days, ending today (or yesterday if today is still empty). */
export function streak(state, nowMs) {
    const cursor = new Date(nowMs);
    if (!isActive(state.days[dayKey(cursor.getTime())], state.settings))
        cursor.setDate(cursor.getDate() - 1);

    let count = 0;
    while (true) {
        const key = dayKey(cursor.getTime());
        if (!isActive(state.days[key], state.settings))
            break;
        count++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return count;
}

/** Daily records for a trailing window, oldest first. */
export function recentDays(state, nowMs, days = 7) {
    const end = new Date(nowMs);
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(end);
        date.setDate(date.getDate() - i);
        const key = dayKey(date.getTime());
        const day = state.days[key];
        const minutes = day?.focusMinutes ?? 0;
        out.push({
            key,
            ms: date.getTime(),
            label: WEEKDAYS[date.getDay()],
            initial: WEEKDAYS[date.getDay()][0],
            hasData: Boolean(day),
            water: day?.water ?? 0,
            sun: Boolean(day?.sun),
            walk: Boolean(day?.walk),
            focus: day?.focus ?? 0,
            focusMinutes: minutes,
            minutes,
        });
    }
    return out;
}

/**
 * Aggregate the trailing window used by the details tab. Missing days count as
 * zero so an empty day still lowers the weekly average.
 */
export function rangeStats(state, nowMs, days = 7) {
    const series = recentDays(state, nowMs, days);
    const totalWater = series.reduce((sum, day) => sum + day.water, 0);
    const focusMinutes = series.reduce((sum, day) => sum + day.focusMinutes, 0);
    return {
        days,
        series,
        waterTotal: totalWater,
        waterAverage: totalWater / days,
        waterGoalDays: series.filter(day => day.water >= state.settings.waterGoalMl).length,
        sunDays: series.filter(day => day.sun).length,
        walkDays: series.filter(day => day.walk).length,
        focusBlocks: series.reduce((sum, day) => sum + day.focus, 0),
        focusMinutes,
        focusAverage: focusMinutes / days,
        activeDays: series.filter(day => day.hasData).length,
    };
}

export function prune(state, nowMs, keepDays = 400) {
    const cutoff = new Date(nowMs);
    cutoff.setDate(cutoff.getDate() - keepDays);
    const cutoffKey = dayKey(cutoff.getTime());
    for (const key of Object.keys(state.days)) {
        if (key < cutoffKey)
            delete state.days[key];
    }
}
