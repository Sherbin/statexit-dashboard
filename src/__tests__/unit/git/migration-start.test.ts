import { execSync } from 'child_process';

import { findFirstAppearance, findMigrationStart } from '../../../git/migration-start.js';

jest.mock('child_process', () => ({
	execSync: jest.fn(),
}));

jest.mock('../../../logger.js', () => ({
	log: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('migration-start', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('findFirstAppearance', () => {
		it('should return first commit where folder appeared', async () => {
			mockExecSync.mockReturnValue('abc123|1704067200\ndef456|1704153600\n');

			const result = await findFirstAppearance('/path/to/repo', 'src/folder');

			expect(result).toEqual({ hash: 'abc123', timestamp: 1704067200 });
		});

		it('should call git with correct diff-filter', async () => {
			mockExecSync.mockReturnValue('abc123|1704067200\n');

			await findFirstAppearance('/path/to/repo', 'src/folder');

			expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--diff-filter=A'), expect.anything());
			expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('-- "src/folder"'), expect.anything());
		});

		it('should return null when folder never existed', async () => {
			mockExecSync.mockReturnValue('');

			const result = await findFirstAppearance('/path/to/repo', 'nonexistent');

			expect(result).toBeNull();
		});

		it('should use --reverse to get first commit', async () => {
			mockExecSync.mockReturnValue('first|1704067200\nlast|1704153600\n');

			await findFirstAppearance('/path/to/repo', 'src/folder');

			expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--reverse'), expect.anything());
		});

		it('should throw on git error', async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('fatal: not a git repository');
			});

			await expect(findFirstAppearance('/path/to/repo', 'folder')).rejects.toThrow();
		});
	});

	describe('findMigrationStart', () => {
		it('should return the later of two folder appearances', async () => {
			// old folder appeared first
			mockExecSync
				.mockReturnValueOnce('old123|1704067200\n') // old folder at day 1
				.mockReturnValueOnce('new456|1704153600\n'); // new folder at day 2

			const result = await findMigrationStart('/path/to/repo', 'src/old', 'src/new');

			expect(result).toEqual({ hash: 'new456', timestamp: 1704153600 });
		});

		it('should return old folder commit when it appeared later', async () => {
			// new folder appeared first
			mockExecSync
				.mockReturnValueOnce('old123|1704153600\n') // old folder at day 2
				.mockReturnValueOnce('new456|1704067200\n'); // new folder at day 1

			const result = await findMigrationStart('/path/to/repo', 'src/old', 'src/new');

			expect(result).toEqual({ hash: 'old123', timestamp: 1704153600 });
		});

		it('should throw if old folder never existed', async () => {
			mockExecSync
				.mockReturnValueOnce('') // old folder not found
				.mockReturnValueOnce('new456|1704067200\n'); // new folder exists

			await expect(findMigrationStart('/path/to/repo', 'src/old', 'src/new')).rejects.toThrow(
				'Old path "src/old" was never found',
			);
		});

		it('should throw if new folder never existed', async () => {
			mockExecSync
				.mockReturnValueOnce('old123|1704067200\n') // old folder exists
				.mockReturnValueOnce(''); // new folder not found

			await expect(findMigrationStart('/path/to/repo', 'src/old', 'src/new')).rejects.toThrow(
				'New path "src/new" was never found',
			);
		});

		it('should throw if both folders never existed', async () => {
			mockExecSync
				.mockReturnValueOnce('') // old not found
				.mockReturnValueOnce(''); // new not found

			await expect(findMigrationStart('/path/to/repo', 'src/old', 'src/new')).rejects.toThrow('Old path');
		});

		it('should handle equal timestamps (same commit)', async () => {
			mockExecSync.mockReturnValueOnce('same123|1704067200\n').mockReturnValueOnce('same123|1704067200\n');

			const result = await findMigrationStart('/path/to/repo', 'src/old', 'src/new');

			// When equal, returns old (first checked)
			expect(result.timestamp).toBe(1704067200);
		});
	});
});
