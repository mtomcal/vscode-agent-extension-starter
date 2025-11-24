import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { WorkflowEngine } from '../../../src/workflows/workflowEngine';
import { HumanInTheLoopManager } from '../../../src/governance/humanInTheLoop';
import { ExtensionConfig, Workflow, AgentRequest } from '../../../src/types';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let governanceManager: HumanInTheLoopManager;
  let config: ExtensionConfig;
  let vscodeStubs: any;

  beforeEach(() => {
    config = {
      debugMode: false,
      autoApproveReadOnly: true,
      approvalTimeout: 30000,
      maxConcurrentWorkflows: 3,
      logRetentionDays: 30,
      telemetryEnabled: false,
    };

    // Stub vscode
    const vscode = require('vscode');
    vscodeStubs = {
      showInformationMessage: sinon.stub(vscode.window, 'showInformationMessage'),
    };

    governanceManager = new HumanInTheLoopManager(config);
    engine = new WorkflowEngine(governanceManager, config);
  });

  afterEach(() => {
    governanceManager.dispose();
    sinon.restore();
  });

  // Helper to create a mock workflow
  function createMockWorkflow(options: {
    name?: string;
    requiresApproval?: boolean;
    success?: boolean;
    requiresIteration?: boolean;
  } = {}): Workflow {
    const {
      name = 'test-workflow',
      requiresApproval = false,
      success = true,
      requiresIteration = false,
    } = options;

    return {
      name,
      think: sinon.stub().resolves({
        plan: 'Test plan',
        steps: [{ id: 'step-1', description: 'Test step' }],
        requiresApproval,
        confidence: 0.9,
      }),
      act: sinon.stub().resolves([
        { stepId: 'step-1', success, result: 'done' },
      ]),
      observe: sinon.stub().resolves({
        success,
        requiresIteration,
        feedback: success ? 'Success' : 'Failed',
      }),
      refine: sinon.stub().callsFake(function() {
        // Return a new workflow that doesn't require iteration
        return createMockWorkflow({ ...options, requiresIteration: false });
      }),
    };
  }

  describe('registerWorkflow', () => {
    it('should register a workflow factory', () => {
      const factory = () => createMockWorkflow();
      engine.registerWorkflow('test', factory);

      const workflow = engine.createWorkflow('test', { id: '1', prompt: 'test', context: {}, metadata: {} });
      expect(workflow).to.not.be.null;
    });

    it('should allow registering multiple workflows', () => {
      engine.registerWorkflow('workflow1', () => createMockWorkflow({ name: 'workflow1' }));
      engine.registerWorkflow('workflow2', () => createMockWorkflow({ name: 'workflow2' }));

      const wf1 = engine.createWorkflow('workflow1', { id: '1', prompt: 'test', context: {}, metadata: {} });
      const wf2 = engine.createWorkflow('workflow2', { id: '2', prompt: 'test', context: {}, metadata: {} });

      expect(wf1?.name).to.equal('workflow1');
      expect(wf2?.name).to.equal('workflow2');
    });
  });

  describe('createWorkflow', () => {
    it('should create workflow from registered factory', () => {
      const factory = sinon.stub().returns(createMockWorkflow());
      engine.registerWorkflow('test', factory);

      const request: AgentRequest = {
        id: '1',
        prompt: 'test prompt',
        context: {},
        metadata: {},
      };

      const workflow = engine.createWorkflow('test', request);

      expect(workflow).to.not.be.null;
      expect(factory.calledOnce).to.be.true;
      expect(factory.calledWith(request)).to.be.true;
    });

    it('should return null for unregistered workflow', () => {
      const workflow = engine.createWorkflow('nonexistent', { id: '1', prompt: 'test', context: {}, metadata: {} });
      expect(workflow).to.be.null;
    });
  });

  describe('executeWorkflow', () => {
    it('should execute Think-Act-Observe cycle', async () => {
      const workflow = createMockWorkflow();

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).to.be.true;
      expect(result.iterations).to.equal(1);
      expect((workflow.think as sinon.SinonStub).calledOnce).to.be.true;
      expect((workflow.act as sinon.SinonStub).calledOnce).to.be.true;
      expect((workflow.observe as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('should return analysis, actions, and observations', async () => {
      const workflow = createMockWorkflow();

      const result = await engine.executeWorkflow(workflow);

      expect(result.analysis).to.have.property('plan', 'Test plan');
      expect(result.actions).to.have.length(1);
      expect(result.observations).to.have.property('success', true);
    });

    it('should handle workflow failure', async () => {
      const workflow = createMockWorkflow({ success: false });

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).to.be.false;
    });

    it('should iterate when required', async () => {
      let iteration = 0;
      const workflow: Workflow = {
        name: 'iterating-workflow',
        think: sinon.stub().resolves({
          plan: 'Test plan',
          steps: [],
          requiresApproval: false,
          confidence: 0.9,
        }),
        act: sinon.stub().resolves([]),
        observe: sinon.stub().callsFake(() => {
          iteration++;
          return {
            success: iteration >= 2,
            requiresIteration: iteration < 2,
            feedback: `Iteration ${iteration}`,
          };
        }),
        refine: sinon.stub().callsFake(function() { return this; }),
      };

      const result = await engine.executeWorkflow(workflow);

      expect(result.iterations).to.equal(2);
      expect((workflow.refine as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('should respect max iterations', async () => {
      const workflow: Workflow = {
        name: 'infinite-workflow',
        think: sinon.stub().resolves({
          plan: 'Test plan',
          steps: [],
          requiresApproval: false,
          confidence: 0.9,
        }),
        act: sinon.stub().resolves([]),
        observe: sinon.stub().resolves({
          success: false,
          requiresIteration: true, // Always wants more iterations
          feedback: 'Need more',
        }),
        refine: sinon.stub().callsFake(function() { return this; }),
      };

      const result = await engine.executeWorkflow(workflow);

      // Should stop at maxConcurrentWorkflows (3 in config)
      expect(result.iterations).to.equal(3);
      expect(result.success).to.be.false;
      expect(result.observations.feedback).to.include('Max iterations');
    });

    it('should handle cancellation', async () => {
      const workflow = createMockWorkflow();
      const token = {
        isCancellationRequested: true,
        onCancellationRequested: () => ({ dispose: () => {} }),
      };

      try {
        await engine.executeWorkflow(workflow, undefined, token as any);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.include('cancelled');
      }
    });

    it('should use stream for progress', async () => {
      const workflow = createMockWorkflow();
      const stream = {
        progress: sinon.stub(),
        markdown: sinon.stub(),
      };

      await engine.executeWorkflow(workflow, stream as any);

      expect(stream.progress.called).to.be.true;
    });
  });

  describe('executeWorkflow with governance', () => {
    it('should request approval when required', async () => {
      // Disable auto-approve
      config.autoApproveReadOnly = false;
      governanceManager = new HumanInTheLoopManager(config);
      engine = new WorkflowEngine(governanceManager, config);

      const workflow = createMockWorkflow({ requiresApproval: true });
      vscodeStubs.showInformationMessage.resolves('Approve');

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).to.be.true;
      expect(vscodeStubs.showInformationMessage.called).to.be.true;
    });

    it('should fail when approval denied', async () => {
      config.autoApproveReadOnly = false;
      governanceManager = new HumanInTheLoopManager(config);
      engine = new WorkflowEngine(governanceManager, config);

      const workflow = createMockWorkflow({ requiresApproval: true });
      vscodeStubs.showInformationMessage.resolves('Deny');

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).to.be.false;
      expect(result.observations.feedback).to.include('denied');
    });

    it('should skip approval when auto-approve enabled', async () => {
      config.autoApproveReadOnly = true;
      governanceManager = new HumanInTheLoopManager(config);
      engine = new WorkflowEngine(governanceManager, config);

      const workflow = createMockWorkflow({ requiresApproval: true });

      const result = await engine.executeWorkflow(workflow);

      expect(result.success).to.be.true;
      expect(vscodeStubs.showInformationMessage.called).to.be.false;
    });
  });

  describe('getActiveWorkflows', () => {
    it('should return empty array when no workflows', () => {
      const active = engine.getActiveWorkflows();
      expect(active).to.be.an('array');
      expect(active.length).to.equal(0);
    });

    it('should return active workflows during execution', async () => {
      let resolveAct: () => void;
      const actPromise = new Promise<void>(resolve => { resolveAct = resolve; });

      const workflow: Workflow = {
        name: 'slow-workflow',
        think: sinon.stub().resolves({
          plan: 'Test',
          steps: [],
          requiresApproval: false,
          confidence: 1,
        }),
        act: sinon.stub().callsFake(async () => {
          await actPromise;
          return [];
        }),
        observe: sinon.stub().resolves({
          success: true,
          requiresIteration: false,
          feedback: 'Done',
        }),
        refine: sinon.stub(),
      };

      // Start workflow but don't await
      const promise = engine.executeWorkflow(workflow);

      // Give it time to start
      await new Promise(resolve => setImmediate(resolve));

      // Should have active workflow
      const active = engine.getActiveWorkflows();
      expect(active.length).to.equal(1);
      expect(active[0].name).to.equal('slow-workflow');

      // Complete the workflow
      resolveAct!();
      await promise;
    });
  });

  describe('getWorkflowState', () => {
    it('should return undefined for unknown workflow', () => {
      const state = engine.getWorkflowState('unknown-id');
      expect(state).to.be.undefined;
    });
  });

  describe('cancelWorkflow', () => {
    it('should return false for unknown workflow', () => {
      const cancelled = engine.cancelWorkflow('unknown-id');
      expect(cancelled).to.be.false;
    });
  });
});
