export const TABS = Object.freeze([
    {key: 'today', label: 'Today', icon: null},
    {key: 'details', label: 'Details', icon: 'view-list-symbolic'},
    {key: 'history', label: 'History', icon: 'x-office-calendar-symbolic'},
    {key: 'settings', label: 'Settings', icon: 'emblem-system-symbolic'},
]);

export const DEFAULT_TAB = TABS[0].key;

export function getTab(key) {
    return TABS.find(tab => tab.key === key) ?? TABS[0];
}

export function tabIndex(key) {
    const index = TABS.findIndex(tab => tab.key === key);
    return index < 0 ? 0 : index;
}
