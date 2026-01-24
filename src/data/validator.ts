import { ProgressData, DataPoint } from './schema.js';

/**
 * Проверяет монотонность времени (строго возрастает)
 */
export function isMonotonicallyIncreasing(points: DataPoint[]): boolean {
  for (let i = 1; i < points.length; i++) {
    if (points[i].time <= points[i - 1].time) {
      return false;
    }
  }
  return true;
}

/**
 * Проверяет уникальность timestamps
 */
export function hasUniqueTimes(points: DataPoint[]): boolean {
  const times = new Set(points.map(p => p.time));
  return times.size === points.length;
}

/**
 * Валидирует структуру ProgressData
 * @throws Error при невалидных данных
 */
export function validateProgressData(data: ProgressData): void {
  // 1. Проверка meta
  if (!data.meta) {
    throw new Error('Validation error: meta is missing');
  }

  const requiredMetaFields = ['sourceRepo', 'oldPath', 'newPath', 'generatedAt'] as const;
  for (const field of requiredMetaFields) {
    if (data.meta[field] === undefined || data.meta[field] === null) {
      throw new Error(`Validation error: meta.${field} is missing`);
    }
    if (typeof data.meta[field] !== 'string') {
      throw new Error(`Validation error: meta.${field} must be a string`);
    }
  }

  // 2. Проверка data — массив
  if (!Array.isArray(data.data)) {
    throw new Error('Validation error: data must be an array');
  }

  // 3. Проверка каждой точки
  for (let i = 0; i < data.data.length; i++) {
    const point = data.data[i];

    if (!Number.isInteger(point.time) || point.time <= 0) {
      throw new Error(`Validation error: data[${i}].time must be a positive integer`);
    }

    if (typeof point.oldSizeKB !== 'number' || point.oldSizeKB < 0) {
      throw new Error(`Validation error: data[${i}].oldSizeKB must be >= 0`);
    }

    if (typeof point.newSizeKB !== 'number' || point.newSizeKB < 0) {
      throw new Error(`Validation error: data[${i}].newSizeKB must be >= 0`);
    }

    if (typeof point.oldFiles !== 'number' || point.oldFiles < 0) {
      throw new Error(`Validation error: data[${i}].oldFiles must be >= 0`);
    }

    if (typeof point.newFiles !== 'number' || point.newFiles < 0) {
      throw new Error(`Validation error: data[${i}].newFiles must be >= 0`);
    }
  }

  // 4. Проверка сортировки (строго возрастает)
  if (!isMonotonicallyIncreasing(data.data)) {
    throw new Error('Validation error: data must be sorted by time in strictly increasing order');
  }

  // 5. Проверка уникальности timestamps
  if (!hasUniqueTimes(data.data)) {
    throw new Error('Validation error: duplicate timestamps found in data');
  }
}
