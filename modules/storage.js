export class StorageManager {
    constructor() {
        this.pogemonCollectionKey = 'pogemon-collection';
        this.wordStatsKey = 'pogemon-word-stats';
        this.streakKey = 'pogemon-streak';
    }

    loadCollection() {
        const savedCollection = localStorage.getItem(this.pogemonCollectionKey);
        if (savedCollection) {
            try {
                return JSON.parse(savedCollection);
            } catch (e) {
                console.error("Error loading collection from local storage:", e);
                localStorage.removeItem(this.pogemonCollectionKey);
                return [];
            }
        }
        return [];
    }

    saveCollection(collection) {
        try {
            localStorage.setItem(this.pogemonCollectionKey, JSON.stringify(collection));
        } catch (e) {
            console.error("Error saving collection to local storage:", e);
        }
    }

    loadWordStats() {
        const savedStats = localStorage.getItem(this.wordStatsKey);
        if (savedStats) {
            try {
                return JSON.parse(savedStats);
            } catch (e) {
                console.error("Error loading word stats from local storage:", e);
                localStorage.removeItem(this.wordStatsKey);
                return {};
            }
        }
        return {};
    }

    saveWordStats(wordStats) {
        try {
            localStorage.setItem(this.wordStatsKey, JSON.stringify(wordStats));
        } catch (e) {
            console.error("Error saving word stats to local storage:", e);
        }
    }

    loadStreak() {
        const savedData = localStorage.getItem(this.streakKey);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                // Check for old format: { highest: number } and reset if found
                if (parsedData && typeof parsedData.highest === 'number') {
                    localStorage.removeItem(this.streakKey);
                    return {};
                } else {
                    return parsedData || {};
                }
            } catch (e) {
                console.error("Error loading streaks:", e);
                return {};
            }
        }
        return {};
    }

    saveStreak(streaks) {
        try {
            localStorage.setItem(this.streakKey, JSON.stringify(streaks));
        } catch (e) {
            console.error("Error saving streaks:", e);
        }
    }
}

