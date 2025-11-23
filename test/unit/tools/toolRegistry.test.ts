import { expect } from 'chai';
import { ToolRegistry } from '../../../src/tools/toolRegistry';
import { BaseTool } from '../../../src/tools/baseTool';
import { AuditLogger } from '../../../src/governance/auditLogger';
import { ToolContext, ToolParameterSchema, ToolResult } from '../../../src/types/index';
import { createMockExtensionContext, createMockToolContext } from '../../helpers/mocks';

class MockTool extends BaseTool {
  readonly id = 'mock_tool';
  readonly name = 'Mock Tool';
  readonly description = 'A mock tool';
  readonly parametersSchema: ToolParameterSchema = {
    type: 'object',
    properties: {},
  };

  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    return this.success({ executed: true });
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let auditLogger: AuditLogger;
  let context: any;

  beforeEach(() => {
    context = createMockExtensionContext();
    auditLogger = new AuditLogger(context, {
      telemetryEnabled: false,
      debugMode: false,
      approvalTimeout: 30000,
      maxConcurrentWorkflows: 5,
      autoApproveReadOnly: true,
    });
    registry = new ToolRegistry(context, auditLogger, false);
  });

  describe('Tool Registration', () => {
    it('should register a tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      expect(registry.hasTool('mock_tool')).to.be.true;
      expect(registry.getTool('mock_tool')).to.equal(tool);
    });

    it('should overwrite existing tool with warning', () => {
      const tool1 = new MockTool();
      const tool2 = new MockTool();

      registry.register(tool1);
      registry.register(tool2);

      expect(registry.getTool('mock_tool')).to.equal(tool2);
    });

    it('should unregister a tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      const result = registry.unregister('mock_tool');
      expect(result).to.be.true;
      expect(registry.hasTool('mock_tool')).to.be.false;
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = registry.unregister('non_existent');
      expect(result).to.be.false;
    });
  });

  describe('Tool Execution', () => {
    it('should execute a registered tool', async () => {
      const tool = new MockTool();
      registry.register(tool);

      const result = await registry.executeTool(
        'mock_tool',
        {},
        createMockToolContext()
      );

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({ executed: true });
    });

    it('should fail when executing non-existent tool', async () => {
      const result = await registry.executeTool(
        'non_existent',
        {},
        createMockToolContext()
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });

    it('should update metadata on execution', async () => {
      const tool = new MockTool();
      registry.register(tool);

      await registry.executeTool('mock_tool', {}, createMockToolContext());

      const metadata = registry.getMetadata('mock_tool');
      expect(metadata?.executionCount).to.equal(1);
      expect(metadata?.lastExecuted).to.be.a('number');
    });
  });

  describe('Tool Queries', () => {
    it('should get all tools', () => {
      const tool1 = new MockTool();
      registry.register(tool1);

      const tools = registry.getAllTools();
      expect(tools).to.have.length(1);
      expect(tools[0]).to.equal(tool1);
    });

    it('should filter tools by predicate', () => {
      const tool1 = new MockTool();
      registry.register(tool1);

      const filtered = registry.getToolsByFilter(
        (tool) => tool.id === 'mock_tool'
      );

      expect(filtered).to.have.length(1);
      expect(filtered[0]).to.equal(tool1);
    });

    it('should get all metadata', () => {
      const tool1 = new MockTool();
      registry.register(tool1);

      const metadata = registry.getAllMetadata();
      expect(metadata).to.have.length(1);
      expect(metadata[0].id).to.equal('mock_tool');
    });
  });
});
