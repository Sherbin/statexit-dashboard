import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Известные текстовые расширения файлов
 */
export const TEXT_EXTENSIONS: Set<string> = new Set([
  // JavaScript/TypeScript
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  // Config
  '.json', '.yaml', '.yml', '.toml',
  // Docs/Markup
  '.md', '.txt', '.html', '.css', '.scss', '.less',
  '.xml', '.svg', '.sh', '.bash', '.zsh',
  // Languages
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  // Data/Schema
  '.sql', '.graphql', '.proto',
  // Dotfiles
  '.env', '.gitignore', '.dockerignore',
  '.editorconfig', '.prettierrc', '.eslintrc',
]);

/**
 * Проверяет, является ли файл текстовым
 * Критерии:
 * - Нет null-байтов в первых 8000 байтах файла
 * - ИЛИ расширение из списка известных текстовых
 */
export async function isTextFile(filePath: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase();
  
  // Известное текстовое расширение
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }

  // Проверка на null-байты в первых 8000 байтах
  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(8000);
      const { bytesRead } = await handle.read(buffer, 0, 8000, 0);
      
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return false;
        }
      }
      return true;
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}
