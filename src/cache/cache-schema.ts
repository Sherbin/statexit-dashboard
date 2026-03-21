export interface CacheData {
	version: number;
	migrationStartHash: string;
	migrationStartTimestamp: number;
	oldPath: string;
	newPath: string;
	createdAt: string;
}

export const CACHE_VERSION = 1;
