export type LogTag = 'INIT' | 'MODEL' | 'CAMERA' | 'GESTURE' | 'ACTION' | 'ERROR' | 'CLEANUP' | 'PLATFORM';

const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

class Logger {
  info(tag: LogTag, ...messages: any[]): void {
    if (isDev) {
      console.log(`[${tag}]`, ...messages);
    }
  }

  warn(tag: LogTag, ...messages: any[]): void {
    console.warn(`[${tag}]`, ...messages);
  }

  error(tag: LogTag, ...messages: any[]): void {
    console.error(`[${tag}]`, ...messages);
  }
}

export const logger = new Logger();