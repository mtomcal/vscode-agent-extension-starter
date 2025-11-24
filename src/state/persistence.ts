import * as vscode from 'vscode';
import { Logger } from '../utils/logger.js';

/**
 * Utility for persisting data to workspace storage.
 * Provides file-based persistence for larger data that shouldn't go in global state.
 */
export class PersistenceManager {
  private logger: Logger;

  constructor(
    private context: vscode.ExtensionContext,
    debugMode: boolean = false
  ) {
    this.logger = new Logger('PersistenceManager', debugMode);
  }

  /**
   * Save data to workspace storage
   */
  async saveToWorkspace(filename: string, data: any): Promise<void> {
    const storageUri = this.context.storageUri;

    if (!storageUri) {
      throw new Error('No workspace storage available');
    }

    try {
      // Ensure storage directory exists
      await vscode.workspace.fs.createDirectory(storageUri);

      const filePath = vscode.Uri.joinPath(storageUri, filename);
      const content = JSON.stringify(data, null, 2);

      await vscode.workspace.fs.writeFile(
        filePath,
        Buffer.from(content, 'utf-8')
      );

      this.logger.debug(`Data saved to workspace: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to save to workspace: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Load data from workspace storage
   */
  async loadFromWorkspace(filename: string): Promise<any> {
    const storageUri = this.context.storageUri;

    if (!storageUri) {
      throw new Error('No workspace storage available');
    }

    try {
      const filePath = vscode.Uri.joinPath(storageUri, filename);
      const content = await vscode.workspace.fs.readFile(filePath);
      const textDecoder = new TextDecoder('utf-8');
      const data = JSON.parse(textDecoder.decode(content));

      this.logger.debug(`Data loaded from workspace: ${filename}`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to load from workspace: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Check if file exists in workspace storage
   */
  async existsInWorkspace(filename: string): Promise<boolean> {
    const storageUri = this.context.storageUri;

    if (!storageUri) {
      return false;
    }

    try {
      const filePath = vscode.Uri.joinPath(storageUri, filename);
      await vscode.workspace.fs.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file from workspace storage
   */
  async deleteFromWorkspace(filename: string): Promise<void> {
    const storageUri = this.context.storageUri;

    if (!storageUri) {
      throw new Error('No workspace storage available');
    }

    try {
      const filePath = vscode.Uri.joinPath(storageUri, filename);
      await vscode.workspace.fs.delete(filePath);

      this.logger.debug(`Data deleted from workspace: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to delete from workspace: ${filename}`, error);
      throw error;
    }
  }

  /**
   * List all files in workspace storage
   */
  async listWorkspaceFiles(): Promise<string[]> {
    const storageUri = this.context.storageUri;

    if (!storageUri) {
      return [];
    }

    try {
      const entries = await vscode.workspace.fs.readDirectory(storageUri);
      return entries
        .filter(([_, type]) => type === vscode.FileType.File)
        .map(([name]) => name);
    } catch (error) {
      this.logger.error('Failed to list workspace files', error);
      return [];
    }
  }

  /**
   * Save data to global storage
   */
  async saveToGlobal(filename: string, data: any): Promise<void> {
    const storageUri = this.context.globalStorageUri;

    try {
      // Ensure storage directory exists
      await vscode.workspace.fs.createDirectory(storageUri);

      const filePath = vscode.Uri.joinPath(storageUri, filename);
      const content = JSON.stringify(data, null, 2);

      await vscode.workspace.fs.writeFile(
        filePath,
        Buffer.from(content, 'utf-8')
      );

      this.logger.debug(`Data saved to global storage: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to save to global storage: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Load data from global storage
   */
  async loadFromGlobal(filename: string): Promise<any> {
    const storageUri = this.context.globalStorageUri;

    try {
      const filePath = vscode.Uri.joinPath(storageUri, filename);
      const content = await vscode.workspace.fs.readFile(filePath);
      const textDecoder = new TextDecoder('utf-8');
      const data = JSON.parse(textDecoder.decode(content));

      this.logger.debug(`Data loaded from global storage: ${filename}`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to load from global storage: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Delete file from global storage
   */
  async deleteFromGlobal(filename: string): Promise<void> {
    const storageUri = this.context.globalStorageUri;

    try {
      const filePath = vscode.Uri.joinPath(storageUri, filename);
      await vscode.workspace.fs.delete(filePath);

      this.logger.debug(`Data deleted from global storage: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to delete from global storage: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Clear all workspace storage
   */
  async clearWorkspaceStorage(): Promise<void> {
    const storageUri = this.context.storageUri;

    if (!storageUri) {
      return;
    }

    try {
      await vscode.workspace.fs.delete(storageUri, { recursive: true });
      this.logger.info('Workspace storage cleared');
    } catch (error) {
      this.logger.error('Failed to clear workspace storage', error);
      throw error;
    }
  }

  /**
   * Clear all global storage
   */
  async clearGlobalStorage(): Promise<void> {
    const storageUri = this.context.globalStorageUri;

    try {
      await vscode.workspace.fs.delete(storageUri, { recursive: true });
      this.logger.info('Global storage cleared');
    } catch (error) {
      this.logger.error('Failed to clear global storage', error);
      throw error;
    }
  }
}
