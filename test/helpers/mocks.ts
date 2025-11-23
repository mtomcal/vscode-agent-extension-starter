import * as vscode from 'vscode';
import { ToolContext } from '../../src/types/index';

/**
 * Mock VSCode Extension Context
 */
export function createMockExtensionContext(): vscode.ExtensionContext {
  const globalState = new Map<string, any>();
  const workspaceState = new Map<string, any>();

  return {
    subscriptions: [],
    workspaceState: {
      get: (key: string, defaultValue?: any) => workspaceState.get(key) ?? defaultValue,
      update: async (key: string, value: any) => {
        workspaceState.set(key, value);
      },
      keys: () => Array.from(workspaceState.keys()),
    } as any,
    globalState: {
      get: (key: string, defaultValue?: any) => globalState.get(key) ?? defaultValue,
      update: async (key: string, value: any) => {
        globalState.set(key, value);
      },
      keys: () => Array.from(globalState.keys()),
      setKeysForSync: () => {},
    } as any,
    extensionUri: vscode.Uri.file('/mock/extension/path'),
    extensionPath: '/mock/extension/path',
    asAbsolutePath: (relativePath: string) => `/mock/extension/path/${relativePath}`,
    storageUri: vscode.Uri.file('/mock/storage'),
    storagePath: '/mock/storage',
    globalStorageUri: vscode.Uri.file('/mock/global/storage'),
    globalStoragePath: '/mock/global/storage',
    logUri: vscode.Uri.file('/mock/logs'),
    logPath: '/mock/logs',
    extensionMode: vscode.ExtensionMode.Test,
    extension: {} as any,
    environmentVariableCollection: {} as any,
    secrets: {} as any,
    languageModelAccessInformation: {} as any,
  } as vscode.ExtensionContext;
}

/**
 * Mock Tool Context
 */
export function createMockToolContext(
  overrides?: Partial<ToolContext>
): ToolContext {
  return {
    extensionContext: createMockExtensionContext(),
    workspaceFolder: undefined,
    cancellationToken: undefined,
    ...overrides,
  };
}

/**
 * Mock Cancellation Token
 */
export function createMockCancellationToken(
  isCancelled: boolean = false
): vscode.CancellationToken {
  return {
    isCancellationRequested: isCancelled,
    onCancellationRequested: () => ({ dispose: () => {} }),
  } as vscode.CancellationToken;
}

/**
 * Mock Workspace Folder
 */
export function createMockWorkspaceFolder(
  name: string = 'test-workspace',
  path: string = '/test/workspace'
): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.file(path),
    name,
    index: 0,
  };
}

/**
 * Mock Chat Request
 */
export function createMockChatRequest(
  prompt: string,
  command?: string
): vscode.ChatRequest {
  return {
    prompt,
    command,
    references: [],
    location: vscode.ChatLocation.Panel,
    attempt: 0,
    enableCommandDetection: true,
  } as vscode.ChatRequest;
}

/**
 * Mock Chat Context
 */
export function createMockChatContext(): vscode.ChatContext {
  return {
    history: [],
  } as vscode.ChatContext;
}

/**
 * Mock Chat Response Stream
 */
export class MockChatResponseStream implements vscode.ChatResponseStream {
  public messages: string[] = [];
  public progressMessages: string[] = [];

  markdown(value: string): void {
    this.messages.push(value);
  }

  progress(value: string): void {
    this.progressMessages.push(value);
  }

  anchor(value: vscode.Uri | vscode.Location, title?: string): void {
    // Mock implementation
  }

  button(command: vscode.Command): void {
    // Mock implementation
  }

  filetree(value: vscode.ChatResponseFileTree[], baseUri: vscode.Uri): void {
    // Mock implementation
  }

  push(part: vscode.ChatResponsePart): void {
    // Mock implementation
  }

  reference(value: vscode.Uri | vscode.Location, iconPath?: vscode.ThemeIcon): void {
    // Mock implementation
  }
}
