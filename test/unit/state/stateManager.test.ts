import { expect } from 'chai';
import { StateManager } from '../../../src/state/stateManager';
import { ExtensionState, StateSubscriber } from '../../../src/types/index';
import { createMockExtensionContext } from '../../helpers/mocks';

describe('StateManager', () => {
  let stateManager: StateManager;
  let context: any;

  beforeEach(() => {
    context = createMockExtensionContext();
    stateManager = new StateManager(context, false);
  });

  afterEach(async () => {
    await stateManager.dispose();
  });

  describe('State Management', () => {
    it('should return current state', () => {
      const state = stateManager.getState();

      expect(state).to.have.property('workflows');
      expect(state).to.have.property('tools');
      expect(state).to.have.property('approvals');
      expect(state).to.have.property('auditLog');
    });

    it('should update state', async () => {
      await stateManager.updateState({
        workflows: [
          {
            id: 'test',
            name: 'Test',
            status: 'pending',
            startTime: Date.now(),
            iterations: 0,
          },
        ],
      });

      const state = stateManager.getState();
      expect(state.workflows).to.have.length(1);
      expect(state.workflows[0].id).to.equal('test');
    });

    it('should clear state', async () => {
      await stateManager.updateState({
        workflows: [
          {
            id: 'test',
            name: 'Test',
            status: 'pending',
            startTime: Date.now(),
            iterations: 0,
          },
        ],
      });

      await stateManager.clearState();

      const state = stateManager.getState();
      expect(state.workflows).to.have.length(0);
      expect(state.tools).to.have.length(0);
    });
  });

  describe('Specific Updates', () => {
    it('should update workflows', async () => {
      const workflows = [
        {
          id: 'test',
          name: 'Test',
          status: 'pending' as const,
          startTime: Date.now(),
          iterations: 0,
        },
      ];

      await stateManager.updateWorkflows(workflows);

      const state = stateManager.getState();
      expect(state.workflows).to.deep.equal(workflows);
    });

    it('should update tools', async () => {
      const tools = [
        {
          id: 'tool1',
          name: 'Tool 1',
          description: 'Test tool',
          executionCount: 0,
        },
      ];

      await stateManager.updateTools(tools);

      const state = stateManager.getState();
      expect(state.tools).to.deep.equal(tools);
    });
  });

  describe('Subscribers', () => {
    it('should notify subscribers on state change', async () => {
      let notified = false;
      let receivedState: ExtensionState | null = null;

      const subscriber: StateSubscriber = {
        onStateChange: (state: ExtensionState) => {
          notified = true;
          receivedState = state;
        },
      };

      stateManager.subscribeToChanges(subscriber);

      await stateManager.updateState({
        workflows: [],
      });

      // Wait for debounced notification
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(notified).to.be.true;
      expect(receivedState).to.not.be.null;
    });

    it('should return unsubscribe function', () => {
      const subscriber: StateSubscriber = {
        onStateChange: () => {},
      };

      const unsubscribe = stateManager.subscribeToChanges(subscriber);

      expect(stateManager.getSubscriberCount()).to.equal(1);

      unsubscribe();

      expect(stateManager.getSubscriberCount()).to.equal(0);
    });
  });

  describe('Export/Import', () => {
    it('should export state as JSON', async () => {
      await stateManager.updateState({
        workflows: [
          {
            id: 'test',
            name: 'Test',
            status: 'pending',
            startTime: Date.now(),
            iterations: 0,
          },
        ],
      });

      const json = stateManager.exportState();
      expect(json).to.be.a('string');

      const parsed = JSON.parse(json);
      expect(parsed.workflows).to.have.length(1);
    });

    it('should import state from JSON', async () => {
      const stateToImport: ExtensionState = {
        workflows: [
          {
            id: 'imported',
            name: 'Imported',
            status: 'completed',
            startTime: Date.now(),
            iterations: 1,
          },
        ],
        tools: [],
        approvals: [],
        auditLog: [],
      };

      await stateManager.importState(JSON.stringify(stateToImport));

      const state = stateManager.getState();
      expect(state.workflows).to.have.length(1);
      expect(state.workflows[0].id).to.equal('imported');
    });

    it('should reject invalid state JSON', async () => {
      try {
        await stateManager.importState('{ "invalid": true }');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });
});
