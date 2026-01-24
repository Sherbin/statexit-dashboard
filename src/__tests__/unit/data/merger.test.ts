import { mergeData, getLastTimestamp, loadExistingData, saveData } from '../../../data/merger.js';
import { ProgressData, DataPoint, MetaInfo } from '../../../data/schema.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('merger', () => {
  const validMeta: MetaInfo = {
    sourceRepo: 'git@github.com:org/repo.git',
    oldPath: 'src/old',
    newPath: 'src/new',
    generatedAt: '2024-01-01T00:00:00.000Z',
  };

  describe('getLastTimestamp', () => {
    it('should return 0 for null data', () => {
      expect(getLastTimestamp(null)).toBe(0);
    });

    it('should return 0 for empty data array', () => {
      const data: ProgressData = { meta: validMeta, data: [] };
      expect(getLastTimestamp(data)).toBe(0);
    });

    it('should return last timestamp', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [
          { time: 1704067200, old: 100, new: 50 },
          { time: 1704153600, old: 90, new: 60 },
          { time: 1704240000, old: 80, new: 70 },
        ],
      };
      expect(getLastTimestamp(data)).toBe(1704240000);
    });
  });

  describe('mergeData', () => {
    it('should return new points when existing is null', () => {
      const newPoints: DataPoint[] = [
        { time: 1704067200, old: 100, new: 50 },
        { time: 1704153600, old: 90, new: 60 },
      ];

      const result = mergeData(null, newPoints, validMeta, false);

      expect(result.meta).toEqual(validMeta);
      expect(result.data).toEqual(newPoints);
    });

    it('should return only new points when force=true', () => {
      const existing: ProgressData = {
        meta: validMeta,
        data: [{ time: 1704067200, old: 100, new: 50 }],
      };
      const newPoints: DataPoint[] = [
        { time: 1704153600, old: 90, new: 60 },
      ];

      const result = mergeData(existing, newPoints, validMeta, true);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].time).toBe(1704153600);
    });

    it('should merge new points after existing data', () => {
      const existing: ProgressData = {
        meta: validMeta,
        data: [
          { time: 1704067200, old: 100, new: 50 },
          { time: 1704153600, old: 90, new: 60 },
        ],
      };
      const newPoints: DataPoint[] = [
        { time: 1704240000, old: 80, new: 70 },
        { time: 1704326400, old: 70, new: 80 },
      ];

      const result = mergeData(existing, newPoints, validMeta, false);

      expect(result.data).toHaveLength(4);
      expect(result.data[2].time).toBe(1704240000);
      expect(result.data[3].time).toBe(1704326400);
    });

    it('should filter out new points that are not after last existing', () => {
      const existing: ProgressData = {
        meta: validMeta,
        data: [
          { time: 1704067200, old: 100, new: 50 },
          { time: 1704153600, old: 90, new: 60 },
        ],
      };
      const newPoints: DataPoint[] = [
        { time: 1704067200, old: 100, new: 50 }, // same as existing
        { time: 1704153600, old: 90, new: 60 },  // same as existing
        { time: 1704240000, old: 80, new: 70 },  // new
      ];

      const result = mergeData(existing, newPoints, validMeta, false);

      expect(result.data).toHaveLength(3);
      expect(result.data[2].time).toBe(1704240000);
    });

    it('should sort merged data by time', () => {
      const existing: ProgressData = {
        meta: validMeta,
        data: [{ time: 1704153600, old: 90, new: 60 }],
      };
      const newPoints: DataPoint[] = [
        { time: 1704326400, old: 70, new: 80 },
        { time: 1704240000, old: 80, new: 70 },
      ];

      const result = mergeData(existing, newPoints, validMeta, false);

      expect(result.data[0].time).toBe(1704153600);
      expect(result.data[1].time).toBe(1704240000);
      expect(result.data[2].time).toBe(1704326400);
    });

    it('should use new meta', () => {
      const oldMeta: MetaInfo = { ...validMeta, generatedAt: '2024-01-01T00:00:00.000Z' };
      const newMeta: MetaInfo = { ...validMeta, generatedAt: '2024-01-02T00:00:00.000Z' };
      
      const existing: ProgressData = {
        meta: oldMeta,
        data: [{ time: 1704067200, old: 100, new: 50 }],
      };

      const result = mergeData(existing, [], newMeta, false);

      expect(result.meta.generatedAt).toBe('2024-01-02T00:00:00.000Z');
    });
  });

  describe('loadExistingData and saveData', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'merger-test-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should return null for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.json');
      const result = await loadExistingData(filePath);
      expect(result).toBeNull();
    });

    it('should load existing valid JSON', async () => {
      const filePath = path.join(tempDir, 'progress.json');
      const data: ProgressData = {
        meta: validMeta,
        data: [{ time: 1704067200, old: 100, new: 50 }],
      };
      await fs.writeFile(filePath, JSON.stringify(data), 'utf-8');

      const result = await loadExistingData(filePath);

      expect(result).toEqual(data);
    });

    it('should throw for invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(filePath, 'not valid json', 'utf-8');

      await expect(loadExistingData(filePath)).rejects.toThrow('Failed to parse');
    });

    it('should save data with proper formatting', async () => {
      const filePath = path.join(tempDir, 'output.json');
      const data: ProgressData = {
        meta: validMeta,
        data: [{ time: 1704067200, old: 100, new: 50 }],
      };

      await saveData(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('\n'); // Should be formatted
      expect(JSON.parse(content)).toEqual(data);
    });

    it('should create parent directories if needed', async () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'output.json');
      const data: ProgressData = { meta: validMeta, data: [] };

      await saveData(filePath, data);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual(data);
    });
  });
});
