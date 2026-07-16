export type LogTag = 'INIT' | 'MODEL' | 'CAMERA' | 'GESTURE' | 'ACTION' | 'ERROR' | 'CLEANUP' | 'PLATFORM';

class Logger {
  info(tag: LogTag, ...messages: any[]): void {
    console.log(`[${tag}]`, ...messages);
  }

  warn(tag: LogTag, ...messages: any[]): void {
    console.warn(`[${tag}]`, ...messages);
  }

  error(tag: LogTag, ...messages: any[]): void {
    console.error(`[${tag}]`, ...messages);
  }
}

export const logger = new Logger();