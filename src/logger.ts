export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: string, stage: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level.toUpperCase()}] [${stage}] ${message}`;
  }

  debug(stage: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;
    const formatted = this.formatMessage('debug', stage, message);
    if (data) {
      console.log(formatted, JSON.stringify(data));
    } else {
      console.log(formatted);
    }
  }

  info(stage: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;
    const formatted = this.formatMessage('info', stage, message);
    if (data) {
      console.log(formatted, JSON.stringify(data));
    } else {
      console.log(formatted);
    }
  }

  warn(stage: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;
    const formatted = this.formatMessage('warn', stage, message);
    if (data) {
      console.warn(formatted, JSON.stringify(data));
    } else {
      console.warn(formatted);
    }
  }

  error(stage: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    const formatted = this.formatMessage('error', stage, message);
    if (data) {
      console.error(formatted, JSON.stringify(data));
    } else {
      console.error(formatted);
    }
  }
}

export const logger = new Logger();

// Backward compatibility exports
export function log(message: string): void {
  console.log(`[INFO] ${message}`);
}

export function error(message: string): void {
  console.error(`[ERROR] ${message}`);
}

export function warn(message: string): void {
  console.warn(`[WARN] ${message}`);
}
