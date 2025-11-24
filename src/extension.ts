import * as vscode from 'vscode';
import { ConfigurationManager, Logger, TelemetryManager } from './utils/index.js';
import { StateManager, PersistenceManager } from './state/index.js';
import { ToolRegistry, FileTool, ApiTool, TodoOperationsTool } from './tools/index.js';
import { WorkflowEngine, SampleWorkflow } from './workflows/index.js';
import { HumanInTheLoopManager, AuditLogger, ApprovalManager } from './governance/index.js';
import { CopilotAgent, TodoAgent } from './agents/index.js';
import { AgentDashboardProvider } from './ui/webviews/index.js';
import { ChatWebviewBridge } from './ui/bridge/index.js';

/**
 * Main extension context holder
 */
class ExtensionContext {
  public config!: ConfigurationManager;
  public logger!: Logger;
  public telemetry!: TelemetryManager;
  public state!: StateManager;
  public persistence!: PersistenceManager;
  public auditLogger!: AuditLogger;
  public toolRegistry!: ToolRegistry;
  public governanceManager!: HumanInTheLoopManager;
  public approvalManager!: ApprovalManager;
  public workflowEngine!: WorkflowEngine;
  public chatBridge!: ChatWebviewBridge;
  public copilotAgent!: CopilotAgent;
  public todoAgent!: TodoAgent;
  public dashboardProvider!: AgentDashboardProvider;

  constructor(public vscodeContext: vscode.ExtensionContext) {}
}

let extensionContext: ExtensionContext;

/**
 * Extension activation entry point
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger('Extension', false);
  logger.info('Agent Extension is activating...');

  try {
    // Initialize extension context
    extensionContext = new ExtensionContext(context);

    // Initialize core services
    await initializeCoreServices(extensionContext);

    // Register agents
    await registerAgents(extensionContext);

    // Register tools
    registerTools(extensionContext);

    // Register workflows
    registerWorkflows(extensionContext);

    // Register commands
    registerCommands(extensionContext);

    // Register webview provider
    registerWebviewProvider(extensionContext);

    // Track activation
    extensionContext.telemetry.trackActivation();

    logger.info('Agent Extension activated successfully');

    vscode.window.showInformationMessage(
      'Agent Extension activated! Use @agent in Copilot Chat to get started.'
    );
  } catch (error) {
    logger.error('Failed to activate extension', error);
    vscode.window.showErrorMessage(`Failed to activate Agent Extension: ${error}`);
    throw error;
  }
}

/**
 * Extension deactivation entry point
 */
export async function deactivate(): Promise<void> {
  const logger = new Logger('Extension', false);
  logger.info('Agent Extension is deactivating...');

  try {
    // Dispose governance manager
    if (extensionContext.governanceManager) {
      extensionContext.governanceManager.dispose();
    }

    // Dispose state manager
    if (extensionContext.state) {
      await extensionContext.state.dispose();
    }

    // Clean up logger
    Logger.dispose();

    logger.info('Agent Extension deactivated successfully');
  } catch (error) {
    logger.error('Error during deactivation', error);
  }
}

/**
 * Initialize core services
 */
async function initializeCoreServices(ctx: ExtensionContext): Promise<void> {
  ctx.logger = new Logger('Extension', false);

  // Configuration
  ctx.config = new ConfigurationManager();
  const config = ctx.config.getConfig();

  // Update logger with debug mode
  ctx.logger = new Logger('Extension', config.debugMode);

  // Telemetry
  ctx.telemetry = new TelemetryManager(config);

  // State management
  ctx.state = new StateManager(ctx.vscodeContext, config.debugMode);
  ctx.persistence = new PersistenceManager(ctx.vscodeContext, config.debugMode);

  // Audit logging
  ctx.auditLogger = new AuditLogger(ctx.vscodeContext, config);

  // Tool registry
  ctx.toolRegistry = new ToolRegistry(ctx.vscodeContext, ctx.auditLogger, config.debugMode);

  // Governance
  ctx.governanceManager = new HumanInTheLoopManager(config);
  ctx.approvalManager = new ApprovalManager(ctx.governanceManager, ctx.auditLogger);

  // Workflow engine
  ctx.workflowEngine = new WorkflowEngine(ctx.governanceManager, config);

  // Chat bridge
  ctx.chatBridge = new ChatWebviewBridge(config.debugMode);

  ctx.logger.info('Core services initialized');
}

/**
 * Register agents
 */
async function registerAgents(ctx: ExtensionContext): Promise<void> {
  // Create and register Copilot agent
  ctx.copilotAgent = new CopilotAgent(
    ctx.vscodeContext,
    ctx.toolRegistry,
    ctx.workflowEngine,
    ctx.config.getConfig(),
    ctx.governanceManager
  );

  await ctx.copilotAgent.register();

  // Create and register Todo agent
  ctx.todoAgent = new TodoAgent(
    ctx.vscodeContext,
    ctx.toolRegistry,
    ctx.workflowEngine,
    ctx.config.getConfig()
  );

  await ctx.todoAgent.register();

  ctx.logger.info('Agents registered');
}

/**
 * Register tools
 */
function registerTools(ctx: ExtensionContext): void {
  // Register built-in tools
  ctx.toolRegistry.register(new FileTool());
  ctx.toolRegistry.register(new ApiTool());
  ctx.toolRegistry.register(new TodoOperationsTool());

  // Track tool registration
  ctx.telemetry.trackEvent('tools.registered', {
    count: ctx.toolRegistry.getAllTools().length,
  });

  ctx.logger.info('Tools registered');
}

/**
 * Register workflows
 */
function registerWorkflows(ctx: ExtensionContext): void {
  // Register sample workflow
  ctx.workflowEngine.registerWorkflow('default', (request) => {
    return new SampleWorkflow(request, ctx.config.get('debugMode'));
  });

  ctx.workflowEngine.registerWorkflow('sample', (request) => {
    return new SampleWorkflow(request, ctx.config.get('debugMode'));
  });

  ctx.logger.info('Workflows registered');
}

/**
 * Register VSCode commands
 */
function registerCommands(ctx: ExtensionContext): void {
  // Show dashboard
  ctx.vscodeContext.subscriptions.push(
    vscode.commands.registerCommand('agent.showDashboard', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.agent-explorer');
    })
  );

  // Clear state
  ctx.vscodeContext.subscriptions.push(
    vscode.commands.registerCommand('agent.clearState', async () => {
      const result = await vscode.window.showWarningMessage(
        'Are you sure you want to clear all agent state? This cannot be undone.',
        { modal: true },
        'Clear'
      );

      if (result === 'Clear') {
        await ctx.state.clearState();
        await ctx.auditLogger.clearLogs();
        vscode.window.showInformationMessage('Agent state cleared');
      }
    })
  );

  // Create new agent (placeholder for scaffolding tool)
  ctx.vscodeContext.subscriptions.push(
    vscode.commands.registerCommand('agent.createAgent', async () => {
      vscode.window.showInformationMessage(
        'Use the CLI tool to create a new agent: npm run create-agent'
      );
    })
  );

  // Register tool command
  ctx.vscodeContext.subscriptions.push(
    vscode.commands.registerCommand('agent.registerTool', async () => {
      vscode.window.showInformationMessage(
        'See documentation for how to register custom tools'
      );
    })
  );

  ctx.logger.info('Commands registered');
}

/**
 * Register webview provider
 */
function registerWebviewProvider(ctx: ExtensionContext): void {
  ctx.dashboardProvider = new AgentDashboardProvider(
    ctx.vscodeContext.extensionUri,
    ctx.chatBridge,
    ctx.workflowEngine,
    ctx.toolRegistry,
    ctx.governanceManager
  );

  ctx.vscodeContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AgentDashboardProvider.viewType,
      ctx.dashboardProvider
    )
  );

  ctx.logger.info('Webview provider registered');
}

/**
 * Get extension context (for testing)
 */
export function getExtensionContext(): ExtensionContext | undefined {
  return extensionContext;
}
