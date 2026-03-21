import { execSync } from 'child_process';

import { hasFileChanged, hasUncommittedChanges } from '../../../git-ops/diff-check.js';

jest.mock('child_process', () => ({
	execSync: jest.fn(),
}));

jest.mock('../../../logger.js', () => ({
	log: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('diff-check', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('hasFileChanged', () => {
		it('should return false when file has no changes (exit 0)', async () => {
			mockExecSync.mockReturnValue('');

			const result = await hasFileChanged('/path/to/repo/file.json');

			expect(result).toBe(false);
		});

		it('should return true when file has changes (exit 1)', async () => {
			const error = new Error('exit 1') as Error & { status: number };

			error.status = 1;
			mockExecSync.mockImplementation(() => {
				throw error;
			});

			const result = await hasFileChanged('/path/to/repo/file.json');

			expect(result).toBe(true);
		});

		it('should call git diff with correct file path', async () => {
			mockExecSync.mockReturnValue('');

			await hasFileChanged('/path/to/repo/progress.json');

			expect(mockExecSync).toHaveBeenCalledWith(
				'git diff --quiet "progress.json"',
				expect.objectContaining({ cwd: '/path/to/repo' }),
			);
		});

		it('should throw on other git errors', async () => {
			const error = new Error('fatal: not a git repository') as Error & { status: number };

			error.status = 128;
			mockExecSync.mockImplementation(() => {
				throw error;
			});

			await expect(hasFileChanged('/path/to/file.json')).rejects.toThrow('Git diff failed');
		});
	});

	describe('hasUncommittedChanges', () => {
		it('should return false when no uncommitted changes (exit 0)', async () => {
			mockExecSync.mockReturnValue('');

			const result = await hasUncommittedChanges('/path/to/repo');

			expect(result).toBe(false);
		});

		it('should return true when uncommitted changes exist (exit 1)', async () => {
			const error = new Error('exit 1') as Error & { status: number };

			error.status = 1;
			mockExecSync.mockImplementation(() => {
				throw error;
			});

			const result = await hasUncommittedChanges('/path/to/repo');

			expect(result).toBe(true);
		});

		it('should call git diff HEAD', async () => {
			mockExecSync.mockReturnValue('');

			await hasUncommittedChanges('/path/to/repo');

			expect(mockExecSync).toHaveBeenCalledWith(
				'git diff --quiet HEAD',
				expect.objectContaining({ cwd: '/path/to/repo' }),
			);
		});

		it('should throw on other git errors', async () => {
			const error = new Error('fatal error') as Error & { status: number };

			error.status = 128;
			mockExecSync.mockImplementation(() => {
				throw error;
			});

			await expect(hasUncommittedChanges('/path/to/repo')).rejects.toThrow('Git diff failed');
		});
	});
});
