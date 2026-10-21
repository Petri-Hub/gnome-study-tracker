import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {formatDurationWords, formatLiters} from '../core/format.js';
import {getDay, rangeStats, streak} from '../core/state.js';
import {drawHabits} from '../render/habits.js';
import {drawWaterWeek} from '../render/waterWeek.js';
import {drawWeek} from '../render/week.js';
import {TodayCard} from './todayCard.js';
import {divider, label, layout, paintArea} from './helpers.js';

function drawingArea(styleClass, height) {
    return new St.DrawingArea({
        style_class: `study-details-chart ${styleClass}`,
        x_expand: true,
        style: `min-height: ${height}px;`,
    });
}

export class DetailsView {
    constructor() {
        this._stats = null;
        this._goal = 2000;
        this._streak = 0;
        this._todayKey = null;

        this._waterArea = drawingArea('study-details-water', 50);
        this._waterArea.connect('repaint', () => {
            paintArea(this._waterArea, (cr, width, height) => {
                drawWaterWeek(cr, width, height, this._stats?.series ?? [], {
                    goal: this._goal,
                    todayKey: this._todayKey,
                });
            });
        });

        this._habitArea = drawingArea('study-details-habits', 36);
        this._habitArea.connect('repaint', () => {
            paintArea(this._habitArea, (cr, width, height) => {
                drawHabits(cr, width, height, this._stats?.series ?? [], {
                    todayKey: this._todayKey,
                });
            });
        });

        this._studyArea = drawingArea('study-details-study', 50);
        this._studyArea.connect('repaint', () => {
            paintArea(this._studyArea, (cr, width, height) => {
                const series = (this._stats?.series ?? []).map(day => ({
                    ...day,
                    label: day.initial,
                }));
                drawWeek(cr, width, height, series, {
                    accent: '#f2555a',
                    todayKey: this._todayKey,
                });
            });
        });

        this._waterValue = label('0.00 L', 'study-details-value');
        this._waterCaption = label('', 'study-details-caption');
        this._waterFoot = label('', 'study-details-foot');

        this._sun = this._miniStat('Sun');
        this._walk = this._miniStat('Walk');
        this._habitFoot = label('', 'study-details-foot');

        this._studyValue = label('0m', 'study-details-value');
        this._studyCaption = label('', 'study-details-caption');
        this._studyFoot = label('', 'study-details-foot');

        this._today = new TodayCard();

        const water = this._column('WATER', [
            this._waterValue,
            this._waterCaption,
            this._waterArea,
            this._waterFoot,
        ], 'first');

        const habitStats = layout({spacing: 12, x_expand: true});
        habitStats.add_child(this._sun.actor);
        habitStats.add_child(this._walk.actor);

        const habits = this._column('HABITS', [
            habitStats,
            this._habitArea,
            this._habitFoot,
        ]);

        const study = this._column('STUDY', [
            this._studyValue,
            this._studyCaption,
            this._studyArea,
            this._studyFoot,
        ], 'last');

        const columns = layout({spacing: 0, x_expand: true, style_class: 'study-details-columns'});
        columns.add_child(water);
        columns.add_child(divider(true));
        columns.add_child(habits);
        columns.add_child(divider(true));
        columns.add_child(study);

        const today = layout({x_expand: true, style_class: 'study-details-today'});
        today.add_child(this._today.actor);

        this.actor = layout({
            vertical: true,
            spacing: 0,
            x_expand: true,
            style_class: 'study-details',
        });
        this.actor.add_child(columns);
        this.actor.add_child(divider(false));
        this.actor.add_child(today);
    }

    _column(heading, children, position = '') {
        const column = layout({
            vertical: true,
            spacing: 3,
            x_expand: true,
            style_class: `study-details-column${position ? ` ${position}` : ''}`,
        });
        column.add_child(label(heading, 'study-details-heading'));
        for (const child of children)
            column.add_child(child);
        return column;
    }

    _miniStat(caption) {
        const value = label('0/7', 'study-details-mini-value', {
            x_align: Clutter.ActorAlign.START,
        });
        const captionLabel = label(caption, 'study-details-mini-label', {
            x_align: Clutter.ActorAlign.START,
        });
        const actor = layout({vertical: true, spacing: 0, x_expand: true});
        actor.add_child(value);
        actor.add_child(captionLabel);
        return {actor, setValue: text => value.set_text(text)};
    }

    update(state, now) {
        const stats = rangeStats(state, now, 7);
        this._stats = stats;
        this._goal = state.settings.waterGoalMl;
        this._streak = streak(state, now);
        this._todayKey = stats.series.at(-1)?.key ?? null;

        this._waterValue.set_text(formatLiters(stats.waterTotal));
        this._waterCaption.set_text(
            `this week · ${formatLiters(stats.waterAverage)}/day`);
        this._waterFoot.set_text(
            `${stats.waterGoalDays}/7 goal days`);

        this._sun.setValue(`${stats.sunDays}/7`);
        this._walk.setValue(`${stats.walkDays}/7`);
        this._habitFoot.set_text(this._streak > 0
            ? `${this._streak}d active streak`
            : 'no active streak');

        this._studyValue.set_text(formatDurationWords(stats.focusMinutes));
        this._studyCaption.set_text(
            `this week · ${stats.focusBlocks} ${stats.focusBlocks === 1 ? 'block' : 'blocks'}`);
        this._studyFoot.set_text(
            `avg ${formatDurationWords(stats.focusAverage)}/day`);

        this._today.update(getDay(state, now));
        this._waterArea.queue_repaint();
        this._habitArea.queue_repaint();
        this._studyArea.queue_repaint();
    }
}
