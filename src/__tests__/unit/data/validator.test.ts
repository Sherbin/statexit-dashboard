import { ProgressData, DataPoint } from '../../../data/schema.js';
import { validateProgressData, isMonotonicallyIncreasing, hasUniqueTimes } from '../../../data/validator.js';

const emptyGroups = { old: [], new: [] };

function dp(time: number, oldSizeKB: number, newSizeKB: number, oldFiles = 0, newFiles = 0): DataPoint {
	return { time, oldSizeKB, newSizeKB, oldFiles, newFiles, groups: emptyGroups };
}

describe('validator', () => {
	describe('isMonotonicallyIncreasing', () => {
		it('should return true for empty array', () => {
			expect(isMonotonicallyIncreasing([])).toBe(true);
		});

		it('should return true for single element', () => {
			expect(isMonotonicallyIncreasing([dp(100, 0, 0)])).toBe(true);
		});

		it('should return true for strictly increasing times', () => {
			const points: DataPoint[] = [dp(100, 10, 5), dp(200, 8, 7), dp(300, 6, 9)];

			expect(isMonotonicallyIncreasing(points)).toBe(true);
		});

		it('should return false for equal times', () => {
			const points: DataPoint[] = [dp(100, 10, 5), dp(100, 8, 7)];

			expect(isMonotonicallyIncreasing(points)).toBe(false);
		});

		it('should return false for decreasing times', () => {
			const points: DataPoint[] = [dp(200, 10, 5), dp(100, 8, 7)];

			expect(isMonotonicallyIncreasing(points)).toBe(false);
		});
	});

	describe('hasUniqueTimes', () => {
		it('should return true for empty array', () => {
			expect(hasUniqueTimes([])).toBe(true);
		});

		it('should return true for unique times', () => {
			const points: DataPoint[] = [dp(100, 10, 5), dp(200, 8, 7), dp(300, 6, 9)];

			expect(hasUniqueTimes(points)).toBe(true);
		});

		it('should return false for duplicate times', () => {
			const points: DataPoint[] = [dp(100, 10, 5), dp(200, 8, 7), dp(100, 6, 9)];

			expect(hasUniqueTimes(points)).toBe(false);
		});
	});

	describe('validateProgressData', () => {
		const validMeta = {
			sourceRepo: 'git@github.com:org/repo.git',
			oldPath: 'src/old',
			newPath: 'src/new',
			generatedAt: '2024-01-01T00:00:00.000Z',
			groups: emptyGroups,
		};

		it('should pass for valid empty data', () => {
			const data: ProgressData = { meta: validMeta, data: [] };

			expect(() => validateProgressData(data)).not.toThrow();
		});

		it('should pass for valid data with points', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [dp(1704067200, 100, 50), dp(1704153600, 90, 60)],
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
			const data = { meta: validMeta, data: 'not an array' } as unknown as ProgressData;

			expect(() => validateProgressData(data)).toThrow('data must be an array');
		});

		it('should throw if time is not a positive integer', () => {
			const data: ProgressData = { meta: validMeta, data: [dp(-1, 100, 50)] };

			expect(() => validateProgressData(data)).toThrow('data[0].time must be a positive integer');
		});

		it('should throw if time is zero', () => {
			const data: ProgressData = { meta: validMeta, data: [dp(0, 100, 50)] };

			expect(() => validateProgressData(data)).toThrow('data[0].time must be a positive integer');
		});

		it('should throw if old is negative', () => {
			const data: ProgressData = { meta: validMeta, data: [dp(1704067200, -1, 50)] };

			expect(() => validateProgressData(data)).toThrow('data[0].oldSizeKB must be >= 0');
		});

		it('should throw if new is negative', () => {
			const data: ProgressData = { meta: validMeta, data: [dp(1704067200, 100, -1)] };

			expect(() => validateProgressData(data)).toThrow('data[0].newSizeKB must be >= 0');
		});

		it('should throw if times are not sorted', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [dp(1704153600, 90, 60), dp(1704067200, 100, 50)],
			};

			expect(() => validateProgressData(data)).toThrow('sorted by time');
		});

		it('should throw if times are duplicated', () => {
			const data: ProgressData = {
				meta: validMeta,
				data: [dp(1704067200, 100, 50), dp(1704067200, 90, 60)],
			};

			expect(() => validateProgressData(data)).toThrow('sorted by time');
		});

		it('should allow zero values for old and new', () => {
			const data: ProgressData = { meta: validMeta, data: [dp(1704067200, 0, 0)] };

			expect(() => validateProgressData(data)).not.toThrow();
		});

		it('should validate group sums match totals', () => {
			const point: DataPoint = {
				time: 1704067200,
				oldSizeKB: 100,
				newSizeKB: 50,
				oldFiles: 10,
				newFiles: 5,
				groups: {
					old: [
						{ label: 'A', sizeKB: 60, files: 6 },
						{ label: 'B', sizeKB: 40, files: 4 },
					],
					new: [{ label: 'C', sizeKB: 50, files: 5 }],
				},
			};

			const data: ProgressData = { meta: validMeta, data: [point] };

			expect(() => validateProgressData(data)).not.toThrow();
		});

		it('should throw if group sizeKB sum does not match total', () => {
			const point: DataPoint = {
				time: 1704067200,
				oldSizeKB: 100,
				newSizeKB: 50,
				oldFiles: 10,
				newFiles: 5,
				groups: {
					old: [
						{ label: 'A', sizeKB: 60, files: 6 },
						{ label: 'B', sizeKB: 30, files: 4 }, // sum=90, not 100
					],
					new: [],
				},
			};

			const data: ProgressData = { meta: validMeta, data: [point] };

			expect(() => validateProgressData(data)).toThrow('groups.old sizeKB sum (90) != oldSizeKB (100)');
		});

		it('should throw if group files sum does not match total', () => {
			const point: DataPoint = {
				time: 1704067200,
				oldSizeKB: 100,
				newSizeKB: 50,
				oldFiles: 10,
				newFiles: 5,
				groups: {
					old: [
						{ label: 'A', sizeKB: 60, files: 6 },
						{ label: 'B', sizeKB: 40, files: 3 }, // sum=9, not 10
					],
					new: [],
				},
			};

			const data: ProgressData = { meta: validMeta, data: [point] };

			expect(() => validateProgressData(data)).toThrow('groups.old files sum (9) != oldFiles (10)');
		});
	});
});
