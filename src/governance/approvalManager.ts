import { ApprovalRequest } from '../types/index.js';
import { HumanInTheLoopManager } from './humanInTheLoop.js';
import { AuditLogger } from './auditLogger.js';

/**
 * Higher-level manager for coordinating approvals with audit logging.
 * Wraps HumanInTheLoopManager with additional logging and tracking.
 */
export class ApprovalManager {
  constructor(
    private hitlManager: HumanInTheLoopManager,
    private auditLogger: AuditLogger
  ) {}

  /**
   * Request approval with automatic audit logging
   */
  async requestApproval(
    action: any,
    timeout?: number
  ): Promise<boolean> {
    const approved = await this.hitlManager.requestApproval(action, timeout);

    // Log the approval decision
    await this.auditLogger.logApproval(
      action.type || 'unknown',
      approved,
      action
    );

    return approved;
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return this.hitlManager.getPendingApprovals();
  }

  /**
   * Get approval history from audit logs
   */
  getApprovalHistory(): any[] {
    return this.auditLogger.getLogsByType('approval');
  }

  /**
   * Get approval statistics
   */
  getApprovalStats(): {
    total: number;
    approved: number;
    denied: number;
    pending: number;
    expired: number;
  } {
    const allApprovals = this.hitlManager.getAllApprovals();

    return {
      total: allApprovals.length,
      approved: allApprovals.filter((a) => a.status === 'approved').length,
      denied: allApprovals.filter((a) => a.status === 'denied').length,
      pending: allApprovals.filter((a) => a.status === 'pending').length,
      expired: allApprovals.filter((a) => a.status === 'expired').length,
    };
  }
}
