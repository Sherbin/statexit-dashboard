import { ProgressData, DataPoint } from '../../../data/schema.js';
import { validateProgressData, isMonotonicallyIncreasing, hasUniqueTimes } from '../../../data/validator.js';

describe('validator', () => {
	describe('isMonotonicallyIncreasing', () => {
		it('should return true for empty array', () => {
			expect(isMonotonicallyIncreasing([])).toBe(true);
		});

		it('should return true for single element', () => {
			expect(
				isMonotonicallyIncreasing([{ time: 100, oldSizeKB: 0, newSizeKB: 0, oldFiles: 0, newFiles: 0 }]),
			).toBe(true);
		});

		it('should return true for strictly increasing times', () => {
			const points: DataPoint[] = [
				{ time: 100, oldSizeKB: 10, newSizeKB: 5, oldFiles: 0, newFiles: 0 },
				{ time: 200, oldSizeKB: 8, newSizeKB: 7, oldFiles: 0, newFiles: 0 },
				{ time: 300, oldSizeKB: 6, newSizeKB: 9, oldFiles: 0, newFiles: 0 },
			];

			expect(isMonotonicallyIncreasing(points)).toBe(true);
		});

		it('should return false for equal times', () => {
			const points: DataPoint[] = [
				{ time: 100, oldSizeKB: 10, newSizeKB: 5, oldFiles: 0, newFiles: 0 },
				{ time: 100, oldSizeKB: 8, newSizeKB: 7, oldFiles: 0, newFiles: 0 },
			];

			expect(isMonotonicallyIncreasing(points)).toBe(false);
		});

		it('should return false for decreasing times', () => {
			const points: DataPoint[] = [
				{ time: 200, oldSizeKB: 10, newSizeKB: 5, oldFiles: 0, newFiles: 0 },
				{ time: 100, oldSizeKB: 8, newSizeKB: 7, oldFiles: 0, newFiles: 0 },
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
				{ time: 100, oldSizeKB: 10, newSizeKB: 5, oldFiles: 0, newFiles: 0 },
				{ time: 200, oldSizeKB: 8, newSizeKB: 7, oldFiles: 0, newFiles: 0 },
				{ time: 300, oldSizeKB: 6, newSizeKB: 9, oldFiles: 0, newFiles: 0 },
			];

			expect(hasUniqueTimes(points)).toBe(true);
		});

		it('should return false for duplicate times', () => {
			const points: DataPoint[] = [
				{ time: 100, oldSizeKB: 10, newSizeKB: 5, oldFiles: 0, newFiles: 0 },
				{ time: 200, oldSizeKB: 8, newSizeKB: 7, oldFiles: 0, newFiles: 0 },
				{ time: 100, oldSizeKB: 6, newSizeKB: 9, oldFiles: 0, newFiles: 0 },
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
					{ time: 1704067200, oldSizeKB: 100, newSizeKB: 50, oldFiles: 0, newFiles: 0 },
					{ time: 1704153600, oldSizeKB: 90, newSizeKB: 60, oldFiles: 0, newFiles: 0 },
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
				data: [{ time: -1, oldSizeKB: 100, newSizeKB: 50, oldFiles: 0, newFiles: 0 }],
			};

			expect(() => validateProgressData(data)).toThrow('data[0].time must be a positive integer');
		});

		it('should throw if time is zero', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [{ time: 0, oldSizeKB: 100, newSizeKB: 50, oldFiles: 0, newFiles: 0 }],
			};

			expect(() => validateProgressData(data)).toThrow('data[0].time must be a positive integer');
		});

		it('should throw if old is negative', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [{ time: 1704067200, oldSizeKB: -1, newSizeKB: 50, oldFiles: 0, newFiles: 0 }],
			};

			expect(() => validateProgressData(data)).toThrow('data[0].oldSizeKB must be >= 0');
		});

		it('should throw if new is negative', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [{ time: 1704067200, oldSizeKB: 100, newSizeKB: -1, oldFiles: 0, newFiles: 0 }],
			};

			expect(() => validateProgressData(data)).toThrow('data[0].newSizeKB must be >= 0');
		});

		it('should throw if times are not sorted', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [
					{ time: 1704153600, oldSizeKB: 90, newSizeKB: 60, oldFiles: 0, newFiles: 0 },
					{ time: 1704067200, oldSizeKB: 100, newSizeKB: 50, oldFiles: 0, newFiles: 0 },
				],
			};

			expect(() => validateProgressData(data)).toThrow('sorted by time');
		});

		it('should throw if times are duplicated', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [
					{ time: 1704067200, oldSizeKB: 100, newSizeKB: 50, oldFiles: 0, newFiles: 0 },
					{ time: 1704067200, oldSizeKB: 90, newSizeKB: 60, oldFiles: 0, newFiles: 0 },
				],
			};

			// Duplicates are caught by monotonicity check first (equal times fail strict increase)
			expect(() => validateProgressData(data)).toThrow('sorted by time');
		});

		it('should allow zero values for old and new', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [{ time: 1704067200, oldSizeKB: 0, newSizeKB: 0, oldFiles: 0, newFiles: 0 }],
			};

			expect(() => validateProgressData(data)).not.toThrow();
		});
	});
});
