export function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatMinutes(ms) {
    return `${Math.max(1, Math.ceil(ms / 60000))}m`;
}

export function formatLiters(ml) {
    return `${(Math.max(0, ml) / 1000).toFixed(2)} L`;
}

export function formatDurationWords(minutes) {
    const safe = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safe / 60);
    const rest = safe % 60;
    if (hours === 0)
        return `${rest}m`;
    if (rest === 0)
        return `${hours}h`;
    return `${hours}h ${String(rest).padStart(2, '0')}m`;
}
