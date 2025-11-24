import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { FileTool } from '../../../src/tools/examples/fileTool';
import { ToolContext } from '../../../src/types';

// Since fs/promises can't be stubbed directly in modern Node.js,
// we test the tool's parameter validation and error handling logic

describe('FileTool', () => {
  let tool: FileTool;
  let context: ToolContext;

  beforeEach(() => {
    tool = new FileTool();

    // Create context with workspace folder
    context = {
      extensionContext: {} as any,
      workspaceFolder: {
        uri: { fsPath: '/test/workspace' },
        name: 'test-workspace',
        index: 0,
      } as any,
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(tool.id).to.equal('file_operations');
    });

    it('should have correct name', () => {
      expect(tool.name).to.equal('File Operations');
    });

    it('should have correct description', () => {
      expect(tool.description).to.include('file');
    });

    it('should require approval', () => {
      expect(tool.requiresApproval).to.be.true;
    });

    it('should have valid parameter schema', () => {
      expect(tool.parametersSchema).to.have.property('type', 'object');
      expect(tool.parametersSchema.required).to.include('operation');
      expect(tool.parametersSchema.required).to.include('path');
    });

    it('should have operation enum in schema', () => {
      const operationProp = tool.parametersSchema.properties?.operation as any;
      expect(operationProp.enum).to.include('read');
      expect(operationProp.enum).to.include('write');
      expect(operationProp.enum).to.include('list');
      expect(operationProp.enum).to.include('delete');
    });
  });

  describe('parameter validation', () => {
    it('should fail with missing operation', async () => {
      const result = await tool.execute(
        { path: 'test.txt' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid parameters');
    });

    it('should fail with missing path', async () => {
      const result = await tool.execute(
        { operation: 'read' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid parameters');
    });

    it('should fail without workspace folder', async () => {
      // Mock vscode.workspace.workspaceFolders
      const vscode = require('vscode');
      const originalFolders = vscode.workspace.workspaceFolders;
      vscode.workspace.workspaceFolders = undefined;

      const contextNoWorkspace = {
        extensionContext: {} as any,
        workspaceFolder: undefined,
      };

      const result = await tool.execute(
        { operation: 'read', path: 'test.txt' },
        contextNoWorkspace
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('No workspace folder');

      // Restore
      vscode.workspace.workspaceFolders = originalFolders;
    });

    it('should fail with unknown operation', async () => {
      const result = await tool.execute(
        { operation: 'unknown', path: 'test.txt' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Unknown operation');
    });

    it('should fail write without content', async () => {
      const result = await tool.execute(
        { operation: 'write', path: 'test.txt' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Content parameter required');
    });
  });

  describe('read operation', () => {
    it('should attempt to read file at correct path', async () => {
      // This will fail because the file doesn't exist, but we can verify error handling
      const result = await tool.execute(
        { operation: 'read', path: 'nonexistent.txt' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Failed to read file');
    });
  });

  describe('write operation', () => {
    it('should attempt to write file', async () => {
      // This will fail because we can't write to /test/workspace
      const result = await tool.execute(
        { operation: 'write', path: 'test.txt', content: 'content' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Failed to write file');
    });
  });

  describe('list operation', () => {
    it('should attempt to list directory', async () => {
      const result = await tool.execute(
        { operation: 'list', path: 'nonexistent' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Failed to list directory');
    });
  });

  describe('delete operation', () => {
    it('should attempt to delete file', async () => {
      const result = await tool.execute(
        { operation: 'delete', path: 'nonexistent.txt' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Failed to delete file');
    });
  });

  describe('validateParameters', () => {
    it('should validate required parameters', () => {
      const validation = tool.validateParameters({});
      expect(validation.valid).to.be.false;
      expect(validation.errors).to.not.be.empty;
    });

    it('should accept valid parameters', () => {
      const validation = tool.validateParameters({
        operation: 'read',
        path: 'test.txt',
      });
      expect(validation.valid).to.be.true;
    });
  });
});
