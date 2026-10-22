import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {getDay} from './core/state.js';
import {sound} from './sound.js';
import {DetailsView} from './ui/detailsView.js';
import {HabitCard} from './ui/habitCard.js';
import {HeatmapCard} from './ui/heatmapCard.js';
import {HistoryView} from './ui/historyView.js';
import {PomodoroCard} from './ui/pomodoroCard.js';
import {SettingsView} from './ui/settingsView.js';
import {createTomatoIcon} from './ui/tomatoIcon.js';
import {WaterCard} from './ui/waterCard.js';
import {DEFAULT_TAB, TABS, getTab, tabIndex} from './ui/tabs.js';
import {divider, label, layout} from './ui/helpers.js';

function animationsEnabled() {
    try {
        return St.Settings.get().enable_animations !== false;
    } catch {
        return true;
    }
}

export class Popup {
    constructor(app) {
        this._app = app;
        this._activeTab = null;
        this._pages = {};
        this._navButtons = {};

        this._sun = new HabitCard({
            key: 'sun',
            text: 'Sun',
            icon: 'weather-clear-symbolic',
            onToggle: () => app.toggleSun(),
        });
        this._walk = new HabitCard({
            key: 'walk',
            text: 'Walk',
            iconFile: 'study-walk-symbolic.svg',
            iconOnFile: 'study-walk-on-symbolic.svg',
            onToggle: () => app.toggleWalk(),
        });
        this._water = new WaterCard({onAdd: milliliters => app.addWater(milliliters)});
        this._heatmap = new HeatmapCard();
        this._details = new DetailsView();
        this._history = new HistoryView({
            onAddWater: (ms, milliliters) => app.addWaterForDay(ms, milliliters),
            onToggleHabit: (ms, key) => app.toggleDayHabit(ms, key),
        });
        this._pomodoro = new PomodoroCard({
            onToggle: () => app.toggleTimer(),
            onReset: () => app.resetTimer(),
            onMode: mode => app.selectMode(mode),
        });

        this._scoreDots = {};
        const dots = layout({spacing: 5, x_expand: false, y_align: Clutter.ActorAlign.CENTER});
        for (const key of ['water', 'sun', 'walk', 'focus']) {
            const dot = new St.Widget({
                style_class: `study-score-dot ${key}`,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this._scoreDots[key] = dot;
            dots.add_child(dot);
        }

        this._nav = this._buildNav();
        const header = layout({
            spacing: 8,
            x_expand: true,
            style_class: 'study-header',
        });
        header.add_child(this._nav);
        header.add_child(layout({x_expand: true}));
        header.add_child(dots);

        this.actor = layout({
            vertical: true,
            spacing: 0,
            x_expand: true,
        });
        this.actor.add_child(header);
        this.actor.add_child(divider(false));

        this._pages.today = this._buildMain();
        this._pages.details = this._details.actor;
        this._pages.history = this._history.actor;
        this._settings = new SettingsView({
            onAdjust: (key, delta) => app.adjustSetting(key, delta),
            onToggle: key => app.toggleSetting(key),
            onReset: () => app.resetSettings(),
            onDone: () => this.setTab('today'),
        });
        this._pages.settings = this._settings.actor;

        this._pageHost = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            clip_to_allocation: true,
            x_expand: true,
            style_class: 'study-page-host',
        });
        for (const tab of TABS) {
            const page = this._pages[tab.key];
            page.visible = false;
            page.x_expand = true;
            page.y_expand = true;
            this._pageHost.add_child(page);
        }
        this.actor.add_child(this._pageHost);
        this.setTab(DEFAULT_TAB, false);
    }

    get tab() {
        return this._activeTab ?? DEFAULT_TAB;
    }

    get detailsOpen() {
        return this.tab === 'details';
    }

    get historyOpen() {
        return this.tab === 'history';
    }

    get historySelectedKey() {
        return this._history.selectedKey;
    }

    get historyMonth() {
        return this._history.monthKey;
    }

    get settingsOpen() {
        return this.tab === 'settings';
    }

    _buildNav() {
        const nav = layout({spacing: 2, x_expand: false, style_class: 'study-nav'});
        for (const tab of TABS) {
            const content = layout({spacing: 5, x_align: Clutter.ActorAlign.CENTER});
            if (tab.key === 'today') {
                this._navTomato = createTomatoIcon({
                    size: 12,
                    styleClass: 'study-nav-icon',
                });
                content.add_child(this._navTomato);
            } else {
                content.add_child(new St.Icon({
                    icon_name: tab.icon,
                    icon_size: 11,
                    style_class: 'study-nav-icon',
                }));
            }
            content.add_child(label(tab.label, 'study-nav-label'));

            const button = new St.Button({
                style_class: 'study-nav-tab',
                can_focus: true,
                accessible_name: tab.label,
                child: content,
            });
            button.connect('clicked', () => this.setTab(tab.key));
            this._navButtons[tab.key] = button;
            nav.add_child(button);
        }
        return nav;
    }

    _buildMain() {
        const left = layout({
            vertical: true,
            spacing: 6,
            x_expand: false,
            style_class: 'study-pane-left',
        });
        left.add_child(this._sun.actor);
        left.add_child(this._walk.actor);
        left.add_child(this._water.actor);

        this._heatmap.actor.add_style_class_name('study-pane-heatmap');
        this._pomodoro.actor.add_style_class_name('study-pane-timer');

        const row = layout({spacing: 0, x_expand: true});
        row.add_child(left);
        row.add_child(divider(true));
        row.add_child(this._heatmap.actor);
        row.add_child(divider(true));
        row.add_child(this._pomodoro.actor);
        return row;
    }

    attach(menu) {
        menu.actor.add_style_class_name('study-popup');
        menu.setSourceAlignment(0.0);

        const section = new PopupMenu.PopupMenuSection();
        section.box.add_style_class_name('study-section');
        section.box.add_child(this.actor);
        menu.addMenuItem(section);

        menu.connect('open-state-changed', (source, open) => this.onOpenChanged(open));
    }

    onOpenChanged(open) {
        this._app.setPopupOpen(open);
        if (open) {
            this.update();
            this._water.startAnimation();
            this._app.setActiveTab(this.tab);
        } else {
            this._water.stopAnimation();
        }
    }

    setTab(key, animate = true) {
        const next = getTab(key);
        if (next.key === this._activeTab) {
            this._syncNav();
            return;
        }

        const previousKey = this._activeTab;
        const previousPage = previousKey ? this._pages[previousKey] : null;
        const nextPage = this._pages[next.key];
        const direction = previousKey
            ? (tabIndex(next.key) >= tabIndex(previousKey) ? 1 : -1)
            : 0;

        this._activeTab = next.key;
        this._syncNav();
        this._app.setActiveTab(next.key);

        if (next.key === 'settings')
            this._settings.update(this._app.state.settings);
        else if (next.key === 'history')
            this._history.update(this._app.state, this._app.now());

        if (previousKey)
            sound.play('click');

        this._transition(previousPage, nextPage, direction, animate);
    }

    _syncNav() {
        for (const tab of TABS) {
            this._navButtons[tab.key].set_style_class_name(
                `study-nav-tab${tab.key === this._activeTab ? ' active' : ''}`);
        }
        this._navTomato.opacity = this._activeTab === 'today' ? 255 : 150;
    }

    _transition(previousPage, nextPage, direction, animate) {
        for (const page of Object.values(this._pages)) {
            page.remove_all_transitions();
            if (page !== previousPage && page !== nextPage) {
                page.visible = false;
                page.opacity = 255;
                page.translation_x = 0;
            }
        }
        this._pageHost.set_child_above_sibling(nextPage, null);

        const shouldAnimate = animate && animationsEnabled();

        if (!previousPage || !shouldAnimate || previousPage === nextPage) {
            if (previousPage && previousPage !== nextPage) {
                previousPage.visible = false;
                previousPage.opacity = 255;
                previousPage.translation_x = 0;
            }
            nextPage.visible = true;
            nextPage.opacity = 255;
            nextPage.translation_x = 0;
            return;
        }

        nextPage.visible = true;
        nextPage.opacity = 0;
        nextPage.translation_x = direction * 18;
        nextPage.ease({
            opacity: 255,
            translation_x: 0,
            duration: 180,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        });

        previousPage.ease({
            opacity: 0,
            translation_x: -direction * 18,
            duration: 140,
            mode: Clutter.AnimationMode.EASE_IN_CUBIC,
            onComplete: () => {
                previousPage.visible = false;
                previousPage.opacity = 255;
                previousPage.translation_x = 0;
            },
        });
    }

    toggleTab(key) {
        this.setTab(this.tab === key ? 'today' : key);
    }

    toggleDetails() {
        this.toggleTab('details');
    }

    toggleHistory() {
        this.toggleTab('history');
    }

    selectHistoryDay(key) {
        this.setTab('history');
        this._history.selectKey(key);
    }

    toggleSettings() {
        this.toggleTab('settings');
    }

    update(state = this._app.state, now = this._app.now()) {
        const day = getDay(state, now);
        const {settings} = state;

        this._setDot('water', (day?.water ?? 0) >= settings.waterGoalMl);
        this._setDot('sun', Boolean(day?.sun));
        this._setDot('walk', Boolean(day?.walk));
        this._setDot('focus', (day?.focus ?? 0) >= 1);

        this._sun.update(day);
        this._walk.update(day);
        this._water.update(day, settings);
        this._heatmap.update(state, now);
        this._details.update(state, now);
        this._history.update(state, now);
        this._pomodoro.update(state.timers[state.viewMode], now, day);
        this._settings.update(settings);
    }

    _setDot(key, on) {
        this._scoreDots[key].set_style_class_name(
            `study-score-dot ${key}${on ? ' on' : ''}`);
    }

    destroy() {
        this._water.stopAnimation();
    }
}
