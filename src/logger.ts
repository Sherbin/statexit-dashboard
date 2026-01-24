export function log(message: string): void {
  console.log(`[INFO] ${message}`);
}

export function error(message: string): void {
  console.error(`[ERROR] ${message}`);
}

export function warn(message: string): void {
  console.warn(`[WARN] ${message}`);
}
