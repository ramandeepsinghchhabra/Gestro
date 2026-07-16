export type LogTag = 'INIT' | 'MODEL' | 'CAMERA' | 'START' | 'STOP' | 'GESTURE' | 'ACTION' | 'ERROR' | 'CLEANUP' | 'PLATFORM';

class Logger {
  private debug = false;

  async initialize(): Promise<void> {
    const result = await chrome.storage.local.get('debug').catch(() => ({ debug: false }));
    this.debug = result.debug === true;

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.debug) {
        this.debug = changes.debug.newValue === true;
      }
    });
  }

  info(tag: LogTag, ...messages: any[]): void {
    if (!this.debug) return;
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