import * as vscode from 'vscode';

/**
 * Logger utility for consistent logging across the extension.
 * Supports different log levels and debug mode.
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel;

  constructor(
    private component: string,
    private debugMode: boolean = false
  ) {
    if (!Logger.outputChannel) {
      Logger.outputChannel = vscode.window.createOutputChannel('Agent Extension');
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: any[]): void {
    this.log('INFO', message, args);
  }

  /**
   * Log a debug message (only in debug mode)
   */
  debug(message: string, ...args: any[]): void {
    if (this.debugMode) {
      this.log('DEBUG', message, args);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]): void {
    this.log('WARN', message, args);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: any): void {
    this.log('ERROR', message, [error]);

    if (error instanceof Error && error.stack) {
      this.log('ERROR', 'Stack trace:', [error.stack]);
    }
  }

  /**
   * Internal log method
   */
  private log(level: string, message: string, args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.component}]`;

    let fullMessage = `${prefix} ${message}`;

    if (args.length > 0) {
      const formattedArgs = args
        .map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      fullMessage += ` ${formattedArgs}`;
    }

    Logger.outputChannel.appendLine(fullMessage);

    // Also log to console in debug mode
    if (this.debugMode) {
      console.log(fullMessage);
    }
  }

  /**
   * Show the output channel
   */
  show(): void {
    Logger.outputChannel.show();
  }

  /**
   * Clear the output channel
   */
  static clear(): void {
    if (Logger.outputChannel) {
      Logger.outputChannel.clear();
    }
  }

  /**
   * Dispose the output channel
   */
  static dispose(): void {
    if (Logger.outputChannel) {
      Logger.outputChannel.dispose();
    }
  }
}
