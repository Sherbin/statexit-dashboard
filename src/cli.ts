#!/usr/bin/env node

import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';

import { Command } from 'commander';

import { analyzeFolderWithGroups } from './analysis/index.js';
import { getCachePath, loadCache, saveCache, validateCache, createCache, cacheToCommitInfo } from './cache/index.js';
import {
	validateProgressData,
	loadExistingData,
	mergeData,
	getLastTimestamp,
	saveData,
	validateFolderConfig,
} from './data/index.js';
import { ProgressData, DataPoint, MetaInfo, FolderConfig, GroupConfig } from './data/schema.js';
import {
	getCommitHistory,
	aggregateByDay,
	getCurrentBranch,
	checkoutCommit,
	restoreBranch,
	findMigrationStart,
} from './git/index.js';
import { commitIfChanged } from './git-ops/index.js';
import { logger, LogLevel } from './logger.js';

interface ConfigFile {
	repo: string;
	old: FolderConfig;
	new: FolderConfig;
	output: string;
	sourceRepo: string;
	force?: boolean;
	cache?: string;
	logLevel?: LogLevel;
	untilYesterday?: boolean;
	maxDays?: number;
}

interface CliOptions {
	repo?: string;
	output?: string;
	force: boolean;
	cache?: string;
	logLevel: LogLevel;
	config?: string;
	untilYesterday: boolean;
	maxDays?: string;
}

function resolveConfigPath(configPath: string): string {
	const resolved = path.resolve(configPath);
	const ext = path.extname(resolved);
	const base = resolved.slice(0, -ext.length);
	const localPath = `${base}.local${ext}`;

	if (fsSync.existsSync(localPath)) {
		return localPath;
	}

	return resolved;
}

function loadConfigFile(configPath: string): ConfigFile {
	const content = fsSync.readFileSync(configPath, 'utf-8');

	return JSON.parse(content) as ConfigFile;
}

function buildMeta(
	sourceRepo: string,
	oldConfig: FolderConfig,
	newConfig: FolderConfig,
	oldGroups: GroupConfig[],
	newGroups: GroupConfig[],
): MetaInfo {
	return {
		sourceRepo,
		oldPath: oldConfig.path,
		newPath: newConfig.path,
		generatedAt: new Date().toISOString(),
		version: 3,
		ignoredSubfolders:
			oldConfig.ignore?.length || newConfig.ignore?.length
				? {
					old: oldConfig.ignore,
					new: newConfig.ignore,
				  }
				: undefined,
		ui: {
			title: 'Migration Progress',
			oldLabel: oldConfig.label,
			newLabel: newConfig.label,
			oldDescription: oldConfig.description,
			newDescription: newConfig.description,
		},
		groups: {
			old: oldGroups.map((g) => ({ label: g.label, paths: [] })),
			new: newGroups.map((g) => ({ label: g.label, paths: [] })),
		},
	};
}

async function main(): Promise<void> {
	const program = new Command();

	program
		.option('--config <path>', 'Path to config JSON file')
		.option('--repo <path>', 'Path to source repository')
		.option('--output <path>', 'Output JSON file path')
		.option('--force', 'Force full recalculation', false)
		.option('--cache <path>', 'Path to cache file')
		.option('--log-level <level>', 'Log level: debug|info|warn|error', 'info')
		.option('--until-yesterday', 'Exclude today, only process up to yesterday', false)
		.option('--max-days <n>', 'Maximum number of new days to process per run')
		.parse();

	const cliOpts = program.opts<CliOptions>();

	// Load config file
	let config: ConfigFile | null = null;

	if (cliOpts.config) {
		const resolvedPath = resolveConfigPath(cliOpts.config);
		config = loadConfigFile(resolvedPath);
		logger.info('CONFIG', `Loaded config from ${resolvedPath}`);
	}

	const repo = cliOpts.repo ?? config?.repo;
	const output = cliOpts.output ?? config?.output;
	const sourceRepo = config?.sourceRepo;

	if (!repo || !output || !config) {
		console.error('Error: --config is required with repo, old, new, output, and sourceRepo fields');
		process.exit(1);
	}

	if (!sourceRepo) {
		throw new Error('sourceRepo is required in config file');
	}

	// Validate and normalize folder configs
	const oldConfig = validateFolderConfig(config.old, 'old');
	const newConfig = validateFolderConfig(config.new, 'new');

	const oldGroups = oldConfig.groups ?? [];
	const newGroups = newConfig.groups ?? [];
	const ignoreOld = oldConfig.ignore ?? [];
	const ignoreNew = newConfig.ignore ?? [];

	const force = cliOpts.force || config.force || false;
	const cache = cliOpts.cache ?? config.cache;
	const logLevel = cliOpts.logLevel ?? config.logLevel ?? 'info';
	const maxDays = cliOpts.maxDays ? parseInt(cliOpts.maxDays, 10) : config.maxDays;

	logger.setLevel(logLevel);

	const repoPath = path.resolve(repo);
	const outputPath = path.resolve(output);
	const oldPath = oldConfig.path;
	const newFolderPath = newConfig.path;
	const cachePath = getCachePath(outputPath, cache);

	logger.info('INIT', 'Starting analysis', {
		repo: repoPath,
		oldPath,
		newPath: newFolderPath,
		output: outputPath,
		cache: cachePath,
		ignoreOld,
		ignoreNew,
		oldGroups: oldGroups.length,
		newGroups: newGroups.length,
		force,
	});

	// Load existing data
	let existingData: ProgressData | null = null;

	if (!force) {
		existingData = await loadExistingData(outputPath);
		if (existingData) {
			logger.info('INIT', `Loaded existing data with ${existingData.data.length} points`);
		}
	}

	// Find migration start point (cached)
	let migrationStart;

	if (!force) {
		const cachedData = await loadCache(cachePath);

		if (cachedData && validateCache(cachedData, repoPath, oldPath, newFolderPath)) {
			migrationStart = cacheToCommitInfo(cachedData);
			logger.info('CACHE', `Using cached migration start: ${migrationStart.hash.substring(0, 7)}`);
		}
	}

	if (!migrationStart) {
		logger.info('GIT', 'Finding migration start point...');
		migrationStart = await findMigrationStart(repoPath, oldPath, newFolderPath);

		const cacheData = createCache(migrationStart, oldPath, newFolderPath);

		await saveCache(cachePath, cacheData);
	}

	logger.info('GIT', `Migration started at commit ${migrationStart.hash.substring(0, 7)}`);

	// Get git log
	logger.info('GIT', 'Fetching commit history...');
	const allCommits = await getCommitHistory(repoPath);

	const relevantCommits = allCommits.filter((c) => c.timestamp >= migrationStart.timestamp);

	logger.info('GIT', `Found ${relevantCommits.length} commits since migration start`);

	// Aggregate by day
	const dailyCommits = aggregateByDay(relevantCommits);

	logger.info('AGGREGATE', `Aggregated to ${dailyCommits.length} daily data points`);

	// Filter --until-yesterday
	const untilYesterday = cliOpts.untilYesterday || config.untilYesterday || false;

	let filteredDailyCommits = dailyCommits;

	if (untilYesterday) {
		const today = new Date().toISOString().split('T')[0];

		filteredDailyCommits = dailyCommits.filter((dc) => dc.date < today);
		logger.info(
			'FILTER',
			`Excluding today (${today}), ${dailyCommits.length - filteredDailyCommits.length} day(s) filtered`,
		);
	}

	// Filter already processed
	const lastTimestamp = getLastTimestamp(existingData);
	const newDailyCommits = filteredDailyCommits.filter((dc) => {
		const dayStart = new Date(dc.date + 'T00:00:00Z').getTime() / 1000;

		return dayStart > lastTimestamp;
	});

	// Limit number of days per run
	let limitedDailyCommits = newDailyCommits;

	if (maxDays && newDailyCommits.length > maxDays) {
		limitedDailyCommits = newDailyCommits.slice(0, maxDays);
		logger.info('LIMIT', `Limited to ${maxDays} days (${newDailyCommits.length - maxDays} remaining for next run)`);
	}

	if (limitedDailyCommits.length === 0) {
		logger.info('AGGREGATE', 'No new data points to process');
	} else {
		logger.info('AGGREGATE', `Processing ${limitedDailyCommits.length} new days...`);
	}

	// Analyze new commits
	const newPoints: DataPoint[] = [];

	if (limitedDailyCommits.length > 0) {
		const originalBranch = await getCurrentBranch(repoPath);

		try {
			for (const dc of limitedDailyCommits) {
				logger.info('CHECKOUT', `Analyzing ${dc.date} (${dc.hash.substring(0, 7)})...`);

				await checkoutCommit(repoPath, dc.hash);

				const oldFullPath = path.join(repoPath, oldPath);
				const newFullPath = path.join(repoPath, newFolderPath);

				const oldResult = await analyzeFolderWithGroups(oldFullPath, ignoreOld, oldGroups);
				const newResult = await analyzeFolderWithGroups(newFullPath, ignoreNew, newGroups);

				const dayTimestamp = new Date(dc.date + 'T00:00:00Z').getTime() / 1000;

				const newPoint: DataPoint = {
					time: dayTimestamp,
					oldSizeKB: oldResult.total.sizeKB,
					newSizeKB: newResult.total.sizeKB,
					oldFiles: oldResult.total.files,
					newFiles: newResult.total.files,
					groups: {
						old: oldResult.groups,
						new: newResult.groups,
					},
				};

				newPoints.push(newPoint);

				logger.info('COUNT', `old: ${oldResult.total.sizeKB} KB, ${oldResult.total.files} files`);
				logger.info('COUNT', `new: ${newResult.total.sizeKB} KB, ${newResult.total.files} files`);

				if (oldResult.groups.length > 0) {
					for (const g of oldResult.groups) {
						logger.debug('COUNT', `  old/${g.label}: ${g.sizeKB} KB, ${g.files} files`);
					}
				}

				// Progressive save
				try {
					const progressMeta = buildMeta(sourceRepo, oldConfig, newConfig, oldGroups, newGroups);
					const progressData = mergeData(existingData, newPoints, progressMeta, false);

					await fs.writeFile(outputPath, JSON.stringify(progressData, null, 2), 'utf-8');
					logger.info('SAVE', `Saved progress: ${newPoints.length} days processed`);

					if (global.gc) {
						global.gc();
						logger.debug('GC', 'Manual garbage collection triggered');
					}
				} catch (saveErr) {
					logger.warn(
						'SAVE',
						`Failed to save progress: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
					);
				}
			}
		} finally {
			await restoreBranch(repoPath, originalBranch);
			logger.info('CHECKOUT', `Restored to ${originalBranch}`);
		}
	}

	const meta = buildMeta(sourceRepo, oldConfig, newConfig, oldGroups, newGroups);

	// Merge data
	const finalData = mergeData(existingData, newPoints, meta, force);

	// Validate
	logger.info('VALIDATE', 'Validating data...');
	validateProgressData(finalData);
	logger.info('VALIDATE', 'Validation passed');

	// Save
	await saveData(outputPath, finalData);
	logger.info('SAVE', `Saved ${finalData.data.length} data points to ${outputPath}`);

	// Commit and push
	const committed = await commitIfChanged(outputPath, 'Update migration progress data');

	if (committed) {
		logger.info('GIT-OPS', 'Changes committed and pushed');
	} else {
		logger.info('GIT-OPS', 'No changes to commit');
	}

	logger.info('DONE', 'Completed successfully');
}

main().catch((err) => {
	logger.error('FATAL', err.message);
	process.exit(1);
});
