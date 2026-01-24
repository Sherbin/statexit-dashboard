import { validateProgressData, isMonotonicallyIncreasing, hasUniqueTimes } from '../../../data/validator.js';
import { ProgressData, DataPoint } from '../../../data/schema.js';

describe('validator', () => {
  describe('isMonotonicallyIncreasing', () => {
    it('should return true for empty array', () => {
      expect(isMonotonicallyIncreasing([])).toBe(true);
    });

    it('should return true for single element', () => {
      expect(isMonotonicallyIncreasing([{ time: 100, old: 0, new: 0 }])).toBe(true);
    });

    it('should return true for strictly increasing times', () => {
      const points: DataPoint[] = [
        { time: 100, old: 10, new: 5 },
        { time: 200, old: 8, new: 7 },
        { time: 300, old: 6, new: 9 },
      ];
      expect(isMonotonicallyIncreasing(points)).toBe(true);
    });

    it('should return false for equal times', () => {
      const points: DataPoint[] = [
        { time: 100, old: 10, new: 5 },
        { time: 100, old: 8, new: 7 },
      ];
      expect(isMonotonicallyIncreasing(points)).toBe(false);
    });

    it('should return false for decreasing times', () => {
      const points: DataPoint[] = [
        { time: 200, old: 10, new: 5 },
        { time: 100, old: 8, new: 7 },
      ];
      expect(isMonotonicallyIncreasing(points)).toBe(false);
    });
  });

  describe('hasUniqueTimes', () => {
    it('should return true for empty array', () => {
      expect(hasUniqueTimes([])).toBe(true);
    });

    it('should return true for unique times', () => {
      const points: DataPoint[] = [
        { time: 100, old: 10, new: 5 },
        { time: 200, old: 8, new: 7 },
        { time: 300, old: 6, new: 9 },
      ];
      expect(hasUniqueTimes(points)).toBe(true);
    });

    it('should return false for duplicate times', () => {
      const points: DataPoint[] = [
        { time: 100, old: 10, new: 5 },
        { time: 200, old: 8, new: 7 },
        { time: 100, old: 6, new: 9 },
      ];
      expect(hasUniqueTimes(points)).toBe(false);
    });
  });

  describe('validateProgressData', () => {
    const validMeta = {
      sourceRepo: 'git@github.com:org/repo.git',
      oldPath: 'src/old',
      newPath: 'src/new',
      generatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should pass for valid empty data', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [],
      };
      expect(() => validateProgressData(data)).not.toThrow();
    });

    it('should pass for valid data with points', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [
          { time: 1704067200, old: 100, new: 50 },
          { time: 1704153600, old: 90, new: 60 },
        ],
      };
      expect(() => validateProgressData(data)).not.toThrow();
    });

    it('should throw if meta is missing', () => {
      const data = { data: [] } as unknown as ProgressData;
      expect(() => validateProgressData(data)).toThrow('meta is missing');
    });

    it('should throw if meta.sourceRepo is missing', () => {
      const data: ProgressData = {
        meta: { ...validMeta, sourceRepo: undefined as unknown as string },
        data: [],
      };
      expect(() => validateProgressData(data)).toThrow('meta.sourceRepo is missing');
    });

    it('should throw if meta.oldPath is missing', () => {
      const data: ProgressData = {
        meta: { ...validMeta, oldPath: undefined as unknown as string },
        data: [],
      };
      expect(() => validateProgressData(data)).toThrow('meta.oldPath is missing');
    });

    it('should throw if meta.newPath is missing', () => {
      const data: ProgressData = {
        meta: { ...validMeta, newPath: undefined as unknown as string },
        data: [],
      };
      expect(() => validateProgressData(data)).toThrow('meta.newPath is missing');
    });

    it('should throw if meta.generatedAt is missing', () => {
      const data: ProgressData = {
        meta: { ...validMeta, generatedAt: undefined as unknown as string },
        data: [],
      };
      expect(() => validateProgressData(data)).toThrow('meta.generatedAt is missing');
    });

    it('should throw if data is not an array', () => {
      const data = {
        meta: validMeta,
        data: 'not an array',
      } as unknown as ProgressData;
      expect(() => validateProgressData(data)).toThrow('data must be an array');
    });

    it('should throw if time is not a positive integer', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [{ time: -1, old: 100, new: 50 }],
      };
      expect(() => validateProgressData(data)).toThrow('data[0].time must be a positive integer');
    });

    it('should throw if time is zero', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [{ time: 0, old: 100, new: 50 }],
      };
      expect(() => validateProgressData(data)).toThrow('data[0].time must be a positive integer');
    });

    it('should throw if old is negative', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [{ time: 1704067200, old: -1, new: 50 }],
      };
      expect(() => validateProgressData(data)).toThrow('data[0].old must be >= 0');
    });

    it('should throw if new is negative', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [{ time: 1704067200, old: 100, new: -1 }],
      };
      expect(() => validateProgressData(data)).toThrow('data[0].new must be >= 0');
    });

    it('should throw if times are not sorted', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [
          { time: 1704153600, old: 90, new: 60 },
          { time: 1704067200, old: 100, new: 50 },
        ],
      };
      expect(() => validateProgressData(data)).toThrow('sorted by time');
    });

    it('should throw if times are duplicated', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [
          { time: 1704067200, old: 100, new: 50 },
          { time: 1704067200, old: 90, new: 60 },
        ],
      };
      // Duplicates are caught by monotonicity check first (equal times fail strict increase)
      expect(() => validateProgressData(data)).toThrow('sorted by time');
    });

    it('should allow zero values for old and new', () => {
      const data: ProgressData = {
        meta: validMeta,
        data: [{ time: 1704067200, old: 0, new: 0 }],
      };
      expect(() => validateProgressData(data)).not.toThrow();
    });
  });
});
