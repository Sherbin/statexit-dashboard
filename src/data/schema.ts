export interface DataPoint {
	time: number; // unix timestamp (секунды), начало дня UTC
	oldSizeKB: number; // размер старой папки в KB
	newSizeKB: number; // размер новой папки в KB
	oldFiles: number; // количество файлов в старой папке
	newFiles: number; // количество файлов в новой папке
	comment?: string; // опциональное объяснение аномалий (на английском)
}

export interface UiConfig {
	title: string;
	oldLabel: string;
	newLabel: string;
	oldDescription: string;
	newDescription: string;
}

export interface MetaInfo {
	sourceRepo: string; // git remote URL
	oldPath: string; // путь старой папки
	newPath: string; // путь новой папки
	generatedAt: string; // ISO-8601
	version?: number; // версия схемы
	ignoredSubfolders?: {
		old?: string[];
		new?: string[];
	};
	ui?: UiConfig;
}

export interface FolderStats {
	sizeKB: number; // размер папки в килобайтах
	files: number; // количество файлов
}

export interface ProgressData {
	meta: MetaInfo;
	data: DataPoint[];
}

export interface CommitInfo {
	hash: string;
	timestamp: number; // unix timestamp
}

export interface DailyCommit {
	date: string; // YYYY-MM-DD
	hash: string;
	timestamp: number;
}
