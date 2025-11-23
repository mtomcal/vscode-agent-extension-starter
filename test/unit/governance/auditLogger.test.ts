import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { AuditLogger } from '../../../src/governance/auditLogger';
import { ExtensionConfig } from '../../../src/types';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let mockContext: any;
  let config: ExtensionConfig;

  beforeEach(() => {
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

    config = {
      debugMode: true,
      autoApproveReadOnly: true,
      approvalTimeout: 5000,
      maxConcurrentWorkflows: 3,
      logRetentionDays: 30,
      telemetryEnabled: false,
    };

    auditLogger = new AuditLogger(mockContext, config);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('logToolExecution', () => {
    it('should log tool execution with correct details', async () => {
      await auditLogger.logToolExecution('file-read', {
        path: '/test/file.txt',
        encoding: 'utf8',
      });

      const logs = auditLogger.getAllLogs();
      expect(logs.length).to.equal(1);
      expect(logs[0].type).to.equal('tool_execution');
      expect(logs[0].details.toolId).to.equal('file-read');
      expect(logs[0].details.parameters.path).to.equal('/test/file.txt');
    });

    it('should include timestamp and unique ID', async () => {
      await auditLogger.logToolExecution('api-call', { endpoint: '/api/test' });

      const logs = auditLogger.getAllLogs();
      expect(logs[0].id).to.be.a('string');
      expect(logs[0].timestamp).to.be.a('number');
      expect(logs[0].timestamp).to.be.closeTo(Date.now(), 1000);
    });

    it('should persist logs to storage', async () => {
      await auditLogger.logToolExecution('test-tool', { param: 'value' });

      // Wait for async save
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stored = mockContext.globalState.get('auditLogs');
      expect(stored).to.not.be.undefined;
      expect(stored.length).to.equal(1);
    });
  });

  describe('logApproval', () => {
    it('should log approval decision', async () => {
      const action = {
        type: 'write',
        description: 'Write to file',
      };

      await auditLogger.logApproval('req-123', true, action, 'Looks safe');

      const logs = auditLogger.getAllLogs();
      expect(logs.length).to.equal(1);
      expect(logs[0].type).to.equal('approval');
      expect(logs[0].details.requestId).to.equal('req-123');
      expect(logs[0].details.approved).to.be.true;
      expect(logs[0].details.comment).to.equal('Looks safe');
    });

    it('should log denial with comment', async () => {
      const action = {
        type: 'delete',
        description: 'Delete file',
      };

      await auditLogger.logApproval('req-456', false, action, 'Too risky');

      const logs = auditLogger.getAllLogs();
      expect(logs[0].details.approved).to.be.false;
      expect(logs[0].details.comment).to.equal('Too risky');
    });
  });

  describe('logWorkflow', () => {
    it('should log workflow execution', async () => {
      await auditLogger.logWorkflow('wf-001', 'DataProcessing', 'completed', {
        duration: 1500,
        steps: 5,
      });

      const logs = auditLogger.getAllLogs();
      expect(logs.length).to.equal(1);
      expect(logs[0].type).to.equal('workflow');
      expect(logs[0].details.workflowId).to.equal('wf-001');
      expect(logs[0].details.workflowName).to.equal('DataProcessing');
      expect(logs[0].details.status).to.equal('completed');
      expect(logs[0].details.duration).to.equal(1500);
    });

    it('should include custom workflow details', async () => {
      await auditLogger.logWorkflow('wf-002', 'Analysis', 'failed', {
        error: 'Timeout',
        retries: 3,
      });

      const logs = auditLogger.getAllLogs();
      expect(logs[0].details.error).to.equal('Timeout');
      expect(logs[0].details.retries).to.equal(3);
    });
  });

  describe('logError', () => {
    it('should log error with stack trace', async () => {
      const error = new Error('Test error');
      const context = { operation: 'test', user: 'admin' };

      await auditLogger.logError(error, context);

      const logs = auditLogger.getAllLogs();
      expect(logs.length).to.equal(1);
      expect(logs[0].type).to.equal('error');
      expect(logs[0].details.message).to.equal('Test error');
      expect(logs[0].details.stack).to.include('Error: Test error');
      expect(logs[0].details.context).to.deep.equal(context);
    });

    it('should handle errors without stack traces', async () => {
      const error = new Error('Simple error');
      error.stack = undefined;

      await auditLogger.logError(error, {});

      const logs = auditLogger.getAllLogs();
      expect(logs[0].details.message).to.equal('Simple error');
      expect(logs[0].details.stack).to.be.undefined;
    });
  });

  describe('getAllLogs', () => {
    it('should return all log entries', async () => {
      await auditLogger.logToolExecution('tool1', {});
      await auditLogger.logToolExecution('tool2', {});
      await auditLogger.logApproval('req1', true, {});

      const logs = auditLogger.getAllLogs();
      expect(logs.length).to.equal(3);
    });

    it('should return copy of logs array', async () => {
      await auditLogger.logToolExecution('tool1', {});

      const logs1 = auditLogger.getAllLogs();
      const logs2 = auditLogger.getAllLogs();

      expect(logs1).to.not.equal(logs2);
      expect(logs1).to.deep.equal(logs2);
    });
  });

  describe('getLogsByType', () => {
    beforeEach(async () => {
      await auditLogger.logToolExecution('tool1', {});
      await auditLogger.logToolExecution('tool2', {});
      await auditLogger.logApproval('req1', true, {});
      await auditLogger.logWorkflow('wf1', 'Test', 'completed', {});
      await auditLogger.logError(new Error('Test'), {});
    });

    it('should filter logs by type', async () => {
      const toolLogs = auditLogger.getLogsByType('tool_execution');
      expect(toolLogs.length).to.equal(2);
      expect(toolLogs.every((log) => log.type === 'tool_execution')).to.be.true;
    });

    it('should return approval logs only', async () => {
      const approvalLogs = auditLogger.getLogsByType('approval');
      expect(approvalLogs.length).to.equal(1);
      expect(approvalLogs[0].type).to.equal('approval');
    });

    it('should return workflow logs only', async () => {
      const workflowLogs = auditLogger.getLogsByType('workflow');
      expect(workflowLogs.length).to.equal(1);
      expect(workflowLogs[0].type).to.equal('workflow');
    });

    it('should return error logs only', async () => {
      const errorLogs = auditLogger.getLogsByType('error');
      expect(errorLogs.length).to.equal(1);
      expect(errorLogs[0].type).to.equal('error');
    });
  });

  describe('getLogsByTimeRange', () => {
    it('should filter logs by time range', async () => {
      const startTime = Date.now();
      await auditLogger.logToolExecution('tool1', {});

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));
      const midTime = Date.now();

      await auditLogger.logToolExecution('tool2', {});
      const endTime = Date.now();

      const logsInRange = auditLogger.getLogsByTimeRange(midTime - 5, endTime + 5);
      expect(logsInRange.length).to.equal(1);
      expect(logsInRange[0].details.toolId).to.equal('tool2');
    });

    it('should return empty array when no logs in range', async () => {
      await auditLogger.logToolExecution('tool1', {});

      const futureStart = Date.now() + 10000;
      const futureEnd = Date.now() + 20000;

      const logs = auditLogger.getLogsByTimeRange(futureStart, futureEnd);
      expect(logs.length).to.equal(0);
    });

    it('should include logs at exact boundaries', async () => {
      const time1 = Date.now();
      await auditLogger.logToolExecution('tool1', {});

      const logs = auditLogger.getAllLogs();
      const timestamp = logs[0].timestamp;

      const inRange = auditLogger.getLogsByTimeRange(timestamp, timestamp);
      expect(inRange.length).to.equal(1);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', async () => {
      await auditLogger.logToolExecution('tool1', {});
      await auditLogger.logToolExecution('tool2', {});

      expect(auditLogger.getAllLogs().length).to.equal(2);

      await auditLogger.clearLogs();

      expect(auditLogger.getAllLogs().length).to.equal(0);
    });

    it('should persist cleared state to storage', async () => {
      await auditLogger.logToolExecution('tool1', {});
      await auditLogger.clearLogs();

      // Wait for async save
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stored = mockContext.globalState.get('auditLogs');
      expect(stored).to.be.an('array');
      expect(stored.length).to.equal(0);
    });
  });

  describe('exportLogs', () => {
    it('should export logs as JSON string', async () => {
      await auditLogger.logToolExecution('tool1', { param: 'value' });
      await auditLogger.logApproval('req1', true, { action: 'test' });

      const exported = auditLogger.exportLogs();

      expect(exported).to.be.a('string');

      const parsed = JSON.parse(exported);
      expect(parsed).to.be.an('array');
      expect(parsed.length).to.equal(2);
    });

    it('should export formatted JSON', async () => {
      await auditLogger.logToolExecution('tool1', {});

      const exported = auditLogger.exportLogs();

      // Check if it's pretty-printed (has newlines and indentation)
      expect(exported).to.include('\n');
      expect(exported).to.include('  ');
    });
  });

  describe('log trimming', () => {
    it('should trim logs when exceeding max entries', async () => {
      // Log more than max entries (max is 1000)
      for (let i = 0; i < 1005; i++) {
        await auditLogger.logToolExecution(`tool-${i}`, {});
      }

      const logs = auditLogger.getAllLogs();
      expect(logs.length).to.equal(1000);

      // Should keep the most recent entries
      expect(logs[logs.length - 1].details.toolId).to.equal('tool-1004');
      expect(logs[0].details.toolId).to.equal('tool-5');
    });
  });

  describe('persistence', () => {
    it('should load existing logs on initialization', async () => {
      const existingLogs = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          type: 'tool_execution' as const,
          details: { toolId: 'existing-tool', parameters: {} },
        },
      ];

      mockContext.globalState.data.set('auditLogs', existingLogs);

      const newLogger = new AuditLogger(mockContext, config);
      const logs = newLogger.getAllLogs();

      expect(logs.length).to.equal(1);
      expect(logs[0].id).to.equal('log-1');
    });

    it('should handle missing storage gracefully', () => {
      const newLogger = new AuditLogger(mockContext, config);
      const logs = newLogger.getAllLogs();

      expect(logs).to.be.an('array');
      expect(logs.length).to.equal(0);
    });

    it('should handle corrupted storage gracefully', () => {
      // Simulate corrupted data
      mockContext.globalState.get = () => {
        throw new Error('Storage corrupted');
      };

      const newLogger = new AuditLogger(mockContext, config);
      const logs = newLogger.getAllLogs();

      expect(logs).to.be.an('array');
      expect(logs.length).to.equal(0);
    });
  });
});
