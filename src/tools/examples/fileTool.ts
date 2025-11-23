import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from '../baseTool.js';
import { ToolContext, ToolParameterSchema, ToolResult } from '../../types/index.js';

/**
 * Tool for file operations (read, write, list)
 */
export class FileTool extends BaseTool {
  readonly id = 'file_operations';
  readonly name = 'File Operations';
  readonly description = 'Read, write, and list files in the workspace';
  readonly requiresApproval = true; // File writes should require approval

  readonly parametersSchema: ToolParameterSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'The operation to perform: read, write, list, or delete',
        enum: ['read', 'write', 'list', 'delete'],
      },
      path: {
        type: 'string',
        description: 'The file or directory path (relative to workspace)',
      },
      content: {
        type: 'string',
        description: 'Content to write (only for write operation)',
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        default: 'utf8',
      },
    },
    required: ['operation', 'path'],
  };

  async execute(parameters: any, context: ToolContext): Promise<ToolResult> {
    // Validate parameters
    const validation = this.validateParameters(parameters);
    if (!validation.valid) {
      return this.failure(`Invalid parameters: ${validation.errors?.join(', ')}`);
    }

    const { operation, path: filePath, content, encoding = 'utf8' } = parameters;

    try {
      // Get workspace folder
      const workspaceFolder =
        context.workspaceFolder || vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        return this.failure('No workspace folder open');
      }

      const absolutePath = path.join(workspaceFolder.uri.fsPath, filePath);

      // Execute the operation
      switch (operation) {
        case 'read':
          return await this.readFile(absolutePath, encoding);

        case 'write':
          if (!content) {
            return this.failure('Content parameter required for write operation');
          }
          return await this.writeFile(absolutePath, content, encoding);

        case 'list':
          return await this.listDirectory(absolutePath);

        case 'delete':
          return await this.deleteFile(absolutePath);

        default:
          return this.failure(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      return this.failure(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  private async readFile(filePath: string, encoding: string): Promise<ToolResult> {
    try {
      const content = await fs.readFile(filePath, encoding as BufferEncoding);
      return this.success({
        content,
        path: filePath,
        size: content.length,
      });
    } catch (error) {
      return this.failure(`Failed to read file: ${error}`);
    }
  }

  private async writeFile(
    filePath: string,
    content: string,
    encoding: string
  ): Promise<ToolResult> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content, encoding as BufferEncoding);
      return this.success({
        path: filePath,
        bytesWritten: content.length,
      });
    } catch (error) {
      return this.failure(`Failed to write file: ${error}`);
    }
  }

  private async listDirectory(dirPath: string): Promise<ToolResult> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));

      return this.success({
        path: dirPath,
        entries: files,
        count: files.length,
      });
    } catch (error) {
      return this.failure(`Failed to list directory: ${error}`);
    }
  }

  private async deleteFile(filePath: string): Promise<ToolResult> {
    try {
      await fs.unlink(filePath);
      return this.success({
        path: filePath,
        deleted: true,
      });
    } catch (error) {
      return this.failure(`Failed to delete file: ${error}`);
    }
  }
}
