import * as fs from 'fs/promises';
import * as path from 'path';

import { FolderStats, GroupConfig, GroupDataPoint, GroupedFolderStats } from '../data/schema.js';
import { isTextFile } from './text-detector.js';

const REST_MARKER = '__REST__';

/**
 * Standard directories to always ignore
 */
export const IGNORED_DIRS: Set<string> = new Set(['.git', 'node_modules', '__pycache__', '.DS_Store']);

/**
 * File extensions to always ignore (video)
 */
export const IGNORED_EXTENSIONS: Set<string> = new Set([
	'.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.ogv',
]);

/**
 * Recursively analyzes a folder: counts size and number of files.
 * Does NOT read file contents — only fs.stat().
 */
export async function analyzeFolder(folderPath: string, ignoredSubfolders?: string[]): Promise<FolderStats> {
	const ignoredSet = new Set(ignoredSubfolders || []);

	try {
		const stat = await fs.stat(folderPath);

		if (!stat.isDirectory()) {
			return { sizeKB: 0, files: 0 };
		}
	} catch {
		return { sizeKB: 0, files: 0 };
	}

	let totalSizeBytes = 0;
	let totalFiles = 0;

	async function processDirectory(dirPath: string, relativePath: string): Promise<void> {
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
			const relPath = relativePath ? `${relativePath}/${entryName}` : entryName;

			if (IGNORED_DIRS.has(entryName)) {
				continue;
			}

			if (entry.isDirectory()) {
				if (ignoredSet.has(entryName) || ignoredSet.has(relPath)) {
					continue;
				}
				await processDirectory(fullPath, relPath);
			} else if (entry.isFile()) {
				const ext = path.extname(entryName).toLowerCase();
				if (IGNORED_EXTENSIONS.has(ext)) {
					continue;
				}

				if (!await isTextFile(fullPath)) {
					continue;
				}

				try {
					const fileStat = await fs.stat(fullPath);

					totalSizeBytes += fileStat.size;
					totalFiles += 1;
				} catch (err) {
					console.error(`Error stat file ${fullPath}:`, err);
				}
			}
		}
	}

	await processDirectory(folderPath, '');

	const sizeKB = Math.round(totalSizeBytes / 1024);

	return { sizeKB, files: totalFiles };
}

/**
 * Determines which group a file belongs to based on its relative path.
 * Returns the group label, or null if no match (will go to __REST__).
 */
function matchFileToGroup(relPath: string, groups: GroupConfig[]): string | null {
	for (const group of groups) {
		for (const groupPath of group.paths) {
			if (groupPath === REST_MARKER) {
				continue;
			}

			// Directory match: groupPath ends with "/" — match any file under it
			if (groupPath.endsWith('/')) {
				if (relPath.startsWith(groupPath) || relPath + '/' === groupPath) {
					return group.label;
				}
			} else {
				// Exact file match or directory prefix match
				if (relPath === groupPath || relPath.startsWith(groupPath + '/')) {
					return group.label;
				}
			}
		}
	}

	return null;
}

/**
 * Analyzes a folder with group breakdown.
 * Each file is classified into exactly one group based on config.
 * __REST__ group is computed as total - sum(explicit groups) to avoid rounding errors.
 */
export async function analyzeFolderWithGroups(
	folderPath: string,
	ignoredSubfolders: string[],
	groups: GroupConfig[],
): Promise<GroupedFolderStats> {
	const ignoredSet = new Set(ignoredSubfolders || []);

	// Filter out the REST marker group for matching purposes
	const explicitGroups = groups.filter((g) => !g.paths.includes(REST_MARKER));
	const restGroup = groups.find((g) => g.paths.includes(REST_MARKER));

	// Accumulators: label -> { sizeBytes, files }
	const groupAccum = new Map<string, { sizeBytes: number; files: number }>();

	for (const g of explicitGroups) {
		groupAccum.set(g.label, { sizeBytes: 0, files: 0 });
	}

	let totalSizeBytes = 0;
	let totalFiles = 0;
	let restSizeBytes = 0;
	let restFiles = 0;

	try {
		const stat = await fs.stat(folderPath);

		if (!stat.isDirectory()) {
			return {
				total: { sizeKB: 0, files: 0 },
				groups: groups.map((g) => ({ label: g.label, sizeKB: 0, files: 0 })),
			};
		}
	} catch {
		return {
			total: { sizeKB: 0, files: 0 },
			groups: groups.map((g) => ({ label: g.label, sizeKB: 0, files: 0 })),
		};
	}

	async function processDirectory(dirPath: string, relativePath: string): Promise<void> {
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
			const relPath = relativePath ? `${relativePath}/${entryName}` : entryName;

			if (IGNORED_DIRS.has(entryName)) {
				continue;
			}

			if (entry.isDirectory()) {
				if (ignoredSet.has(entryName) || ignoredSet.has(relPath)) {
					continue;
				}
				await processDirectory(fullPath, relPath);
			} else if (entry.isFile()) {
				const ext = path.extname(entryName).toLowerCase();
				if (IGNORED_EXTENSIONS.has(ext)) {
					continue;
				}

				if (!await isTextFile(fullPath)) {
					continue;
				}

				try {
					const fileStat = await fs.stat(fullPath);
					const fileSize = fileStat.size;

					totalSizeBytes += fileSize;
					totalFiles += 1;

					const groupLabel = matchFileToGroup(relPath, explicitGroups);

					if (groupLabel) {
						const accum = groupAccum.get(groupLabel)!;
						accum.sizeBytes += fileSize;
						accum.files += 1;
					} else {
						restSizeBytes += fileSize;
						restFiles += 1;
					}
				} catch (err) {
					console.error(`Error stat file ${fullPath}:`, err);
				}
			}
		}
	}

	await processDirectory(folderPath, '');

	const totalSizeKB = Math.round(totalSizeBytes / 1024);

	// Build group data points
	const groupDataPoints: GroupDataPoint[] = [];
	let explicitSumKB = 0;
	let explicitSumFiles = 0;

	for (const g of explicitGroups) {
		const accum = groupAccum.get(g.label)!;
		const sizeKB = Math.round(accum.sizeBytes / 1024);

		groupDataPoints.push({ label: g.label, sizeKB, files: accum.files });
		explicitSumKB += sizeKB;
		explicitSumFiles += accum.files;
	}

	// __REST__ = total - sum(explicit) to guarantee exact match
	if (restGroup) {
		groupDataPoints.push({
			label: restGroup.label,
			sizeKB: totalSizeKB - explicitSumKB,
			files: totalFiles - explicitSumFiles,
		});
	}

	return {
		total: { sizeKB: totalSizeKB, files: totalFiles },
		groups: groupDataPoints,
	};
}
