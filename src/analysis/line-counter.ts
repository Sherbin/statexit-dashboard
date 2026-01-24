import * as fs from 'fs/promises';
import * as path from 'path';
import { isTextFile } from './text-detector.js';

/**
 * Список папок для игнорирования
 */
export const IGNORED_DIRS: Set<string> = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  '.DS_Store',
]);

/**
 * Рекурсивно подсчитывает непустые строки во всех текстовых файлах папки
 * 
 * @param folderPath - абсолютный путь к папке
 * @returns количество непустых строк (0 если папка не существует)
 */
export async function countLines(folderPath: string): Promise<number> {
  try {
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) {
      return 0;
    }
  } catch {
    return 0;
  }

  let totalLines = 0;

  async function processDirectory(dirPath: string): Promise<void> {
    let entries: import('fs').Dirent[];
    
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (err) {
      console.error(`Error reading directory ${dirPath}:`, err);
      return;
    }

    for (const entry of entries) {
      const entryName = String(entry.name);
      const fullPath = path.join(dirPath, entryName);

      if (IGNORED_DIRS.has(entryName)) {
        continue;
      }

      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else if (entry.isFile()) {
        const isText = await isTextFile(fullPath);
        if (!isText) {
          continue;
        }

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          const nonEmptyLines = lines.filter(line => line.trim().length > 0);
          totalLines += nonEmptyLines.length;
        } catch (err) {
          console.error(`Error reading file ${fullPath}:`, err);
        }
      }
    }
  }

  await processDirectory(folderPath);
  return totalLines;
}
