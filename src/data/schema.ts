export interface DataPoint {
  time: number;       // unix timestamp (секунды), начало дня UTC
  old: number;        // строк в старой папке
  new: number;        // строк в новой папке
  oldFiles?: number;  // количество файлов (опционально)
  newFiles?: number;  // количество файлов (опционально)
}

export interface MetaInfo {
  sourceRepo: string;   // git remote URL
  oldPath: string;      // путь старой папки
  newPath: string;      // путь новой папки
  generatedAt: string;  // ISO-8601
  version?: number;     // версия схемы
  ignoredSubfolders?: {
    old?: string[];
    new?: string[];
  };
}

export interface FolderStats {
  lines: number;
  files: number;
}

export interface ProgressData {
  meta: MetaInfo;
  data: DataPoint[];
}

export interface CommitInfo {
  hash: string;
  timestamp: number;  // unix timestamp
}

export interface DailyCommit {
  date: string;       // YYYY-MM-DD
  hash: string;
  timestamp: number;
}
