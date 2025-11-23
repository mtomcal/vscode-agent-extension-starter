import * as vscode from 'vscode';
import { AuditLogEntry, ExtensionConfig } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logger for audit trail of all agent activities.
 * Tracks tool executions, approvals, workflows, and errors.
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private logger: Logger;
  private maxLogEntries = 1000;

  constructor(
    private context: vscode.ExtensionContext,
    private config: ExtensionConfig
  ) {
    this.logger = new Logger('AuditLogger', config.debugMode);
    this.loadLogs();
  }

  /**
   * Log a tool execution
   */
  async logToolExecution(toolId: string, parameters: any): Promise<void> {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: 'tool_execution',
      details: {
        toolId,
        parameters,
      },
    };

    this.addEntry(entry);
    this.logger.debug(`Tool execution logged: ${toolId}`);
  }

  /**
   * Log an approval decision
   */
  async logApproval(
    requestId: string,
    approved: boolean,
    action: any,
    comment?: string
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: 'approval',
      details: {
        requestId,
        approved,
        action,
        comment,
      },
    };

    this.addEntry(entry);
    this.logger.debug(`Approval logged: ${requestId} - ${approved ? 'approved' : 'denied'}`);
  }

  /**
   * Log a workflow execution
   */
  async logWorkflow(
    workflowId: string,
    workflowName: string,
    status: string,
    details: any
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: 'workflow',
      details: {
        workflowId,
        workflowName,
        status,
        ...details,
      },
    };

    this.addEntry(entry);
    this.logger.debug(`Workflow logged: ${workflowName} - ${status}`);
  }

  /**
   * Log an error
   */
  async logError(error: Error, context: any): Promise<void> {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: 'error',
      details: {
        message: error.message,
        stack: error.stack,
        context,
      },
    };

    this.addEntry(entry);
    this.logger.error('Error logged', error);
  }

  /**
   * Get all log entries
   */
  getAllLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by type
   */
  getLogsByType(type: AuditLogEntry['type']): AuditLogEntry[] {
    return this.logs.filter((log) => log.type === type);
  }

  /**
   * Get logs in time range
   */
  getLogsByTimeRange(startTime: number, endTime: number): AuditLogEntry[] {
    return this.logs.filter((log) => log.timestamp >= startTime && log.timestamp <= endTime);
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    this.logs = [];
    await this.saveLogs();
    this.logger.info('Audit logs cleared');
  }

  /**
   * Export logs to JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Add an entry to the log
   */
  private addEntry(entry: AuditLogEntry): void {
    this.logs.push(entry);

    // Trim if exceeds max
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Save asynchronously
    this.saveLogs().catch((error) => {
      this.logger.error('Failed to save audit logs', error);
    });
  }

  /**
   * Load logs from persistent storage
   */
  private async loadLogs(): Promise<void> {
    try {
      const stored = this.context.globalState.get<AuditLogEntry[]>('auditLogs');

      if (stored) {
        this.logs = stored;
        this.logger.info(`Loaded ${this.logs.length} audit log entries`);
      }
    } catch (error) {
      this.logger.error('Failed to load audit logs', error);
    }
  }

  /**
   * Save logs to persistent storage
   */
  private async saveLogs(): Promise<void> {
    try {
      await this.context.globalState.update('auditLogs', this.logs);
    } catch (error) {
      this.logger.error('Failed to save audit logs', error);
      throw error;
    }
  }
}
