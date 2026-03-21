import { execSync } from 'child_process';

import { getCurrentBranch, checkoutCommit, restoreBranch } from '../../../git/checkout.js';

jest.mock('child_process', () => ({
	execSync: jest.fn(),
}));

jest.mock('../../../logger.js', () => ({
	log: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('checkout', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getCurrentBranch', () => {
		it('should return branch name when on a branch', async () => {
			mockExecSync.mockReturnValue('main\n');

			const result = await getCurrentBranch('/path/to/repo');

			expect(result).toBe('main');
			expect(mockExecSync).toHaveBeenCalledWith(
				'git rev-parse --abbrev-ref HEAD',
				expect.objectContaining({ cwd: '/path/to/repo' }),
			);
		});

		it('should return commit hash when in detached HEAD state', async () => {
			mockExecSync
				.mockReturnValueOnce('HEAD\n') // First call returns 'HEAD'
				.mockReturnValueOnce('abc123def456\n'); // Second call returns commit hash

			const result = await getCurrentBranch('/path/to/repo');

			expect(result).toBe('abc123def456');
			expect(mockExecSync).toHaveBeenCalledTimes(2);
		});

		it('should throw on git error', async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('fatal: not a git repository');
			});

			await expect(getCurrentBranch('/path/to/repo')).rejects.toThrow('not a git repository');
		});

		it('should trim whitespace from branch name', async () => {
			mockExecSync.mockReturnValue('  feature/test  \n');

			const result = await getCurrentBranch('/path/to/repo');

			expect(result).toBe('feature/test');
		});
	});

	describe('checkoutCommit', () => {
		it('should checkout the specified commit', async () => {
			mockExecSync.mockReturnValue('');

			await checkoutCommit('/path/to/repo', 'abc123');

			// Check that checkout command was called with --force and GIT_LFS_SKIP_SMUDGE
			expect(mockExecSync).toHaveBeenCalledWith(
				'git checkout --force --quiet --no-recurse-submodules abc123',
				expect.objectContaining({
					cwd: '/path/to/repo',
					env: expect.objectContaining({ GIT_LFS_SKIP_SMUDGE: '1' }),
				}),
			);
		});

		it('should throw on checkout error', async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('error: pathspec not found');
			});

			await expect(checkoutCommit('/path/to/repo', 'nonexistent')).rejects.toThrow('pathspec');
		});

		it('should handle full commit hashes', async () => {
			const fullHash = 'a'.repeat(40);

			mockExecSync.mockReturnValue('');

			await checkoutCommit('/path/to/repo', fullHash);

			expect(mockExecSync).toHaveBeenCalledWith(
				`git checkout --force --quiet --no-recurse-submodules ${fullHash}`,
				expect.objectContaining({
					env: expect.objectContaining({ GIT_LFS_SKIP_SMUDGE: '1' }),
				}),
			);
		});
	});

	describe('restoreBranch', () => {
		it('should checkout the specified branch', async () => {
			mockExecSync.mockReturnValue('');

			await restoreBranch('/path/to/repo', 'main');

			expect(mockExecSync).toHaveBeenCalledWith(
				'git checkout --force --quiet --no-recurse-submodules main',
				expect.objectContaining({
					cwd: '/path/to/repo',
					env: expect.objectContaining({ GIT_LFS_SKIP_SMUDGE: '1' }),
				}),
			);
		});

		it('should throw on restore error', async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('error: branch not found');
			});

			await expect(restoreBranch('/path/to/repo', 'nonexistent')).rejects.toThrow('branch not found');
		});

		it('should handle branch names with slashes', async () => {
			mockExecSync.mockReturnValue('');

			await restoreBranch('/path/to/repo', 'feature/my-branch');

			expect(mockExecSync).toHaveBeenCalledWith(
				'git checkout --force --quiet --no-recurse-submodules feature/my-branch',
				expect.objectContaining({
					env: expect.objectContaining({ GIT_LFS_SKIP_SMUDGE: '1' }),
				}),
			);
		});
	});
});
