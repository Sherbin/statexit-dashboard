import { ProgressData, DataPoint, MetaInfo } from './schema.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Загружает существующий progress.json
 * @returns ProgressData или null если файл не существует
 * @throws Error если файл существует но невалидный JSON
 */
export async function loadExistingData(outputPath: string): Promise<ProgressData | null> {
  try {
    const content = await fs.readFile(outputPath, 'utf-8');
    return JSON.parse(content) as ProgressData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to parse existing data: ${(error as Error).message}`);
  }
}

/**
 * Определяет последний timestamp в данных
 * @returns timestamp или 0 если данных нет
 */
export function getLastTimestamp(data: ProgressData | null): number {
  if (!data || !data.data || data.data.length === 0) {
    return 0;
  }
  return data.data[data.data.length - 1].time;
}

/**
 * Сливает новые данные с существующими
 * - Если force=true — возвращает только новые данные
 * - Иначе добавляет только точки с time > последнего существующего time
 * - Результат отсортирован по time
 */
export function mergeData(
  existing: ProgressData | null,
  newPoints: DataPoint[],
  meta: MetaInfo,
  force: boolean
): ProgressData {
  if (force || !existing) {
    const sortedPoints = [...newPoints].sort((a, b) => a.time - b.time);
    return {
      meta,
      data: sortedPoints
    };
  }

  const lastTime = getLastTimestamp(existing);
  const filteredNewPoints = newPoints.filter(p => p.time > lastTime);
  const mergedPoints = [...existing.data, ...filteredNewPoints];
  mergedPoints.sort((a, b) => a.time - b.time);

  return {
    meta,
    data: mergedPoints
  };
}

/**
 * Сохраняет данные в файл
 */
export async function saveData(outputPath: string, data: ProgressData): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}
