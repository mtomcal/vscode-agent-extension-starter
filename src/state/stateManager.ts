import * as vscode from 'vscode';
import { ExtensionState, StateSubscriber } from '../types/index.js';
import { Logger } from '../utils/logger.js';

/**
 * Global state manager for the extension.
 * Manages extension state with persistence and subscriber notifications.
 */
export class StateManager {
  private state: ExtensionState;
  private subscribers: Set<StateSubscriber> = new Set();
  private logger: Logger;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private saveDebounceMs = 1000;

  constructor(
    private context: vscode.ExtensionContext,
    debugMode: boolean = false
  ) {
    this.logger = new Logger('StateManager', debugMode);
    this.state = this.loadState();
  }

  /**
   * Get the current state
   */
  getState(): Readonly<ExtensionState> {
    return { ...this.state };
  }

  /**
   * Update the state
   */
  async updateState(updates: Partial<ExtensionState>): Promise<void> {
    this.state = { ...this.state, ...updates };
    await this.debouncedPersist();
    this.notifySubscribers();
    this.logger.debug('State updated');
  }

  /**
   * Update a specific part of the state
   */
  async updateWorkflows(workflows: ExtensionState['workflows']): Promise<void> {
    await this.updateState({ workflows });
  }

  async updateTools(tools: ExtensionState['tools']): Promise<void> {
    await this.updateState({ tools });
  }

  async updateApprovals(approvals: ExtensionState['approvals']): Promise<void> {
    await this.updateState({ approvals });
  }

  async updateAuditLog(auditLog: ExtensionState['auditLog']): Promise<void> {
    await this.updateState({ auditLog });
  }

  /**
   * Clear all state
   */
  async clearState(): Promise<void> {
    this.state = {
      workflows: [],
      tools: [],
      approvals: [],
      auditLog: [],
    };

    await this.persistState();
    this.notifySubscribers();
    this.logger.info('State cleared');
  }

  /**
   * Subscribe to state changes
   */
  subscribeToChanges(subscriber: StateSubscriber): () => void {
    this.subscribers.add(subscriber);
    this.logger.debug('Subscriber added');

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(subscriber);
      this.logger.debug('Subscriber removed');
    };
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Load state from persistent storage
   */
  private loadState(): ExtensionState {
    try {
      const stored = this.context.globalState.get<ExtensionState>('extensionState');

      if (stored) {
        this.logger.info('State loaded from storage');
        return stored;
      }

      this.logger.info('No stored state found, using default');
      return this.getDefaultState();
    } catch (error) {
      this.logger.error('Failed to load state, using default', error);
      return this.getDefaultState();
    }
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      await this.context.globalState.update('extensionState', this.state);
      this.logger.debug('State persisted');
    } catch (error) {
      this.logger.error('Failed to persist state', error);
      throw error;
    }
  }

  /**
   * Debounced persist to avoid too frequent saves
   */
  private async debouncedPersist(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      await this.persistState();
      this.saveDebounceTimer = null;
    }, this.saveDebounceMs);
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(): void {
    const stateSnapshot = this.getState();

    for (const subscriber of this.subscribers) {
      try {
        subscriber.onStateChange(stateSnapshot);
      } catch (error) {
        this.logger.error('Subscriber notification failed', error);
      }
    }

    this.logger.debug(`Notified ${this.subscribers.size} subscribers`);
  }

  /**
   * Get default state
   */
  private getDefaultState(): ExtensionState {
    return {
      workflows: [],
      tools: [],
      approvals: [],
      auditLog: [],
    };
  }

  /**
   * Export state as JSON
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from JSON
   */
  async importState(json: string): Promise<void> {
    try {
      const imported = JSON.parse(json) as ExtensionState;

      // Validate imported state
      if (!this.isValidState(imported)) {
        throw new Error('Invalid state structure');
      }

      this.state = imported;
      await this.persistState();
      this.notifySubscribers();

      this.logger.info('State imported successfully');
    } catch (error) {
      this.logger.error('Failed to import state', error);
      throw error;
    }
  }

  /**
   * Validate state structure
   */
  private isValidState(state: any): state is ExtensionState {
    return (
      typeof state === 'object' &&
      Array.isArray(state.workflows) &&
      Array.isArray(state.tools) &&
      Array.isArray(state.approvals) &&
      Array.isArray(state.auditLog)
    );
  }

  /**
   * Dispose and clean up
   */
  async dispose(): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      await this.persistState();
    }

    this.subscribers.clear();
    this.logger.info('StateManager disposed');
  }
}
