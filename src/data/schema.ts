export interface DataPoint {
  time: number;    // unix timestamp (секунды), начало дня UTC
  old: number;     // строк в старой папке
  new: number;     // строк в новой папке
}

export interface MetaInfo {
  sourceRepo: string;   // git remote URL
  oldPath: string;      // путь старой папки
  newPath: string;      // путь новой папки
  generatedAt: string;  // ISO-8601
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
