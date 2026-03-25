// --- Config types ---

export interface GroupConfig {
	label: string;
	paths: string[]; // relative paths inside folder; "__REST__" is a special marker
}

export interface FolderConfig {
	label: string;
	path: string;
	description: string;
	ignore?: string[];
	groups?: GroupConfig[];
}

// --- Data types ---

export interface GroupDataPoint {
	label: string;
	sizeKB: number;
	files: number;
}

export interface DataPoint {
	time: number; // unix timestamp (seconds), start of day UTC
	oldSizeKB: number;
	newSizeKB: number;
	oldFiles: number;
	newFiles: number;
	comment?: string;
	groups: {
		old: GroupDataPoint[];
		new: GroupDataPoint[];
	};
}

export interface UiConfig {
	title: string;
	oldLabel: string;
	newLabel: string;
	oldDescription: string;
	newDescription: string;
}

export interface MetaInfo {
	sourceRepo: string;
	oldPath: string;
	newPath: string;
	generatedAt: string;
	version?: number;
	ignoredSubfolders?: {
		old?: string[];
		new?: string[];
	};
	ui?: UiConfig;
	groups: {
		old: GroupConfig[];
		new: GroupConfig[];
	};
}

export interface FolderStats {
	sizeKB: number;
	files: number;
}

export interface GroupedFolderStats {
	total: FolderStats;
	groups: GroupDataPoint[];
}

export interface ProgressData {
	meta: MetaInfo;
	data: DataPoint[];
}

export interface CommitInfo {
	hash: string;
	timestamp: number;
}

export interface DailyCommit {
	date: string; // YYYY-MM-DD
	hash: string;
	timestamp: number;
}
