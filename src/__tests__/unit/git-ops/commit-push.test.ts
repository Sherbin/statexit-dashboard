import { commitAndPush, commitIfChanged } from '../../../git-ops/commit-push.js';
import { execSync } from 'child_process';
import * as diffCheck from '../../../git-ops/diff-check.js';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../../../logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../../../git-ops/diff-check.js', () => ({
  hasFileChanged: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockHasFileChanged = diffCheck.hasFileChanged as jest.MockedFunction<typeof diffCheck.hasFileChanged>;

describe('commit-push', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('commitAndPush', () => {
    it('should execute git add, commit, and push', async () => {
      mockExecSync.mockReturnValue('');

      await commitAndPush('/path/to/repo/file.json', 'Update data');

      expect(mockExecSync).toHaveBeenCalledTimes(3);
      expect(mockExecSync).toHaveBeenNthCalledWith(
        1,
        'git add "file.json"',
        expect.objectContaining({ cwd: '/path/to/repo' })
      );
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        'git commit --quiet -m "Update data"',
        expect.objectContaining({ cwd: '/path/to/repo' })
      );
      expect(mockExecSync).toHaveBeenNthCalledWith(
        3,
        'git push --quiet',
        expect.objectContaining({ cwd: '/path/to/repo' })
      );
    });

    it('should escape quotes in commit message', async () => {
      mockExecSync.mockReturnValue('');

      await commitAndPush('/path/to/repo/file.json', 'Message with "quotes"');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('\\"quotes\\"'),
        expect.anything()
      );
    });

    it('should throw on git add failure', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: pathspec not found');
      });

      await expect(commitAndPush('/path/to/repo/file.json', 'msg')).rejects.toThrow('Git commit/push failed');
    });

    it('should throw on git commit failure', async () => {
      mockExecSync
        .mockReturnValueOnce('') // add succeeds
        .mockImplementation(() => {
          throw new Error('nothing to commit');
        });

      await expect(commitAndPush('/path/to/repo/file.json', 'msg')).rejects.toThrow('Git commit/push failed');
    });

    it('should throw on git push failure', async () => {
      mockExecSync
        .mockReturnValueOnce('') // add succeeds
        .mockReturnValueOnce('') // commit succeeds
        .mockImplementation(() => {
          throw new Error('push rejected');
        });

      await expect(commitAndPush('/path/to/repo/file.json', 'msg')).rejects.toThrow('Git commit/push failed');
    });
  });

  describe('commitIfChanged', () => {
    it('should return false and skip commit when no changes', async () => {
      mockHasFileChanged.mockResolvedValue(false);

      const result = await commitIfChanged('/path/to/repo/file.json', 'msg');

      expect(result).toBe(false);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should commit and return true when changes detected', async () => {
      mockHasFileChanged.mockResolvedValue(true);
      mockExecSync.mockReturnValue('');

      const result = await commitIfChanged('/path/to/repo/file.json', 'Update');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledTimes(3); // add, commit, push
    });

    it('should check for changes before committing', async () => {
      mockHasFileChanged.mockResolvedValue(false);

      await commitIfChanged('/path/to/repo/file.json', 'msg');

      expect(mockHasFileChanged).toHaveBeenCalledWith('/path/to/repo/file.json');
    });
  });
});
