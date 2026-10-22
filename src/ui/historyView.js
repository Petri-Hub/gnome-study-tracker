import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {formatLiters} from '../core/format.js';
import {dayKey, dayMs} from '../core/state.js';
import {HabitCard} from './habitCard.js';
import {button, divider, label, layout} from './helpers.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday'];
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MAX_MONTHS_BACK = 12;

function atNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function monthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addMonths(date, delta) {
    return new Date(date.getFullYear(), date.getMonth() + delta, 1, 12);
}

/**
 * A month calendar with a day editor. It edits the same daily records as the
 * Today tab, but for any date in the retained history.
 */
export class HistoryView {
    constructor({onAddWater, onToggleHabit}) {
        this._onAddWater = onAddWater;
        this._onToggleHabit = onToggleHabit;
        this._state = null;
        this._now = 0;
        this._month = null;
        this._selectedMs = null;
        this._cells = [];
        this._initialized = false;
        this._step = 250;

        this._monthLabel = label('', 'study-history-month', {
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._prev = this._navButton('go-previous-symbolic', 'Previous month',
            () => this._changeMonth(-1));
        this._next = this._navButton('go-next-symbolic', 'Next month',
            () => this._changeMonth(1));

        this._calendarGrid = layout({
            vertical: true,
            spacing: 1,
            x_expand: true,
            style_class: 'study-history-grid',
        });

        const monthRow = layout({
            spacing: 4,
            x_expand: true,
            style_class: 'study-history-calendar-header',
        });
        monthRow.add_child(this._prev);
        monthRow.add_child(this._monthLabel);
        monthRow.add_child(this._next);

        const weekdays = layout({
            spacing: 1,
            x_expand: true,
            style_class: 'study-history-weekdays',
        });
        for (const initial of WEEKDAY_INITIALS) {
            weekdays.add_child(label(initial, 'study-history-weekday', {
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            }));
        }

        const calendar = layout({
            vertical: true,
            spacing: 4,
            x_expand: false,
            style_class: 'study-history-calendar',
        });
        calendar.add_child(monthRow);
        calendar.add_child(weekdays);
        calendar.add_child(this._calendarGrid);

        this._dateLabel = label('', 'study-history-date');
        this._relative = label('', 'study-history-relative');
        this._todayButton = button(
            label('Today', 'study-history-today-label'),
            'study-history-today', () => this._selectToday());

        const editorHeader = layout({
            spacing: 6,
            x_expand: true,
            style_class: 'study-history-editor-header',
        });
        editorHeader.add_child(this._dateLabel);
        editorHeader.add_child(this._relative);
        editorHeader.add_child(layout({x_expand: true}));
        editorHeader.add_child(this._todayButton);

        this._waterValue = label('0.00 L', 'study-history-water-value', {
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._waterCaption = label('', 'study-history-caption');

        const waterRow = layout({
            spacing: 6,
            x_expand: true,
            style_class: 'study-history-water',
        });
        waterRow.add_child(this._stepButton('−', -1, 'Remove water'));
        waterRow.add_child(this._waterValue);
        waterRow.add_child(this._stepButton('+', 1, 'Add water'));
        waterRow.add_child(layout({x_expand: true}));

        this._sun = new HabitCard({
            key: 'sun',
            text: 'Sun',
            icon: 'weather-clear-symbolic',
            onToggle: () => this._toggleHabit('sun'),
        });
        this._walk = new HabitCard({
            key: 'walk',
            text: 'Walk',
            iconFile: 'study-walk-symbolic.svg',
            iconOnFile: 'study-walk-on-symbolic.svg',
            onToggle: () => this._toggleHabit('walk'),
        });

        const editor = layout({
            vertical: true,
            spacing: 5,
            x_expand: true,
            style_class: 'study-history-editor',
        });
        editor.add_child(editorHeader);
        editor.add_child(label('WATER', 'study-history-heading'));
        editor.add_child(waterRow);
        editor.add_child(this._waterCaption);
        editor.add_child(label('HABITS', 'study-history-heading'));
        editor.add_child(this._sun.actor);
        editor.add_child(this._walk.actor);
        editor.add_child(label('Focus blocks stay automatic',
            'study-history-foot'));

        this.actor = layout({
            spacing: 0,
            x_expand: true,
            y_expand: true,
            style_class: 'study-history',
        });
        this.actor.add_child(calendar);
        this.actor.add_child(divider(true));
        this.actor.add_child(editor);
    }

    get selectedKey() {
        return this._selectedMs === null ? null : dayKey(this._selectedMs);
    }

    get monthKey() {
        if (!this._month)
            return null;
        const month = String(this._month.getMonth() + 1).padStart(2, '0');
        return `${this._month.getFullYear()}-${month}`;
    }

    update(state, now) {
        this._state = state;
        this._now = now;

        if (!this._initialized) {
            this._initialized = true;
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            this._selectedMs = atNoon(yesterday).getTime();
            this._month = monthStart(yesterday);
            this._buildCalendar();
        } else if (!this._month) {
            this._buildCalendar();
        } else {
            this._refreshCalendar();
            this._updateNav();
        }

        this._refreshEditor();
    }

    selectKey(key) {
        const ms = dayMs(key);
        if (ms === null)
            return;
        if (!this._now)
            this._now = Date.now();
        if (dayKey(ms) > dayKey(this._now))
            return;
        this._select(ms);
    }

    _navButton(iconName, accessibleName, onClick) {
        return button(new St.Icon({
            icon_name: iconName,
            icon_size: 10,
            style_class: 'study-history-nav-icon',
        }), 'study-history-nav', onClick, {accessible_name: accessibleName});
    }

    _stepButton(glyph, delta, accessibleName) {
        return button(
            label(glyph, 'study-step-glyph'),
            'study-step study-history-step',
            () => this._adjustWater(delta),
            {accessible_name: accessibleName});
    }

    _dayButton(ms) {
        const date = new Date(ms);
        const number = label(String(date.getDate()), 'study-history-day-number');
        const dots = layout({
            spacing: 1,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'study-history-dots',
        });
        const dot = kind => {
            const widget = new St.Widget({
                style_class: `study-history-dot ${kind}`,
            });
            dots.add_child(widget);
            return widget;
        };
        const water = dot('water');
        const sun = dot('sun');
        const walk = dot('walk');

        const content = layout({
            vertical: true,
            spacing: 0,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        content.add_child(number);
        content.add_child(dots);

        const buttonActor = new St.Button({
            style_class: 'study-history-day',
            can_focus: true,
            x_expand: true,
            child: content,
        });
        buttonActor.connect('clicked', () => this._select(ms));

        return {
            key: dayKey(ms),
            ms,
            button: buttonActor,
            dots: {water, sun, walk},
        };
    }

    _buildCalendar() {
        this._calendarGrid.destroy_all_children();
        this._cells = [];
        if (!this._month)
            return;

        const year = this._month.getFullYear();
        const month = this._month.getMonth();
        const first = new Date(year, month, 1, 12);
        const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
        this._monthLabel.set_text(`${MONTHS[month]} ${year}`);

        for (let week = 0; week < 6; week++) {
            const row = layout({
                spacing: 1,
                x_expand: true,
                style_class: 'study-history-week',
            });
            for (let weekday = 0; weekday < 7; weekday++) {
                const day = week * 7 + weekday - first.getDay() + 1;
                if (day < 1 || day > daysInMonth) {
                    row.add_child(new St.Widget({
                        style_class: 'study-history-blank',
                        x_expand: true,
                    }));
                    continue;
                }
                const cell = this._dayButton(new Date(year, month, day, 12).getTime());
                this._cells.push(cell);
                row.add_child(cell.button);
            }
            this._calendarGrid.add_child(row);
        }

        this._refreshCalendar();
        this._updateNav();
    }

    _refreshCalendar() {
        const todayKey = this._now ? dayKey(this._now) : null;
        const selectedKey = this.selectedKey;

        for (const cell of this._cells) {
            const day = this._state?.days?.[cell.key];
            const future = todayKey !== null && cell.key > todayKey;
            const classes = ['study-history-day'];
            if (day && (day.water > 0 || day.sun || day.walk || day.focus > 0))
                classes.push('has-data');
            if (cell.key === todayKey)
                classes.push('today');
            if (cell.key === selectedKey)
                classes.push('selected');
            if (future)
                classes.push('future');

            cell.button.set_style_class_name(classes.join(' '));
            cell.button.sensitive = !future;

            this._setDot(cell.dots.water, 'water', (day?.water ?? 0) > 0);
            this._setDot(cell.dots.sun, 'sun', Boolean(day?.sun));
            this._setDot(cell.dots.walk, 'walk', Boolean(day?.walk));

            const date = new Date(cell.ms);
            const parts = [`${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`];
            if (day?.water > 0)
                parts.push(formatLiters(day.water));
            if (day?.sun)
                parts.push('sun');
            if (day?.walk)
                parts.push('walk');
            if (day?.focus > 0)
                parts.push(`${day.focus} focus ${day.focus === 1 ? 'block' : 'blocks'}`);
            cell.button.accessible_name = parts.join(', ');
        }
    }

    _setDot(widget, kind, on) {
        widget.set_style_class_name(
            `study-history-dot ${kind}${on ? ' on' : ''}`);
    }

    _updateNav() {
        if (!this._month || !this._now)
            return;
        const current = monthStart(new Date(this._now));
        const earliest = addMonths(current, -MAX_MONTHS_BACK);
        this._prev.sensitive = this._month > earliest;
        this._next.sensitive = this._month < current;
    }

    _refreshEditor() {
        if (this._selectedMs === null) {
            this._todayButton.visible = false;
            return;
        }

        const selected = new Date(this._selectedMs);
        const key = dayKey(this._selectedMs);
        const day = this._state?.days?.[key] ?? null;
        const settings = this._state?.settings;
        const goal = settings?.waterGoalMl ?? 2000;
        this._step = settings?.waterStepMl ?? 250;

        this._dateLabel.set_text(
            `${WEEKDAYS[selected.getDay()]} ${selected.getDate()} ${MONTHS[selected.getMonth()]} ${selected.getFullYear()}`);
        this._relative.set_text(this._relativeLabel(key));
        this._waterValue.set_text(formatLiters(day?.water ?? 0));
        this._waterCaption.set_text(
            `of ${formatLiters(goal)} · ${this._step} ml steps`);
        this._sun.update(day);
        this._walk.update(day);

        const todayKey = this._now ? dayKey(this._now) : null;
        this._todayButton.visible = key !== todayKey;
    }

    _relativeLabel(key) {
        if (!this._now)
            return '';
        const todayKey = dayKey(this._now);
        if (key === todayKey)
            return 'Today';
        const yesterday = new Date(this._now);
        yesterday.setDate(yesterday.getDate() - 1);
        return key === dayKey(yesterday.getTime()) ? 'Yesterday' : '';
    }

    _select(ms) {
        this._selectedMs = ms;
        const month = monthStart(new Date(ms));
        if (!this._month || month.getTime() !== this._month.getTime()) {
            this._month = month;
            this._buildCalendar();
        } else {
            this._refreshCalendar();
            this._updateNav();
        }
        this._refreshEditor();
    }

    _selectToday() {
        if (!this._now)
            return;
        this._select(atNoon(new Date(this._now)).getTime());
    }

    _changeMonth(delta) {
        if (!this._month || !this._now)
            return;
        const current = monthStart(new Date(this._now));
        const earliest = addMonths(current, -MAX_MONTHS_BACK);
        const next = addMonths(this._month, delta);
        if (next < earliest || next > current)
            return;

        const selected = this._selectedMs === null
            ? 1 : new Date(this._selectedMs).getDate();
        const last = new Date(next.getFullYear(), next.getMonth() + 1, 0, 12).getDate();
        let candidate = new Date(next.getFullYear(), next.getMonth(),
            Math.min(selected, last), 12);
        if (candidate > atNoon(new Date(this._now)))
            candidate = atNoon(new Date(this._now));

        this._selectedMs = candidate.getTime();
        this._month = next;
        this._buildCalendar();
        this._refreshEditor();
    }

    _adjustWater(delta) {
        if (this._selectedMs === null)
            return;
        this._onAddWater(this._selectedMs, delta * this._step);
    }

    _toggleHabit(key) {
        if (this._selectedMs === null)
            return;
        this._onToggleHabit(this._selectedMs, key);
    }
}
