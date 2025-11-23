import * as vscode from 'vscode';
import { ChatWebviewBridge } from '../bridge/chatWebviewBridge.js';
import { WorkflowEngine } from '../../workflows/workflowEngine.js';
import { ToolRegistry } from '../../tools/toolRegistry.js';
import { HumanInTheLoopManager } from '../../governance/humanInTheLoop.js';

/**
 * Provider for the agent dashboard webview
 */
export class AgentDashboardProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'agent.dashboard';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly bridge: ChatWebviewBridge,
    private readonly workflowEngine: WorkflowEngine,
    private readonly toolRegistry: ToolRegistry,
    private readonly governanceManager: HumanInTheLoopManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Connect bridge
    this.bridge.connect(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      await this.handleWebviewMessage(message);
    });

    // Send initial data
    this.sendDashboardData(webviewView.webview);

    // Update dashboard periodically
    const interval = setInterval(() => {
      if (webviewView.visible) {
        this.sendDashboardData(webviewView.webview);
      }
    }, 2000); // Update every 2 seconds

    // Clean up on dispose
    webviewView.onDidDispose(() => {
      clearInterval(interval);
    });
  }

  private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'approveAction':
        await this.governanceManager.handleApproval(message.requestId, true, message.comment);
        break;

      case 'denyAction':
        await this.governanceManager.handleApproval(message.requestId, false, message.comment);
        break;

      case 'cancelWorkflow':
        this.workflowEngine.cancelWorkflow(message.workflowId);
        break;

      case 'sendToChat':
        await this.bridge.sendToChatFromWebview(message.payload);
        break;

      case 'requestRefresh':
        // Send fresh data
        break;
    }
  }

  private sendDashboardData(webview: vscode.Webview): void {
    const data = {
      type: 'dashboardUpdate',
      payload: {
        workflows: this.workflowEngine.getActiveWorkflows(),
        tools: this.toolRegistry.getAllMetadata(),
        approvals: this.governanceManager.getPendingApprovals(),
        timestamp: Date.now(),
      },
    };

    webview.postMessage(data);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.css')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Agent Dashboard</title>
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>Agent Dashboard</h1>
            <button id="refresh-btn" class="button">Refresh</button>
        </header>

        <section class="dashboard-section">
            <h2>Active Workflows</h2>
            <div id="workflow-list" class="list-container">
                <div class="empty-state">No active workflows</div>
            </div>
        </section>

        <section class="dashboard-section">
            <h2>Pending Approvals</h2>
            <div id="approval-list" class="list-container">
                <div class="empty-state">No pending approvals</div>
            </div>
        </section>

        <section class="dashboard-section">
            <h2>Available Tools</h2>
            <div id="tool-list" class="list-container">
                <div class="empty-state">No tools registered</div>
            </div>
        </section>

        <section class="dashboard-section">
            <h2>Quick Actions</h2>
            <div class="action-buttons">
                <button id="clear-state-btn" class="button secondary">Clear State</button>
                <button id="view-logs-btn" class="button secondary">View Logs</button>
            </div>
        </section>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
