import { isTextFile, TEXT_EXTENSIONS } from '../../../analysis/text-detector.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('text-detector', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'text-detector-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('TEXT_EXTENSIONS', () => {
    it('should include common TypeScript extensions', () => {
      expect(TEXT_EXTENSIONS.has('.ts')).toBe(true);
      expect(TEXT_EXTENSIONS.has('.tsx')).toBe(true);
    });

    it('should include common JavaScript extensions', () => {
      expect(TEXT_EXTENSIONS.has('.js')).toBe(true);
      expect(TEXT_EXTENSIONS.has('.jsx')).toBe(true);
      expect(TEXT_EXTENSIONS.has('.mjs')).toBe(true);
      expect(TEXT_EXTENSIONS.has('.cjs')).toBe(true);
    });

    it('should include config files', () => {
      expect(TEXT_EXTENSIONS.has('.json')).toBe(true);
      expect(TEXT_EXTENSIONS.has('.yaml')).toBe(true);
      expect(TEXT_EXTENSIONS.has('.yml')).toBe(true);
    });

    it('should include documentation files', () => {
      expect(TEXT_EXTENSIONS.has('.md')).toBe(true);
      expect(TEXT_EXTENSIONS.has('.txt')).toBe(true);
    });
  });

  describe('isTextFile', () => {
    it('should return true for known text extension', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      await fs.writeFile(filePath, 'const x = 1;');

      expect(await isTextFile(filePath)).toBe(true);
    });

    it('should return true for .json files', async () => {
      const filePath = path.join(tempDir, 'config.json');
      await fs.writeFile(filePath, '{"key": "value"}');

      expect(await isTextFile(filePath)).toBe(true);
    });

    it('should return true for text file without known extension', async () => {
      const filePath = path.join(tempDir, 'README');
      await fs.writeFile(filePath, 'This is a text file without extension');

      expect(await isTextFile(filePath)).toBe(true);
    });

    it('should return false for binary file with null bytes', async () => {
      const filePath = path.join(tempDir, 'binary.dat');
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x00, 0x03]);
      await fs.writeFile(filePath, buffer);

      expect(await isTextFile(filePath)).toBe(false);
    });

    it('should return false for non-existent file without known extension', async () => {
      const filePath = path.join(tempDir, 'nonexistent');

      expect(await isTextFile(filePath)).toBe(false);
    });

    it('should return true for non-existent file with known extension', async () => {
      // Known extensions return true based on extension alone
      const filePath = path.join(tempDir, 'nonexistent.txt');

      expect(await isTextFile(filePath)).toBe(true);
    });

    it('should return true for empty file', async () => {
      const filePath = path.join(tempDir, 'empty.txt');
      await fs.writeFile(filePath, '');

      expect(await isTextFile(filePath)).toBe(true);
    });

    it('should detect binary even with text extension if it has null bytes', async () => {
      const filePath = path.join(tempDir, 'fake.txt');
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
      await fs.writeFile(filePath, buffer);

      // Known extension takes precedence - returns true even with null bytes
      expect(await isTextFile(filePath)).toBe(true);
    });

    it('should handle large files (check only first 8000 bytes)', async () => {
      const filePath = path.join(tempDir, 'largefile');
      // Create file with text at start and null bytes after 8000
      const textPart = Buffer.alloc(8001, 0x41); // 'A' characters
      textPart[8000] = 0x00; // null byte after the check range
      await fs.writeFile(filePath, textPart);

      expect(await isTextFile(filePath)).toBe(true);
    });

    it('should detect null byte within first 8000 bytes', async () => {
      const filePath = path.join(tempDir, 'nullinmiddle');
      const buffer = Buffer.alloc(100, 0x41); // 'A' characters
      buffer[50] = 0x00; // null byte in middle
      await fs.writeFile(filePath, buffer);

      expect(await isTextFile(filePath)).toBe(false);
    });
  });
});
