import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { HumanInTheLoopManager } from '../../../src/governance/humanInTheLoop';
import { ProposedAction, ExtensionConfig } from '../../../src/types';

describe('HumanInTheLoopManager', () => {
  let manager: HumanInTheLoopManager;
  let config: ExtensionConfig;
  let clock: sinon.SinonFakeTimers;
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

    // Stub vscode window
    const vscode = require('vscode');
    vscodeStubs = {
      showInformationMessage: sinon.stub(vscode.window, 'showInformationMessage'),
      executeCommand: sinon.stub(vscode.commands, 'executeCommand'),
    };

    // Create manager
    manager = new HumanInTheLoopManager(config);

    // Use fake timers
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    manager.dispose();
    clock.restore();
    sinon.restore();
  });

  describe('requestApproval', () => {
    it('should auto-approve read-only actions', async () => {
      const action: ProposedAction = {
        type: 'read',
        description: 'Read file contents',
        impact: 'low',
        reversible: true,
      };

      const approved = await manager.requestApproval(action);

      expect(approved).to.be.true;
      expect(vscodeStubs.showInformationMessage.called).to.be.false;
    });

    it('should auto-approve fetch operations', async () => {
      const action: ProposedAction = {
        type: 'fetch',
        description: 'Fetch API data',
        impact: 'low',
        reversible: true,
      };

      const approved = await manager.requestApproval(action);

      expect(approved).to.be.true;
    });

    it('should require approval for write operations', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write to file',
        impact: 'medium',
        reversible: true,
      };

      // Simulate user approval
      vscodeStubs.showInformationMessage.resolves('Approve');

      const approvalPromise = manager.requestApproval(action);

      // Fast-forward to allow showInformationMessage to be called
      await clock.tickAsync(0);

      // Wait for result
      const approved = await approvalPromise;

      expect(vscodeStubs.showInformationMessage.calledOnce).to.be.true;
      expect(approved).to.be.true;
    });

    it('should deny when user selects Deny', async () => {
      const action: ProposedAction = {
        type: 'delete',
        description: 'Delete file',
        impact: 'high',
        reversible: false,
      };

      // Simulate user denial
      vscodeStubs.showInformationMessage.resolves('Deny');

      const approvalPromise = manager.requestApproval(action);
      await clock.tickAsync(0);
      const approved = await approvalPromise;

      expect(approved).to.be.false;
    });

    it('should timeout and deny after configured timeout', async () => {
      const action: ProposedAction = {
        type: 'modify',
        description: 'Modify configuration',
        impact: 'medium',
        reversible: true,
      };

      // Never resolve the dialog
      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = manager.requestApproval(action, 1000);
      await clock.tickAsync(0);

      // Fast-forward past timeout
      await clock.tickAsync(1001);

      const approved = await approvalPromise;
      expect(approved).to.be.false;
    });

    it('should use default timeout when not specified', async () => {
      const action: ProposedAction = {
        type: 'create',
        description: 'Create new file',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = manager.requestApproval(action);
      await clock.tickAsync(0);

      // Fast-forward to just before default timeout
      await clock.tickAsync(4999);
      expect(manager.getPendingApprovals().length).to.equal(1);

      // Fast-forward past default timeout
      await clock.tickAsync(2);

      const approved = await approvalPromise;
      expect(approved).to.be.false;
      expect(manager.getPendingApprovals().length).to.equal(0);
    });

    it('should handle View Details option', async () => {
      const action: ProposedAction = {
        type: 'execute',
        description: 'Execute command',
        impact: 'high',
        reversible: false,
      };

      // First return 'View Details', then 'Approve'
      vscodeStubs.showInformationMessage
        .onFirstCall()
        .resolves('View Details')
        .onSecondCall()
        .resolves('Approve');

      vscodeStubs.executeCommand.resolves();

      const approvalPromise = manager.requestApproval(action);
      await clock.tickAsync(0);

      // Fast-forward past the 500ms delay for re-showing dialog
      await clock.tickAsync(501);

      const approved = await approvalPromise;

      expect(vscodeStubs.executeCommand.calledWith('agent.showDashboard')).to.be.true;
      expect(vscodeStubs.showInformationMessage.calledTwice).to.be.true;
      expect(approved).to.be.true;
    });

    it('should treat dismissed dialog as denial', async () => {
      const action: ProposedAction = {
        type: 'remove',
        description: 'Remove resource',
        impact: 'high',
        reversible: false,
      };

      // Return undefined (user dismissed)
      vscodeStubs.showInformationMessage.resolves(undefined);

      const approvalPromise = manager.requestApproval(action);
      await clock.tickAsync(0);
      const approved = await approvalPromise;

      expect(approved).to.be.false;
    });
  });

  describe('governance rules', () => {
    it('should add and retrieve governance rules', () => {
      const rule = {
        id: 'test-rule',
        pattern: /test/i,
        requiresApproval: true,
        autoApprove: false,
        priority: 200,
      };

      manager.addRule(rule);

      const rules = manager.getRules();
      const addedRule = rules.find((r) => r.id === 'test-rule');

      expect(addedRule).to.not.be.undefined;
      expect(addedRule!.priority).to.equal(200);
    });

    it('should sort rules by priority (highest first)', () => {
      const rule1 = {
        id: 'low-priority',
        pattern: /test/i,
        requiresApproval: true,
        autoApprove: false,
        priority: 10,
      };

      const rule2 = {
        id: 'high-priority',
        pattern: /test/i,
        requiresApproval: true,
        autoApprove: false,
        priority: 200,
      };

      manager.addRule(rule1);
      manager.addRule(rule2);

      const rules = manager.getRules();
      expect(rules[0].id).to.equal('high-priority');
    });

    it('should remove governance rules', () => {
      const rule = {
        id: 'removable-rule',
        pattern: /test/i,
        requiresApproval: true,
        autoApprove: false,
        priority: 100,
      };

      manager.addRule(rule);
      expect(manager.getRules().find((r) => r.id === 'removable-rule')).to.not.be.undefined;

      const removed = manager.removeRule('removable-rule');
      expect(removed).to.be.true;
      expect(manager.getRules().find((r) => r.id === 'removable-rule')).to.be.undefined;
    });

    it('should return false when removing non-existent rule', () => {
      const removed = manager.removeRule('non-existent');
      expect(removed).to.be.false;
    });

    it('should have default rules setup', () => {
      const rules = manager.getRules();
      expect(rules.length).to.be.greaterThan(0);

      const fileSystemRule = rules.find((r) => r.id === 'file-system-write');
      expect(fileSystemRule).to.not.be.undefined;

      const readOnlyRule = rules.find((r) => r.id === 'read-only');
      expect(readOnlyRule).to.not.be.undefined;
    });
  });

  describe('getPendingApprovals', () => {
    it('should return only pending approval requests', async () => {
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

      // Never resolve dialogs
      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      // Create two pending requests
      const promise1 = manager.requestApproval(action1);
      const promise2 = manager.requestApproval(action2);

      await clock.tickAsync(0);

      const pending = manager.getPendingApprovals();
      expect(pending.length).to.equal(2);

      // Clean up
      clock.tick(6000);
      await promise1;
      await promise2;
    });

    it('should not return expired or approved requests', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = manager.requestApproval(action, 1000);
      await clock.tickAsync(0);

      expect(manager.getPendingApprovals().length).to.equal(1);

      // Expire the request
      await clock.tickAsync(1001);
      await approvalPromise;

      expect(manager.getPendingApprovals().length).to.equal(0);
    });
  });

  describe('getAllApprovals', () => {
    it('should return all approval requests including completed', async () => {
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

      vscodeStubs.showInformationMessage
        .onFirstCall()
        .resolves('Approve')
        .onSecondCall()
        .returns(new Promise(() => {}));

      const promise1 = manager.requestApproval(action1);
      await clock.tickAsync(0);
      await promise1;

      const promise2 = manager.requestApproval(action2);
      await clock.tickAsync(0);

      const all = manager.getAllApprovals();
      expect(all.length).to.equal(2);

      // One approved, one pending
      const approved = all.filter((r) => r.status === 'approved');
      const pending = all.filter((r) => r.status === 'pending');

      expect(approved.length).to.equal(1);
      expect(pending.length).to.equal(1);

      // Clean up
      clock.tick(6000);
      await promise2;
    });
  });

  describe('cancelApproval', () => {
    it('should cancel pending approval request', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = manager.requestApproval(action);
      await clock.tickAsync(0);

      const pending = manager.getPendingApprovals();
      expect(pending.length).to.equal(1);

      const cancelled = manager.cancelApproval(pending[0].id);
      expect(cancelled).to.be.true;

      const approved = await approvalPromise;
      expect(approved).to.be.false;
      expect(manager.getPendingApprovals().length).to.equal(0);
    });

    it('should return false for non-existent request', () => {
      const cancelled = manager.cancelApproval('non-existent-id');
      expect(cancelled).to.be.false;
    });

    it('should return false for already completed request', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage.resolves('Approve');

      const approvalPromise = manager.requestApproval(action);
      await clock.tickAsync(0);
      await approvalPromise;

      const all = manager.getAllApprovals();
      const cancelled = manager.cancelApproval(all[0].id);

      expect(cancelled).to.be.false;
    });
  });

  describe('dispose', () => {
    it('should clear all pending approvals', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = manager.requestApproval(action);
      await clock.tickAsync(0);

      expect(manager.getPendingApprovals().length).to.equal(1);

      manager.dispose();

      const approved = await approvalPromise;
      expect(approved).to.be.false;
      expect(manager.getPendingApprovals().length).to.equal(0);
    });
  });
});
