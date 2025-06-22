import Store from 'electron-store';

const store = new Store();
const MAX_RECENT = 6;

export function getRecentPaths() {
    return store.get('recentPaths', []);
}

export function addRecentPath(newPath) {
    let paths = getRecentPaths();
    paths = [newPath, ...paths.filter(p => p !== newPath)];
    if (paths.length > MAX_RECENT) paths = paths.slice(0, MAX_RECENT);
    store.set('recentPaths', paths);
}

export function clearRecentPaths() {
    store.set('recentPaths', []);
}
