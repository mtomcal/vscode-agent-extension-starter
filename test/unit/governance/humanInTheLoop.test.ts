import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { HumanInTheLoopManager } from '../../../src/governance/humanInTheLoop';
import { ProposedAction, ExtensionConfig } from '../../../src/types';

describe('HumanInTheLoopManager', () => {
  let manager: HumanInTheLoopManager;
  let config: ExtensionConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vscodeStubs: any;

  beforeEach(() => {
    // Setup config
    config = {
      debugMode: false,
      autoApproveReadOnly: true,
      approvalTimeout: 30000, // Long timeout for tests
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
  });

  afterEach(() => {
    manager.dispose();
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

      const approved = await manager.requestApproval(action);

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

      const approved = await manager.requestApproval(action);

      expect(approved).to.be.false;
    });

    it('should timeout and deny after configured timeout', async function() {
      this.timeout(5000); // Extend mocha timeout

      const action: ProposedAction = {
        type: 'modify',
        description: 'Modify configuration',
        impact: 'medium',
        reversible: true,
      };

      // Never resolve the dialog
      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approved = await manager.requestApproval(action, 100); // Very short timeout

      expect(approved).to.be.false;
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

      const approved = await manager.requestApproval(action);

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

  describe('cancelApproval', () => {
    it('should return false for non-existent request', () => {
      const cancelled = manager.cancelApproval('non-existent-id');
      expect(cancelled).to.be.false;
    });
  });

  describe('handleApproval', () => {
    it('should resolve pending approval with approved status', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      // Never resolve to keep it pending
      let resolveDialog: (value: string | undefined) => void;
      vscodeStubs.showInformationMessage.returns(
        new Promise((resolve) => { resolveDialog = resolve; })
      );

      // Start the approval request
      const approvalPromise = manager.requestApproval(action, 30000);

      // Wait a tick for the request to be registered
      await new Promise(resolve => setImmediate(resolve));

      // Get the pending approval
      const pending = manager.getPendingApprovals();
      expect(pending.length).to.equal(1);

      // Manually handle approval
      await manager.handleApproval(pending[0].id, true, 'Test comment');

      const approved = await approvalPromise;
      expect(approved).to.be.true;
    });

    it('should resolve pending approval with denied status', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      // Never resolve to keep it pending
      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      // Start the approval request
      const approvalPromise = manager.requestApproval(action, 30000);

      // Wait a tick for the request to be registered
      await new Promise(resolve => setImmediate(resolve));

      // Get the pending approval
      const pending = manager.getPendingApprovals();
      expect(pending.length).to.equal(1);

      // Manually handle denial
      await manager.handleApproval(pending[0].id, false, 'Denied by test');

      const approved = await approvalPromise;
      expect(approved).to.be.false;
    });
  });

  describe('getPendingApprovals', () => {
    it('should return pending approvals', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      // Never resolve to keep it pending - must call BEFORE requestApproval
      vscodeStubs.showInformationMessage.callsFake(() => new Promise(() => {}));

      const approvalPromise = manager.requestApproval(action, 30000);

      // Wait for request to be registered
      await new Promise(resolve => setImmediate(resolve));

      // Debug: Check if stub was called
      expect(vscodeStubs.showInformationMessage.called).to.be.true;

      const pending = manager.getPendingApprovals();
      expect(pending.length).to.equal(1);
      expect(pending[0].action.description).to.equal('Write file');
      expect(pending[0].status).to.equal('pending');

      // Clean up - cancel the pending request
      manager.cancelApproval(pending[0].id);
      await approvalPromise;
    });

    it('should return empty array when no pending approvals', () => {
      const pending = manager.getPendingApprovals();
      expect(pending).to.be.an('array');
      expect(pending.length).to.equal(0);
    });
  });

  describe('getAllApprovals', () => {
    it('should return all approvals including completed', async () => {
      const action1: ProposedAction = {
        type: 'write',
        description: 'Write file 1',
        impact: 'medium',
        reversible: true,
      };

      // Resolve immediately
      vscodeStubs.showInformationMessage.resolves('Approve');

      await manager.requestApproval(action1);

      const all = manager.getAllApprovals();
      expect(all.length).to.equal(1);
      expect(all[0].status).to.equal('approved');
    });
  });

  describe('dispose', () => {
    it('should clean up pending approvals on dispose', async () => {
      const action: ProposedAction = {
        type: 'write',
        description: 'Write file',
        impact: 'medium',
        reversible: true,
      };

      // Never resolve to keep it pending
      vscodeStubs.showInformationMessage.returns(new Promise(() => {}));

      const approvalPromise = manager.requestApproval(action, 30000);

      // Wait for request to be registered
      await new Promise(resolve => setImmediate(resolve));

      expect(manager.getPendingApprovals().length).to.equal(1);

      manager.dispose();

      const approved = await approvalPromise;
      expect(approved).to.be.false;
      expect(manager.getPendingApprovals().length).to.equal(0);
    });
  });
});
