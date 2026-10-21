export function durationMs(mode, settings) {
    const minutes = mode === 'break' ? settings.breakMinutes : settings.focusMinutes;
    return Math.max(1, minutes) * 60000;
}

export function idleTimer(mode, settings) {
    const total = durationMs(mode, settings);
    return {
        mode,
        status: 'idle',
        totalMs: total,
        remainingMs: total,
        startedAt: null,
    };
}

export function remainingMs(timer, now) {
    if (timer.status === 'running' && timer.startedAt !== null) {
        return Math.max(0, timer.totalMs - (now - timer.startedAt));
    }
    return Math.max(0, timer.remainingMs);
}

/**
 * Start or resume. `startedAt` is back-dated so that the remaining time is
 * preserved across pauses and shell restarts.
 */
export function start(timer, now, settings) {
    if (timer.status === 'running')
        return timer;

    const total = durationMs(timer.mode, settings);
    const remaining = timer.status === 'paused'
        ? Math.min(timer.remainingMs, total)
        : total;

    return {
        ...timer,
        status: 'running',
        totalMs: total,
        remainingMs: remaining,
        startedAt: now - (total - remaining),
    };
}

export function pause(timer, now) {
    if (timer.status !== 'running')
        return timer;
    return {
        ...timer,
        status: 'paused',
        remainingMs: remainingMs(timer, now),
        startedAt: null,
    };
}

export function reset(timer, settings) {
    return idleTimer(timer.mode, settings);
}

export function setMode(timer, mode, settings) {
    return idleTimer(mode === 'break' ? 'break' : 'focus', settings);
}

export function nextMode(mode) {
    return mode === 'focus' ? 'break' : 'focus';
}

/**
 * Advance the clock. Returns the (possibly switched) timer and the mode that
 * just finished, if any.
 */
export function tick(timer, now, settings) {
    if (timer.status !== 'running')
        return {timer, completed: null};

    if (remainingMs(timer, now) > 0)
        return {timer, completed: null};

    const finished = timer.mode;
    return {
        timer: idleTimer(nextMode(finished), settings),
        completed: finished,
    };
}

export function toggle(timer, now, settings) {
    return timer.status === 'running'
        ? pause(timer, now)
        : start(timer, now, settings);
}
