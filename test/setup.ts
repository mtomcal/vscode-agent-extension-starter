/**
 * Test setup file that mocks the vscode module
 */

// Mock the vscode module before any tests run
import { Module } from 'module';

const originalRequire = Module.prototype.require;

// Create singleton mock object so stubs work correctly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vscodeMock: any = {
  Uri: {
    file: (path: string) => ({ fsPath: path, path, scheme: 'file', toString: () => path }),
    parse: (uri: string) => ({ fsPath: uri, path: uri, scheme: 'file' }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    joinPath: (...paths: any[]) => ({
      fsPath: paths.map(p => p.fsPath || p).join('/'),
      path: paths.map(p => p.path || p).join('/'),
      scheme: 'file',
    }),
  },
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3,
  },
  ChatLocation: {
    Panel: 1,
    Terminal: 2,
    Notebook: 3,
  },
  workspace: {
    fs: {
      createDirectory: async () => {},
      writeFile: async () => {},
      readFile: async () => Buffer.from('{}'),
      stat: async () => ({ type: 1, ctime: 0, mtime: 0, size: 0 }),
    },
    workspaceFolders: [],
    getConfiguration: () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: (key: string, defaultValue?: any) => defaultValue,
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
  },
  window: {
    showInformationMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showQuickPick: async () => undefined,
    createOutputChannel: () => ({
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      dispose: () => {},
      show: () => {},
      hide: () => {},
    }),
  },
  commands: {
    registerCommand: () => ({ dispose: () => {} }),
    executeCommand: async () => undefined,
  },
  chat: {
    createChatParticipant: () => ({
      iconPath: null,
      followupProvider: null,
      dispose: () => {},
    }),
  },
  EventEmitter: class {
    event = () => ({ dispose: () => {} });
    fire = () => {};
    dispose = () => {};
  },
  CancellationTokenSource: class {
    token = {
      isCancellationRequested: false,
      onCancellationRequested: () => ({ dispose: () => {} }),
    };
    cancel = () => {};
    dispose = () => {};
  },
  Disposable: class {
    private callOnDispose: () => void;
    constructor(callOnDispose: () => void) {
      this.callOnDispose = callOnDispose;
    }
    dispose() {
      this.callOnDispose();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static from(...disposables: { dispose(): any }[]) {
      return {
        dispose: () => disposables.forEach((d) => d.dispose()),
      };
    }
  },
};

// @ts-ignore
Module.prototype.require = function (id: string) {
  if (id === 'vscode') {
    return vscodeMock;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalRequire.apply(this, arguments as any);
};
