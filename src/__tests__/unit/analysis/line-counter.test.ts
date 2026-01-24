import { countLines, analyzeFolder, IGNORED_DIRS } from '../../../analysis/line-counter.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('line-counter', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'line-counter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('IGNORED_DIRS', () => {
    it('should include .git', () => {
      expect(IGNORED_DIRS.has('.git')).toBe(true);
    });

    it('should include node_modules', () => {
      expect(IGNORED_DIRS.has('node_modules')).toBe(true);
    });

    it('should include __pycache__', () => {
      expect(IGNORED_DIRS.has('__pycache__')).toBe(true);
    });
  });

  describe('countLines', () => {
    it('should return 0 for non-existent directory', async () => {
      const result = await countLines(path.join(tempDir, 'nonexistent'));
      expect(result).toBe(0);
    });

    it('should return 0 for empty directory', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.mkdir(emptyDir);

      const result = await countLines(emptyDir);
      expect(result).toBe(0);
    });

    it('should count non-empty lines in a single file', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      await fs.writeFile(filePath, 'line1\nline2\nline3\n');

      const result = await countLines(tempDir);
      expect(result).toBe(3);
    });

    it('should ignore empty lines', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      await fs.writeFile(filePath, 'line1\n\nline2\n\n\nline3\n');

      const result = await countLines(tempDir);
      expect(result).toBe(3);
    });

    it('should ignore whitespace-only lines', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      await fs.writeFile(filePath, 'line1\n   \nline2\n\t\t\nline3\n');

      const result = await countLines(tempDir);
      expect(result).toBe(3);
    });

    it('should count lines across multiple files', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'a\nb\nc\n'); // 3 lines
      await fs.writeFile(path.join(tempDir, 'file2.ts'), 'd\ne\n');    // 2 lines

      const result = await countLines(tempDir);
      expect(result).toBe(5);
    });

    it('should recurse into subdirectories', async () => {
      const subDir = path.join(tempDir, 'sub');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(tempDir, 'root.ts'), 'a\nb\n');     // 2 lines
      await fs.writeFile(path.join(subDir, 'nested.ts'), 'c\nd\ne\n'); // 3 lines

      const result = await countLines(tempDir);
      expect(result).toBe(5);
    });

    it('should ignore .git directory', async () => {
      const gitDir = path.join(tempDir, '.git');
      await fs.mkdir(gitDir);
      await fs.writeFile(path.join(tempDir, 'code.ts'), 'a\n');       // 1 line
      await fs.writeFile(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main\n');

      const result = await countLines(tempDir);
      expect(result).toBe(1);
    });

    it('should ignore node_modules directory', async () => {
      const nmDir = path.join(tempDir, 'node_modules');
      await fs.mkdir(nmDir);
      await fs.writeFile(path.join(tempDir, 'code.ts'), 'a\n');
      await fs.writeFile(path.join(nmDir, 'dep.js'), 'x\ny\nz\n');

      const result = await countLines(tempDir);
      expect(result).toBe(1);
    });

    it('should skip binary files', async () => {
      await fs.writeFile(path.join(tempDir, 'code.ts'), 'a\nb\n');
      const binaryPath = path.join(tempDir, 'image.dat');
      await fs.writeFile(binaryPath, Buffer.from([0x00, 0x01, 0x02]));

      const result = await countLines(tempDir);
      expect(result).toBe(2);
    });

    it('should return 0 when path is a file not a directory', async () => {
      const filePath = path.join(tempDir, 'file.ts');
      await fs.writeFile(filePath, 'a\nb\nc\n');

      const result = await countLines(filePath);
      expect(result).toBe(0);
    });

    it('should handle deeply nested structure', async () => {
      const deep = path.join(tempDir, 'a', 'b', 'c');
      await fs.mkdir(deep, { recursive: true });
      await fs.writeFile(path.join(deep, 'deep.ts'), 'x\ny\n');

      const result = await countLines(tempDir);
      expect(result).toBe(2);
    });
  });

  describe('analyzeFolder', () => {
    it('should return lines and files count', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.ts'), 'a\nb\nc\n');
      await fs.writeFile(path.join(tempDir, 'file2.ts'), 'd\ne\n');

      const result = await analyzeFolder(tempDir);
      
      expect(result.lines).toBe(5);
      expect(result.files).toBe(2);
    });

    it('should return 0 for non-existent directory', async () => {
      const result = await analyzeFolder(path.join(tempDir, 'nonexistent'));
      
      expect(result.lines).toBe(0);
      expect(result.files).toBe(0);
    });

    it('should ignore specified subfolders', async () => {
      const imagesDir = path.join(tempDir, 'images');
      const fontsDir = path.join(tempDir, 'fonts');
      await fs.mkdir(imagesDir);
      await fs.mkdir(fontsDir);
      
      await fs.writeFile(path.join(tempDir, 'code.ts'), 'a\nb\nc\n');
      await fs.writeFile(path.join(imagesDir, 'meta.json'), '{"a":1}\n');
      await fs.writeFile(path.join(fontsDir, 'list.txt'), 'x\ny\n');

      const result = await analyzeFolder(tempDir, ['images', 'fonts']);
      
      expect(result.lines).toBe(3);
      expect(result.files).toBe(1);
    });

    it('should count files recursively', async () => {
      const subDir = path.join(tempDir, 'sub');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(tempDir, 'root.ts'), 'a\n');
      await fs.writeFile(path.join(subDir, 'nested.ts'), 'b\n');

      const result = await analyzeFolder(tempDir);
      
      expect(result.files).toBe(2);
    });

    it('should ignore nested subfolders by relative path', async () => {
      const apiTypesDir = path.join(tempDir, 'api-types');
      await fs.mkdir(apiTypesDir);
      await fs.writeFile(path.join(tempDir, 'code.ts'), 'a\n');
      await fs.writeFile(path.join(apiTypesDir, 'types.ts'), 'b\nc\n');

      const result = await analyzeFolder(tempDir, ['api-types']);
      
      expect(result.lines).toBe(1);
      expect(result.files).toBe(1);
    });

    it('should skip binary files in file count', async () => {
      await fs.writeFile(path.join(tempDir, 'code.ts'), 'a\n');
      await fs.writeFile(path.join(tempDir, 'image.dat'), Buffer.from([0x00, 0x01]));

      const result = await analyzeFolder(tempDir);
      
      expect(result.files).toBe(1);
    });
  });
});
