import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {StudyTracker} from './src/app.js';

export default class StudyTrackerExtension extends Extension {
    enable() {
        this._tracker = new StudyTracker();
        this._tracker.enable();
    }

    disable() {
        this._tracker?.disable();
        this._tracker = null;
    }
}
