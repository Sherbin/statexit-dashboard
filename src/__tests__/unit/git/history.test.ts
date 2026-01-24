import { getCommitHistory } from '../../../git/history.js';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../../../logger.js', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCommitHistory', () => {
    it('should parse git log output correctly', async () => {
      mockExecSync.mockReturnValue(
        'abc123|1704067200\ndef456|1704153600\nghi789|1704240000\n'
      );

      const result = await getCommitHistory('/path/to/repo');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ hash: 'abc123', timestamp: 1704067200 });
      expect(result[1]).toEqual({ hash: 'def456', timestamp: 1704153600 });
      expect(result[2]).toEqual({ hash: 'ghi789', timestamp: 1704240000 });
    });

    it('should call git with correct arguments', async () => {
      mockExecSync.mockReturnValue('abc123|1704067200\n');

      await getCommitHistory('/path/to/repo');

      expect(mockExecSync).toHaveBeenCalledWith(
        'git log --reverse --format="%H|%ct"',
        expect.objectContaining({
          cwd: '/path/to/repo',
          encoding: 'utf-8',
        })
      );
    });

    it('should return empty array for empty output', async () => {
      mockExecSync.mockReturnValue('');

      const result = await getCommitHistory('/path/to/repo');

      expect(result).toEqual([]);
    });

    it('should handle single commit', async () => {
      mockExecSync.mockReturnValue('abc123|1704067200\n');

      const result = await getCommitHistory('/path/to/repo');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ hash: 'abc123', timestamp: 1704067200 });
    });

    it('should filter empty lines', async () => {
      mockExecSync.mockReturnValue('abc123|1704067200\n\n\ndef456|1704153600\n');

      const result = await getCommitHistory('/path/to/repo');

      expect(result).toHaveLength(2);
    });

    it('should throw on git error', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      await expect(getCommitHistory('/path/to/repo')).rejects.toThrow('not a git repository');
    });

    it('should handle full commit hashes', async () => {
      const fullHash = 'a'.repeat(40);
      mockExecSync.mockReturnValue(`${fullHash}|1704067200\n`);

      const result = await getCommitHistory('/path/to/repo');

      expect(result[0].hash).toBe(fullHash);
      expect(result[0].hash).toHaveLength(40);
    });
  });
});
