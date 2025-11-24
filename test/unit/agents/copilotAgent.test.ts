import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { CopilotAgent } from '../../../src/agents/copilotAgent';
import { HumanInTheLoopManager } from '../../../src/governance/humanInTheLoop';
import { ExtensionConfig } from '../../../src/types';
import { MockChatResponseStream } from '../../helpers/mocks';

describe('CopilotAgent', () => {
  let agent: CopilotAgent;
  let mockContext: any;
  let mockToolRegistry: any;
  let mockWorkflowEngine: any;
  let config: ExtensionConfig;
  let governanceManager: HumanInTheLoopManager;
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

    // Mock extension context
    mockContext = {
      extensionUri: { fsPath: '/test/extension' },
      extensionPath: '/test/extension',
      subscriptions: [],
      globalState: {
        get: () => undefined,
        update: async () => {},
        keys: () => [],
        setKeysForSync: () => {},
      },
    };

    // Mock tool registry
    mockToolRegistry = {
      getAllTools: sinon.stub().returns([
        { id: 'test-tool', name: 'Test Tool', description: 'A test tool' },
        { id: 'another-tool', name: 'Another Tool', description: 'Another test tool' },
      ]),
      getTool: sinon.stub(),
    };

    // Mock workflow engine
    mockWorkflowEngine = {
      createWorkflow: sinon.stub(),
      executeWorkflow: sinon.stub(),
      getActiveWorkflows: sinon.stub().returns([]),
    };

    // Stub vscode
    const vscode = require('vscode');
    vscodeStubs = {
      showInformationMessage: sinon.stub(vscode.window, 'showInformationMessage'),
      createChatParticipant: sinon.stub(vscode.chat || {}, 'createChatParticipant').returns({
        iconPath: null,
        followupProvider: null,
        dispose: () => {},
      }),
    };

    // Create governance manager
    governanceManager = new HumanInTheLoopManager(config);

    // Create agent
    agent = new CopilotAgent(
      mockContext,
      mockToolRegistry,
      mockWorkflowEngine,
      config,
      governanceManager
    );
  });

  afterEach(() => {
    governanceManager.dispose();
    sinon.restore();
  });

  describe('getName', () => {
    it('should return CopilotAgent', () => {
      expect(agent.getName()).to.equal('CopilotAgent');
    });
  });

  describe('processRequest', () => {
    it('should process a request and return success when workflow succeeds', async () => {
      const mockWorkflow = {
        think: sinon.stub().resolves({ plan: 'test plan', steps: [] }),
        act: sinon.stub().resolves([]),
        observe: sinon.stub().resolves({ success: true, feedback: 'Done' }),
      };

      mockWorkflowEngine.createWorkflow.returns(mockWorkflow);
      mockWorkflowEngine.executeWorkflow.resolves({
        success: true,
        iterations: 1,
        steps: [],
      });

      const request = {
        id: 'test-1',
        prompt: 'Test prompt',
        context: {},
        metadata: {},
      };

      const response = await agent.processRequest(request);

      expect(response.success).to.be.true;
      expect(response.result).to.not.be.undefined;
    });

    it('should return error when workflow fails', async () => {
      mockWorkflowEngine.createWorkflow.returns(null);
      mockWorkflowEngine.executeWorkflow.rejects(new Error('Workflow not found'));

      const request = {
        id: 'test-2',
        prompt: 'Test prompt',
        context: {},
        metadata: {},
      };

      const response = await agent.processRequest(request);

      expect(response.success).to.be.false;
      expect(response.error).to.include('Error:');
    });
  });

  describe('handleCopilotChat', () => {
    it('should handle tools command', async () => {
      const mockRequest = {
        prompt: '',
        command: 'tools',
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      expect(stream.messages.some(m => m.includes('Available Tools'))).to.be.true;
      expect(stream.messages.some(m => m.includes('Test Tool'))).to.be.true;
    });

    it('should handle status command with no active workflows', async () => {
      const mockRequest = {
        prompt: '',
        command: 'status',
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      mockWorkflowEngine.getActiveWorkflows.returns([]);

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      expect(stream.messages.some(m => m.includes('Workflow Status'))).to.be.true;
      expect(stream.messages.some(m => m.includes('No active workflows'))).to.be.true;
    });

    it('should handle status command with active workflows', async () => {
      const mockRequest = {
        prompt: '',
        command: 'status',
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      mockWorkflowEngine.getActiveWorkflows.returns([
        { id: 'wf-1', name: 'Test Workflow', status: 'running', iterations: 2 },
      ]);

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      expect(stream.messages.some(m => m.includes('Test Workflow'))).to.be.true;
      expect(stream.messages.some(m => m.includes('running'))).to.be.true;
    });

    it('should handle execute command with workflow execution', async () => {
      const mockRequest = {
        prompt: 'Execute something',
        command: 'execute',
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      const mockWorkflow = {
        think: sinon.stub().resolves({
          plan: 'Test plan',
          steps: [{ id: 'step-1', description: 'Step 1' }],
          requiresApproval: false,
        }),
        act: sinon.stub().resolves([
          { stepId: 'step-1', success: true },
        ]),
        observe: sinon.stub().resolves({
          success: true,
          feedback: 'All steps completed successfully',
          requiresIteration: false,
        }),
      };

      mockWorkflowEngine.createWorkflow.returns(mockWorkflow);

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      expect(stream.messages.some(m => m.includes('Think'))).to.be.true;
      expect(stream.messages.some(m => m.includes('Act'))).to.be.true;
      expect(stream.messages.some(m => m.includes('Observe'))).to.be.true;
    });

    it('should handle execute command requiring approval', async () => {
      const mockRequest = {
        prompt: 'Execute something dangerous',
        command: 'execute',
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      const mockWorkflow = {
        think: sinon.stub().resolves({
          plan: 'Dangerous operation',
          steps: [{ id: 'step-1', description: 'Dangerous step' }],
          requiresApproval: true,
        }),
        act: sinon.stub().resolves([{ stepId: 'step-1', success: true }]),
        observe: sinon.stub().resolves({ success: true, feedback: 'Done' }),
      };

      mockWorkflowEngine.createWorkflow.returns(mockWorkflow);

      // Stub approval to resolve immediately
      vscodeStubs.showInformationMessage.resolves('Approve');

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      // Should show approval required message
      expect(stream.messages.some(m => m.includes('requires approval'))).to.be.true;
    });

    it('should handle execute command when workflow creation fails', async () => {
      const mockRequest = {
        prompt: 'Execute something',
        command: 'execute',
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      mockWorkflowEngine.createWorkflow.returns(null);

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      expect(stream.messages.some(m => m.includes('Failed to create workflow'))).to.be.true;
    });

    it('should handle default requests', async () => {
      const mockRequest = {
        prompt: 'Hello agent',
        command: undefined,
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      mockWorkflowEngine.createWorkflow.returns({
        think: sinon.stub().resolves({ plan: 'test', steps: [] }),
        act: sinon.stub().resolves([]),
        observe: sinon.stub().resolves({ success: true }),
      });
      mockWorkflowEngine.executeWorkflow.resolves({ success: true, iterations: 1 });

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      expect(stream.progressMessages.some(m => m.includes('Processing'))).to.be.true;
    });

    it('should handle errors gracefully', async () => {
      const mockRequest = {
        prompt: 'Cause error',
        command: 'execute',
        references: [],
      };
      const mockChatContext = { history: [] };
      const stream = new MockChatResponseStream();
      const token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) };

      mockWorkflowEngine.createWorkflow.throws(new Error('Test error'));

      await agent.handleCopilotChat(
        mockRequest as any,
        mockChatContext as any,
        stream as any,
        token as any
      );

      expect(stream.messages.some(m => m.includes('❌'))).to.be.true;
    });
  });

  describe('provideFollowups', () => {
    it('should provide followup suggestions', async () => {
      // Access protected method via any cast
      const followups = await (agent as any).provideFollowups({}, {}, {});

      expect(followups).to.be.an('array');
      expect(followups.length).to.equal(2);
      expect(followups[0].command).to.equal('tools');
      expect(followups[1].command).to.equal('status');
    });
  });

  describe('formatError', () => {
    it('should format Error objects', () => {
      const error = new Error('Test error message');
      const formatted = (agent as any).formatError(error);

      expect(formatted).to.equal('Error: Test error message');
    });

    it('should format non-Error values', () => {
      const formatted = (agent as any).formatError('string error');

      expect(formatted).to.equal('string error');
    });

    it('should format null/undefined', () => {
      const formatted = (agent as any).formatError(null);

      expect(formatted).to.equal('null');
    });
  });
});
