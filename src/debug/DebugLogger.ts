declare const __DEV__: boolean;

export interface DebugLogger {
  log(...args: unknown[]): void;
}

export function createDebugLogger(scope: string): DebugLogger {
  return {
    log(...args: unknown[]): void {
      if (__DEV__) console.debug(`[ChapShuffle:${scope}]`, ...args);
    },
  };
}
