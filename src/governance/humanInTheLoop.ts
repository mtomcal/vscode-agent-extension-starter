import * as vscode from 'vscode';
import {
  ApprovalRequest,
  ProposedAction,
  GovernanceRule,
  ExtensionConfig,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manager for human-in-the-loop governance.
 * Handles approval requests, governance rules, and user interaction for sensitive operations.
 */
export class HumanInTheLoopManager {
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private governanceRules: GovernanceRule[] = [];
  private logger: Logger;
  private approvalHandlers: Map<
    string,
    { resolve: (approved: boolean) => void; timeout: NodeJS.Timeout }
  > = new Map();

  constructor(private config: ExtensionConfig) {
    this.logger = new Logger('HumanInTheLoop', config.debugMode);
    this.setupDefaultRules();
  }

  /**
   * Request approval for a proposed action
   */
  async requestApproval(action: ProposedAction, timeout?: number): Promise<boolean> {
    const timeoutMs = timeout || this.config.approvalTimeout || 30000;

    // Check if auto-approval applies
    if (this.shouldAutoApprove(action)) {
      this.logger.info(`Action auto-approved: ${action.type}`);
      return true;
    }

    // Check if auto-denial applies
    if (this.shouldAutoDeny(action)) {
      this.logger.info(`Action auto-denied: ${action.type}`);
      return false;
    }

    // Create approval request
    const request: ApprovalRequest = {
      id: uuidv4(),
      action,
      timestamp: Date.now(),
      status: 'pending',
    };

    this.pendingApprovals.set(request.id, request);

    // Create promise that resolves when user responds or timeout occurs
    return new Promise<boolean>((resolve) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        request.status = 'expired';
        this.pendingApprovals.delete(request.id);
        this.approvalHandlers.delete(request.id);
        this.logger.warn(`Approval request timed out: ${request.id}`);
        resolve(false);
      }, timeoutMs);

      // Store handler
      this.approvalHandlers.set(request.id, { resolve, timeout: timeoutHandle });

      // Show approval UI
      this.showApprovalDialog(request);
    });
  }

  /**
   * Handle approval response from user
   */
  async handleApproval(
    requestId: string,
    approved: boolean,
    comment?: string
  ): Promise<void> {
    const request = this.pendingApprovals.get(requestId);

    if (!request) {
      this.logger.warn(`Approval request not found: ${requestId}`);
      return;
    }

    request.status = approved ? 'approved' : 'denied';
    request.response = comment;

    this.logger.info(
      `Approval ${approved ? 'granted' : 'denied'} for: ${request.action.description}`
    );

    // Resolve promise
    const handler = this.approvalHandlers.get(requestId);
    if (handler) {
      clearTimeout(handler.timeout);
      handler.resolve(approved);
      this.approvalHandlers.delete(requestId);
    }

    // Keep in history for a bit
    setTimeout(() => {
      this.pendingApprovals.delete(requestId);
    }, 60000); // 1 minute
  }

  /**
   * Get pending approval requests
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter(
      (request) => request.status === 'pending'
    );
  }

  /**
   * Get all approval requests (including completed)
   */
  getAllApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Add a governance rule
   */
  addRule(rule: GovernanceRule): void {
    this.governanceRules.push(rule);
    this.governanceRules.sort((a, b) => b.priority - a.priority);
    this.logger.debug(`Governance rule added: ${rule.id}`);
  }

  /**
   * Remove a governance rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.governanceRules.findIndex((rule) => rule.id === ruleId);

    if (index === -1) {
      return false;
    }

    this.governanceRules.splice(index, 1);
    this.logger.debug(`Governance rule removed: ${ruleId}`);
    return true;
  }

  /**
   * Get all governance rules
   */
  getRules(): GovernanceRule[] {
    return [...this.governanceRules];
  }

  /**
   * Set up default governance rules
   */
  private setupDefaultRules(): void {
    // File system write operations
    this.addRule({
      id: 'file-system-write',
      pattern: /write|delete|modify|remove|create/i,
      requiresApproval: true,
      autoApprove: false,
      priority: 100,
    });

    // Read-only operations
    this.addRule({
      id: 'read-only',
      pattern: /read|list|get|fetch|search/i,
      requiresApproval: false,
      autoApprove: this.config.autoApproveReadOnly,
      priority: 50,
    });

    // High impact operations
    this.addRule({
      id: 'high-impact',
      pattern: /.*/, // Match all
      requiresApproval: true,
      autoApprove: false,
      priority: 10,
    });

    this.logger.info('Default governance rules set up');
  }

  /**
   * Check if action should be auto-approved
   */
  private shouldAutoApprove(action: ProposedAction): boolean {
    for (const rule of this.governanceRules) {
      if (rule.pattern.test(action.type) || rule.pattern.test(action.description)) {
        if (rule.autoApprove) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if action should be auto-denied
   */
  private shouldAutoDeny(action: ProposedAction): boolean {
    // Add custom logic for auto-denial
    // For now, never auto-deny
    return false;
  }

  /**
   * Show approval dialog to user
   */
  private async showApprovalDialog(request: ApprovalRequest): Promise<void> {
    const action = request.action;

    const impactIcon = action.impact === 'high' ? '⚠️' : action.impact === 'medium' ? '⚡' : 'ℹ️';
    const reversibleText = action.reversible ? 'Reversible' : 'Not reversible';

    const message = `${impactIcon} Agent requests permission:\n\n${action.description}\n\nImpact: ${action.impact} | ${reversibleText}`;

    const result = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      'Approve',
      'Deny',
      'View Details'
    );

    if (result === 'View Details') {
      // Open dashboard with details
      await vscode.commands.executeCommand('agent.showDashboard');

      // Show dialog again
      setTimeout(() => this.showApprovalDialog(request), 500);
      return;
    }

    if (result === 'Approve' || result === 'Deny') {
      await this.handleApproval(request.id, result === 'Approve');
    } else {
      // User dismissed dialog - treat as denial
      await this.handleApproval(request.id, false, 'Dismissed');
    }
  }

  /**
   * Cancel a pending approval request
   */
  cancelApproval(requestId: string): boolean {
    const request = this.pendingApprovals.get(requestId);

    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'denied';
    request.response = 'Cancelled';

    const handler = this.approvalHandlers.get(requestId);
    if (handler) {
      clearTimeout(handler.timeout);
      handler.resolve(false);
      this.approvalHandlers.delete(requestId);
    }

    this.pendingApprovals.delete(requestId);
    return true;
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    // Clear all pending approvals
    for (const [requestId, handler] of this.approvalHandlers) {
      clearTimeout(handler.timeout);
      handler.resolve(false);
    }

    this.approvalHandlers.clear();
    this.pendingApprovals.clear();
    this.logger.info('HumanInTheLoopManager disposed');
  }
}
