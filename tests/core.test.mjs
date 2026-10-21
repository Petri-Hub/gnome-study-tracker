import assert from 'node:assert/strict';
import test from 'node:test';

import {
    addWater,
    createState,
    dayKey,
    dayLevel,
    dayScore,
    heatmapData,
    normalize,
    rangeStats,
    recordFocus,
    recentDays,
    streak,
    toggleSun,
    toggleWalk,
} from '../src/core/state.js';
import {
    idleTimer,
    pause,
    remainingMs,
    reset,
    setMode,
    start,
    tick,
    toggle,
} from '../src/core/timer.js';
import {formatClock, formatLiters} from '../src/core/format.js';

const T0 = new Date(2026, 9, 19, 9, 0, 0).getTime(); // Mon 19 Oct 2026, local
const MIN = 60000;

test('defaults: 90 minute focus and 20 minute break', () => {
    const state = createState();
    assert.equal(state.settings.focusMinutes, 90);
    assert.equal(state.settings.breakMinutes, 20);
    assert.equal(state.timers.focus.mode, 'focus');
    assert.equal(state.timers.focus.remainingMs, 90 * MIN);
    assert.equal(state.timers.break.remainingMs, 20 * MIN);
});

test('defaults: 2 L water goal, 250 ml scroll and quieter sound', () => {
    const state = createState();
    assert.equal(state.settings.waterGoalMl, 2000);
    assert.equal(state.settings.waterStepMl, 250);
    assert.equal(state.settings.soundVolume, 60);
    assert.equal(state.settings.sound, true);
});

test('timer: start, pause and resume preserve the remaining time', () => {
    const state = createState();
    let timer = start(state.timers.focus, T0, state.settings);
    assert.equal(timer.status, 'running');
    assert.equal(remainingMs(timer, T0 + 10 * MIN), 80 * MIN);

    timer = pause(timer, T0 + 10 * MIN);
    assert.equal(timer.status, 'paused');
    assert.equal(timer.remainingMs, 80 * MIN);
    assert.equal(remainingMs(timer, T0 + 60 * MIN), 80 * MIN);

    timer = start(timer, T0 + 60 * MIN, state.settings);
    assert.equal(remainingMs(timer, T0 + 70 * MIN), 70 * MIN);
});

test('timer: toggle is pause/resume', () => {
    const state = createState();
    let timer = toggle(state.timers.focus, T0, state.settings);
    assert.equal(timer.status, 'running');
    timer = toggle(timer, T0 + MIN, state.settings);
    assert.equal(timer.status, 'paused');
});

test('timer: completing focus switches to a fresh break', () => {
    const state = createState();
    let timer = start(state.timers.focus, T0, state.settings);
    const after85 = tick(timer, T0 + 85 * MIN, state.settings);
    assert.equal(after85.completed, null);
    assert.equal(remainingMs(after85.timer, T0 + 85 * MIN), 5 * MIN);

    const done = tick(timer, T0 + 90 * MIN, state.settings);
    assert.equal(done.completed, 'focus');
    assert.equal(done.timer.mode, 'break');
    assert.equal(done.timer.status, 'idle');
    assert.equal(done.timer.remainingMs, 20 * MIN);
});

test('timer: reset and mode switch use configured durations', () => {
    const state = createState({focusMinutes: 50, breakMinutes: 10});
    let timer = start(state.timers.focus, T0, state.settings);
    timer = reset(timer, state.settings);
    assert.equal(timer.remainingMs, 50 * MIN);
    timer = setMode(timer, 'break', state.settings);
    assert.equal(timer.mode, 'break');
    assert.equal(timer.remainingMs, 10 * MIN);
});

test('formatting', () => {
    assert.equal(formatClock(90 * MIN), '1:30:00');
    assert.equal(formatClock(20 * MIN + 7000), '20:07');
    assert.equal(formatLiters(1250), '1.25 L');
});

test('water, sun, walk and focus feed the daily score', () => {
    const state = createState();
    assert.equal(dayScore(state.days[dayKey(T0)], state.settings), 0);

    addWater(state, T0, 2500);
    assert.equal(dayScore(state.days[dayKey(T0)], state.settings), 1);
    assert.equal(state.days[dayKey(T0)].walk, false);

    toggleSun(state, T0);
    assert.equal(dayScore(state.days[dayKey(T0)], state.settings), 2);

    toggleWalk(state, T0);
    assert.equal(dayScore(state.days[dayKey(T0)], state.settings), 3);

    recordFocus(state, T0, 90);
    assert.equal(dayScore(state.days[dayKey(T0)], state.settings), 4);
    assert.equal(dayLevel(state.days[dayKey(T0)], state.settings), 4);

    recordFocus(state, T0, 90);
    assert.equal(dayLevel(state.days[dayKey(T0)], state.settings), 5);
});

test('legacy days keep their old heatmap scale without a walk field', () => {
    const key = dayKey(T0);
    const state = normalize({
        version: 3,
        days: {
            [key]: {water: 2000, sun: true, focus: 2, focusMinutes: 180},
        },
    });
    assert.equal(state.days[key].walk, null);
    assert.equal(dayScore(state.days[key], state.settings), 3);
    assert.equal(dayLevel(state.days[key], state.settings), 4);
});

test('adding water clamps at zero', () => {
    const state = createState();
    addWater(state, T0, 250);
    addWater(state, T0, -1000);
    assert.equal(state.days[dayKey(T0)].water, 0);
});

test('streak counts back over active days and tolerates an empty today', () => {
    const state = createState();
    for (let i = 1; i <= 3; i++) {
        const day = new Date(T0);
        day.setDate(day.getDate() - i);
        toggleSun(state, day.getTime());
    }
    // Today is still empty: the streak should still be 3.
    assert.equal(streak(state, T0), 3);

    toggleSun(state, T0);
    assert.equal(streak(state, T0), 4);
});

test('heatmap returns full columns of 7 and ends today', () => {
    const state = createState();
    const data = heatmapData(state, T0, 25);
    assert.ok(data.columns.length >= 25);
    for (const column of data.columns)
        assert.equal(column.length, 7);
    const flat = data.columns.flat().filter(Boolean);
    assert.equal(flat.at(-1).key, dayKey(T0));
    assert.equal(flat.at(-1).walk, false);
    assert.ok(data.labels.length >= 5);
});

test('recent days and range stats cover the trailing week', () => {
    const state = createState();
    const day = new Date(T0);
    day.setDate(day.getDate() - 1);
    const yesterday = day.getTime();
    addWater(state, yesterday, 2000);
    toggleSun(state, yesterday);
    toggleWalk(state, yesterday);
    recordFocus(state, yesterday, 90);

    const days = recentDays(state, T0, 7);
    assert.equal(days.length, 7);
    assert.equal(days.at(-1).key, dayKey(T0));
    assert.equal(days.at(-2).key, dayKey(yesterday));
    assert.equal(days.at(-2).water, 2000);
    assert.equal(days.at(-2).sun, true);
    assert.equal(days.at(-2).walk, true);
    assert.equal(days.at(-2).focusMinutes, 90);
    assert.equal(days.at(-1).hasData, false);

    const stats = rangeStats(state, T0, 7);
    assert.equal(stats.days, 7);
    assert.equal(stats.waterTotal, 2000);
    assert.equal(stats.waterAverage, 2000 / 7);
    assert.equal(stats.waterGoalDays, 1);
    assert.equal(stats.sunDays, 1);
    assert.equal(stats.walkDays, 1);
    assert.equal(stats.focusBlocks, 1);
    assert.equal(stats.focusMinutes, 90);
    assert.equal(stats.activeDays, 1);
});

test('state v2 migrates the old 30m break default', () => {
    const migrated = normalize({version: 2, settings: {breakMinutes: 30}});
    assert.equal(migrated.version, 4);
    assert.equal(migrated.settings.breakMinutes, 20);

    const custom = normalize({version: 2, settings: {breakMinutes: 25}});
    assert.equal(custom.settings.breakMinutes, 25);
});

test('normalize repairs bad input and keeps unknown days out', () => {
    const state = normalize({
        settings: {focusMinutes: 0, breakMinutes: 999},
        days: {
            [dayKey(T0)]: {water: 500, sun: 1, walk: 1, focus: 2, focusMinutes: 90},
            'not-a-day': {water: 1},
        },
        timer: {mode: 'break', status: 'running', startedAt: null},
    });
    assert.equal(state.settings.focusMinutes, 90);
    assert.equal(state.settings.breakMinutes, 180);
    assert.equal(state.days[dayKey(T0)].sun, true);
    assert.equal(state.days[dayKey(T0)].walk, true);
    assert.equal(state.days['not-a-day'], undefined);
    assert.equal(state.timers.break.status, 'idle');
});

test('state v1 migrates the old 2.5 L default but keeps a custom goal', () => {
    const migrated = normalize({version: 1, settings: {waterGoalMl: 2500}});
    assert.equal(migrated.version, 4);
    assert.equal(migrated.settings.waterGoalMl, 2000);
    assert.equal(migrated.settings.breakMinutes, 20);

    const custom = normalize({version: 1, settings: {
        waterGoalMl: 3000,
        breakMinutes: 45,
    }});
    assert.equal(custom.settings.waterGoalMl, 3000);
    assert.equal(custom.settings.breakMinutes, 45);
});

test('settings: zero volume is valid and numeric values are bounded', () => {
    const zero = createState({
        focusMinutes: 0,
        waterStepMl: 0,
        soundVolume: 0,
    });
    assert.equal(zero.settings.focusMinutes, 90);
    assert.equal(zero.settings.waterStepMl, 250);
    assert.equal(zero.settings.soundVolume, 0);
    assert.equal(createState({soundVolume: null}).settings.soundVolume, 60);

    const huge = createState({
        waterGoalMl: 1,
        waterStepMl: 9999,
        soundVolume: 999,
    });
    assert.equal(huge.settings.waterGoalMl, 250);
    assert.equal(huge.settings.waterStepMl, 1000);
    assert.equal(huge.settings.soundVolume, 100);
});

test('normalize restores a running timer and its remaining time', () => {
    const state = createState();
    const timer = start(state.timers.focus, T0, state.settings);
    const restored = normalize({
        ...state,
        viewMode: 'break',
        timers: {...state.timers, focus: timer},
    });
    assert.equal(restored.timers.focus.status, 'running');
    assert.equal(remainingMs(restored.timers.focus, T0 + 30 * MIN), 60 * MIN);
    assert.equal(restored.viewMode, 'focus');
});

test('idle timer helper is consistent', () => {
    const t = idleTimer('break', createState().settings);
    assert.equal(t.remainingMs, 20 * MIN);
    assert.equal(t.status, 'idle');
});
