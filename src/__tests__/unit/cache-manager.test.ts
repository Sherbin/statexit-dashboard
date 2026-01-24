import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
	getCachePath,
	loadCache,
	saveCache,
	validateCache,
	createCache,
	cacheToCommitInfo,
	commitExists,
	CacheData,
	CACHE_VERSION,
} from '../../cache/index.js';
import { CommitInfo } from '../../data/schema.js';

jest.mock('fs/promises');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = childProcess.execSync as jest.MockedFunction<typeof childProcess.execSync>;

describe('cache-manager', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getCachePath', () => {
		it('should return custom path when provided', () => {
			const result = getCachePath('/output/progress.json', '/custom/cache.json');

			expect(result).toBe(path.resolve('/custom/cache.json'));
		});

		it('should return default cache path next to output', () => {
			const result = getCachePath('/output/progress.json');

			expect(result).toBe(path.resolve('/output/.migration-cache.json'));
		});

		it('should handle relative output path', () => {
			const result = getCachePath('./docs/progress.json');

			expect(result).toContain('.migration-cache.json');
		});
	});

	describe('commitExists', () => {
		it('should return true when commit exists', () => {
			mockExecSync.mockReturnValue('commit');

			const result = commitExists('/repo', 'abc123');

			expect(result).toBe(true);
			expect(mockExecSync).toHaveBeenCalledWith(
				'git cat-file -t abc123',
				expect.objectContaining({ cwd: '/repo' }),
			);
		});

		it('should return false when commit does not exist', () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('Not a valid object name');
			});

			const result = commitExists('/repo', 'nonexistent');

			expect(result).toBe(false);
		});
	});

	describe('loadCache', () => {
		it('should return null when file does not exist', async () => {
			const err = new Error('ENOENT') as NodeJS.ErrnoException;

			err.code = 'ENOENT';
			mockFs.readFile.mockRejectedValue(err);

			const result = await loadCache('/path/cache.json');

			expect(result).toBeNull();
		});

		it('should return null when version mismatch', async () => {
			const oldCache: CacheData = {
				version: 999,
				migrationStartHash: 'abc123',
				migrationStartTimestamp: 1704067200,
				oldPath: 'old',
				newPath: 'new',
				createdAt: '2024-01-01T00:00:00.000Z',
			};

			mockFs.readFile.mockResolvedValue(JSON.stringify(oldCache));

			const result = await loadCache('/path/cache.json');

			expect(result).toBeNull();
		});

		it('should return cache data when valid', async () => {
			const validCache: CacheData = {
				version: CACHE_VERSION,
				migrationStartHash: 'abc123',
				migrationStartTimestamp: 1704067200,
				oldPath: 'old',
				newPath: 'new',
				createdAt: '2024-01-01T00:00:00.000Z',
			};

			mockFs.readFile.mockResolvedValue(JSON.stringify(validCache));

			const result = await loadCache('/path/cache.json');

			expect(result).toEqual(validCache);
		});

		it('should return null on parse error', async () => {
			mockFs.readFile.mockResolvedValue('invalid json');

			const result = await loadCache('/path/cache.json');

			expect(result).toBeNull();
		});
	});

	describe('saveCache', () => {
		it('should write cache to file', async () => {
			mockFs.mkdir.mockResolvedValue(undefined);
			mockFs.writeFile.mockResolvedValue(undefined);

			const cache: CacheData = {
				version: CACHE_VERSION,
				migrationStartHash: 'abc123',
				migrationStartTimestamp: 1704067200,
				oldPath: 'old',
				newPath: 'new',
				createdAt: '2024-01-01T00:00:00.000Z',
			};

			await saveCache('/path/cache.json', cache);

			expect(mockFs.mkdir).toHaveBeenCalledWith('/path', { recursive: true });
			expect(mockFs.writeFile).toHaveBeenCalledWith(
				'/path/cache.json',
				expect.stringContaining('migrationStartHash'),
				'utf-8',
			);
		});

		it('should not throw on write error', async () => {
			mockFs.mkdir.mockResolvedValue(undefined);
			mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

			const cache: CacheData = {
				version: CACHE_VERSION,
				migrationStartHash: 'abc123',
				migrationStartTimestamp: 1704067200,
				oldPath: 'old',
				newPath: 'new',
				createdAt: '2024-01-01T00:00:00.000Z',
			};

			await expect(saveCache('/path/cache.json', cache)).resolves.not.toThrow();
		});
	});

	describe('validateCache', () => {
		const validCache: CacheData = {
			version: CACHE_VERSION,
			migrationStartHash: 'abc123',
			migrationStartTimestamp: 1704067200,
			oldPath: 'old',
			newPath: 'new',
			createdAt: '2024-01-01T00:00:00.000Z',
		};

		it('should return true for valid cache', () => {
			mockExecSync.mockReturnValue('commit');

			const result = validateCache(validCache, '/repo', 'old', 'new');

			expect(result).toBe(true);
		});

		it('should return false when oldPath does not match', () => {
			const result = validateCache(validCache, '/repo', 'different', 'new');

			expect(result).toBe(false);
		});

		it('should return false when newPath does not match', () => {
			const result = validateCache(validCache, '/repo', 'old', 'different');

			expect(result).toBe(false);
		});

		it('should return false when commit no longer exists', () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('Not a valid object name');
			});

			const result = validateCache(validCache, '/repo', 'old', 'new');

			expect(result).toBe(false);
		});
	});

	describe('createCache', () => {
		it('should create cache from CommitInfo', () => {
			const migrationStart: CommitInfo = {
				hash: 'abc123',
				timestamp: 1704067200,
			};

			const result = createCache(migrationStart, 'old', 'new');

			expect(result).toEqual({
				version: CACHE_VERSION,
				migrationStartHash: 'abc123',
				migrationStartTimestamp: 1704067200,
				oldPath: 'old',
				newPath: 'new',
				createdAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
			});
		});
	});

	describe('cacheToCommitInfo', () => {
		it('should convert cache to CommitInfo', () => {
			const cache: CacheData = {
				version: CACHE_VERSION,
				migrationStartHash: 'abc123',
				migrationStartTimestamp: 1704067200,
				oldPath: 'old',
				newPath: 'new',
				createdAt: '2024-01-01T00:00:00.000Z',
			};

			const result = cacheToCommitInfo(cache);

			expect(result).toEqual({
				hash: 'abc123',
				timestamp: 1704067200,
			});
		});
	});
});
