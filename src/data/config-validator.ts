import { FolderConfig, GroupConfig } from './schema.js';

const REST_MARKER = '__REST__';

/**
 * Validates that no path appears in more than one group.
 * @throws Error if duplicate paths found across groups
 */
export function validateGroupConfig(groups: GroupConfig[]): void {
	const seenPaths = new Map<string, string>(); // path -> group label

	for (const group of groups) {
		for (const p of group.paths) {
			if (p === REST_MARKER) {
				continue;
			}

			const normalized = normalizePath(p);
			const existingGroup = seenPaths.get(normalized);

			if (existingGroup) {
				throw new Error(
					`Config error: path "${p}" appears in both groups "${existingGroup}" and "${group.label}"`,
				);
			}

			seenPaths.set(normalized, group.label);
		}
	}

	// Note: overlapping directory paths across groups are allowed.
	// Resolution is first-match-wins: groups listed earlier in config take priority.
	// E.g., Framework claims "chart-client/js/common/computedvalue.ts" (specific file),
	// Chart claims "chart-client/js/common/" (directory) — Framework wins for that file.
}

/**
 * Normalizes groups: if there are groups defined but none uses __REST__,
 * auto-appends a __REST__ group.
 */
export function normalizeGroups(groups: GroupConfig[]): GroupConfig[] {
	if (groups.length === 0) {
		return [];
	}

	const hasRest = groups.some((g) => g.paths.includes(REST_MARKER));

	if (hasRest) {
		return groups;
	}

	return [...groups, { label: REST_MARKER, paths: [REST_MARKER] }];
}

/**
 * Validates and normalizes a FolderConfig.
 * @throws Error if config is invalid
 */
export function validateFolderConfig(config: FolderConfig, name: string): FolderConfig {
	if (!config.path || typeof config.path !== 'string') {
		throw new Error(`Config error: ${name}.path is required and must be a string`);
	}

	if (!config.label || typeof config.label !== 'string') {
		throw new Error(`Config error: ${name}.label is required and must be a string`);
	}

	const groups = config.groups ?? [];

	validateGroupConfig(groups);

	return {
		...config,
		groups: normalizeGroups(groups),
	};
}

function normalizePath(p: string): string {
	// Remove trailing slash for comparison consistency, but keep it for directory detection
	return p;
}
