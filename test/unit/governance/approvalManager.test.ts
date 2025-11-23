import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ApprovalManager } from '../../../src/governance/approvalManager';
import { HumanInTheLoopManager } from '../../../src/governance/humanInTheLoop';
import { AuditLogger } from '../../../src/governance/auditLogger';
import { ProposedAction, ExtensionConfig } from '../../../src/types';

describe('ApprovalManager', () => {
  let approvalManager: ApprovalManager;
  let hitlManager: HumanInTheLoopManager;
  let auditLogger: AuditLogger;
  let mockContext: any;
  let config: ExtensionConfig;
  let vscodeStubs: any;

  beforeEach(() => {
    // Setup config
    config = {
      debugMode: false,
      autoApproveReadOnly: true,
      approvalTimeout: 5000,
      maxConcurrentWorkflows: 3,
      logRetentionDays: 30,
      telemetryEnabled: false,
    };

    // Mock extension context
    mockContext = {
      globalState: {
        data: new Map(),
        get: function (key: string) {
          return this.data.get(key);
        },
        update: async function (key: string, value: any) {
          this.data.set(key, value);
        },
        keys: function () {
          return Array.from(this.data.keys());
        },
        setKeysForSync: function () {},
      },
      subscriptions: [],
      extensionPath: '/test/path',
      extensionUri: { fsPath: '/test/path' },
      extensionMode: 3,
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/logs',
    };

    // Stub vscode
    const vscode = require('vscode');
    vscodeStubs = {
      showInformationMessage: sinon.stub(vscode.window, 'showInformationMessage'),
    };

    // Create instances
    hitlManager = new HumanInTheLoopManager(config);
    auditLogger = new AuditLogger(mockContext, config);
    approvalManager = new ApprovalManager(hitlManager, auditLogger);
  });

  afterEach(() => {
    hitlManager.dispose();
    sinon.restore();
  });

  describe('requestApproval', () => {
    it('should request approval and log the decision', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write to file',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage.resolves('Approve');

      const approved = await approvalManager.requestApproval(action);

      expect(approved).to.be.true;

      // Check that approval was logged
      const approvalLogs = auditLogger.getLogsByType('approval');
      expect(approvalLogs.length).to.equal(1);
      expect(approvalLogs[0].details.approved).to.be.true;
    });

    it('should log denial decisions', async () => {
      const action: ProposedAction = {
        type: 'delete',
        description: 'Delete file',
        impact: 'high',
        reversible: false,
      };

      vscodeStubs.showInformationMessage.resolves('Deny');

      const approved = await approvalManager.requestApproval(action);

      expect(approved).to.be.false;

      const approvalLogs = auditLogger.getLogsByType('approval');
      expect(approvalLogs.length).to.equal(1);
      expect(approvalLogs[0].details.approved).to.be.false;
    });

    it('should handle auto-approved actions', async () => {
      const action: ProposedAction = {
        type: 'read',
        description: 'Read file',
        impact: 'low',
        reversible: true,
      };

      const approved = await approvalManager.requestApproval(action);

      expect(approved).to.be.true;
      expect(vscodeStubs.showInformationMessage.called).to.be.false;

      // Should still be logged
      const approvalLogs = auditLogger.getLogsByType('approval');
      expect(approvalLogs.length).to.equal(1);
    });

    it('should pass timeout to HITL manager', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      const requestApprovalSpy = sinon.spy(hitlManager, 'requestApproval');

      vscodeStubs.showInformationMessage.resolves('Approve');

      await approvalManager.requestApproval(action, 10000);

      expect(requestApprovalSpy.calledWith(action, 10000)).to.be.true;
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals from HITL manager', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      // Never resolve
      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = approvalManager.requestApproval(action);

      // Small delay to allow promise to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      const pending = approvalManager.getPendingApprovals();
      expect(pending.length).to.equal(1);
      expect(pending[0].action.description).to.equal('Write file');

      // Clean up
      hitlManager.cancelApproval(pending[0].id);
      await approvalPromise;
    });

    it('should return empty array when no pending approvals', () => {
      const pending = approvalManager.getPendingApprovals();
      expect(pending).to.be.an('array');
      expect(pending.length).to.equal(0);
    });
  });

  describe('getApprovalHistory', () => {
    it('should return approval history from audit logs', async () => {
      const action1: ProposedAction = {
        type: 'write',
        description: 'Write file 1',
        impact: 'medium',
        reversible: true,
      };

      const action2: ProposedAction = {
        type: 'write',
        description: 'Write file 2',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage.resolves('Approve');

      await approvalManager.requestApproval(action1);
      await approvalManager.requestApproval(action2);

      const history = approvalManager.getApprovalHistory();
      expect(history.length).to.equal(2);
      expect(history.every((log) => log.type === 'approval')).to.be.true;
    });

    it('should return empty array when no approval history', () => {
      const history = approvalManager.getApprovalHistory();
      expect(history).to.be.an('array');
      expect(history.length).to.equal(0);
    });
  });

  describe('getApprovalStats', () => {
    it('should return statistics for all approval statuses', async () => {
      const approvedAction: ProposedAction = {
        type: 'write',
        description: 'Approved action',
        impact: 'medium',
        reversible: true,
      };

      const deniedAction: ProposedAction = {
        type: 'delete',
        description: 'Denied action',
        impact: 'high',
        reversible: false,
      };

      const pendingAction: ProposedAction = {
        type: 'modify',
        description: 'Pending action',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage
        .onCall(0)
        .resolves('Approve')
        .onCall(1)
        .resolves('Deny')
        .onCall(2)
        .returns(new Promise(() => {}));

      await approvalManager.requestApproval(approvedAction);
      await approvalManager.requestApproval(deniedAction);
      const pendingPromise = approvalManager.requestApproval(pendingAction);

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = approvalManager.getApprovalStats();

      expect(stats.total).to.equal(3);
      expect(stats.approved).to.equal(1);
      expect(stats.denied).to.equal(1);
      expect(stats.pending).to.equal(1);
      expect(stats.expired).to.equal(0);

      // Clean up
      const pending = hitlManager.getPendingApprovals();
      hitlManager.cancelApproval(pending[0].id);
      await pendingPromise;
    });

    it('should count expired approvals', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Will expire',
        impact: 'medium',
        reversible: true,
      };

      // Use fake timers
      const clock = sinon.useFakeTimers();

      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = approvalManager.requestApproval(action, 1000);

      // Fast-forward past timeout
      clock.tick(1001);
      await approvalPromise;

      const stats = approvalManager.getApprovalStats();
      expect(stats.expired).to.equal(1);

      clock.restore();
    });

    it('should return zero stats when no approvals', () => {
      const stats = approvalManager.getApprovalStats();

      expect(stats.total).to.equal(0);
      expect(stats.approved).to.equal(0);
      expect(stats.denied).to.equal(0);
      expect(stats.pending).to.equal(0);
      expect(stats.expired).to.equal(0);
    });
  });

  describe('integration', () => {
    it('should coordinate HITL and audit logging correctly', async () => {
      const action: ProposedAction = {
        type: 'execute',
        description: 'Execute command',
        impact: 'high',
        reversible: false,
      };

      vscodeStubs.showInformationMessage.resolves('Approve');

      // Request approval
      const approved = await approvalManager.requestApproval(action);

      // Check HITL manager
      const allApprovals = hitlManager.getAllApprovals();
      expect(allApprovals.length).to.equal(1);
      expect(allApprovals[0].status).to.equal('approved');

      // Check audit logger
      const approvalLogs = auditLogger.getLogsByType('approval');
      expect(approvalLogs.length).to.equal(1);
      expect(approvalLogs[0].details.approved).to.be.true;

      // Check stats
      const stats = approvalManager.getApprovalStats();
      expect(stats.approved).to.equal(1);
      expect(stats.total).to.equal(1);

      expect(approved).to.be.true;
    });

    it('should maintain consistency between history and stats', async () => {
      const actions = [
        {
          type: 'write',
          description: 'Action 1',
          impact: 'medium' as const,
          reversible: true,
        },
        {
          type: 'write',
          description: 'Action 2',
          impact: 'medium' as const,
          reversible: true,
        },
        {
          type: 'write',
          description: 'Action 3',
          impact: 'medium' as const,
          reversible: true,
        },
      ];

      vscodeStubs.showInformationMessage
        .onCall(0)
        .resolves('Approve')
        .onCall(1)
        .resolves('Deny')
        .onCall(2)
        .resolves('Approve');

      for (const action of actions) {
        await approvalManager.requestApproval(action);
      }

      const history = approvalManager.getApprovalHistory();
      const stats = approvalManager.getApprovalStats();

      expect(history.length).to.equal(3);
      expect(stats.total).to.equal(3);
      expect(stats.approved).to.equal(2);
      expect(stats.denied).to.equal(1);
    });
  });
});
