import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { analyzeFolder, IGNORED_DIRS } from '../../../analysis/line-counter.js';

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

	describe('analyzeFolder', () => {
		it('should return lines and files count', async () => {
			await fs.writeFile(path.join(tempDir, 'file1.ts'), 'a\nb\nc\n');
			await fs.writeFile(path.join(tempDir, 'file2.ts'), 'd\ne\n');

			const result = await analyzeFolder(tempDir);

			expect(result.files).toBe(2);
		});

		it('should return 0 for non-existent directory', async () => {
			const result = await analyzeFolder(path.join(tempDir, 'nonexistent'));

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

			expect(result.files).toBe(1);
		});

		it('should count all files including binary', async () => {
			await fs.writeFile(path.join(tempDir, 'code.ts'), 'a\n');
			await fs.writeFile(path.join(tempDir, 'image.dat'), Buffer.from([0x00, 0x01]));

			const result = await analyzeFolder(tempDir);

			expect(result.files).toBe(2);
		});
	});
});
