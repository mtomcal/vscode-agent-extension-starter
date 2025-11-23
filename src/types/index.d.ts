import * as vscode from 'vscode';

export interface ExtensionConfig {
  telemetryEnabled: boolean;
  debugMode: boolean;
  approvalTimeout: number;
  maxConcurrentWorkflows: number;
  autoApproveReadOnly: boolean;
}

export interface ExtensionState {
  workflows: WorkflowState[];
  tools: ToolMetadata[];
  approvals: ApprovalRequest[];
  auditLog: AuditLogEntry[];
}

export interface WorkflowState {
  id: string;
  name: string;
  status: 'pending' | 'thinking' | 'acting' | 'observing' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  currentPhase?: WorkflowPhase;
  iterations: number;
  error?: string;
}

export interface WorkflowPhase {
  name: 'think' | 'act' | 'observe';
  status: 'pending' | 'in_progress' | 'completed';
  result?: any;
}

export interface AgentRequest {
  id: string;
  prompt: string;
  context: any;
  metadata: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parametersSchema: ToolParameterSchema;
  exposeToChat: boolean;
  requiresApproval: boolean;
  execute(parameters: any, context: ToolContext): Promise<ToolResult>;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: string;
  description: string;
  default?: any;
  enum?: any[];
}

export interface ToolContext {
  extensionContext: vscode.ExtensionContext;
  workspaceFolder?: vscode.WorkspaceFolder;
  cancellationToken?: vscode.CancellationToken;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  executionCount: number;
  lastExecuted?: number;
}

export interface Workflow {
  id: string;
  name: string;
  think(): Promise<Analysis>;
  act(analysis: Analysis): Promise<ActionResult[]>;
  observe(actions: ActionResult[]): Promise<Observations>;
  refine(observations: Observations): Workflow;
}

export interface Analysis {
  plan: string;
  steps: WorkflowStep[];
  requiresApproval: boolean;
  confidence: number;
}

export interface WorkflowStep {
  id: string;
  description: string;
  toolId?: string;
  parameters?: any;
  requiresApproval: boolean;
}

export interface ActionResult {
  stepId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export interface Observations {
  success: boolean;
  requiresIteration: boolean;
  feedback: string;
  improvements?: string[];
}

export interface WorkflowResult {
  success: boolean;
  analysis: Analysis;
  actions: ActionResult[];
  observations: Observations;
  iterations: number;
}

export interface ApprovalRequest {
  id: string;
  action: ProposedAction;
  timestamp: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  response?: string;
}

export interface ProposedAction {
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  reversible: boolean;
  details: Record<string, any>;
}

export interface GovernanceRule {
  id: string;
  pattern: RegExp;
  requiresApproval: boolean;
  autoApprove: boolean;
  priority: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  type: 'tool_execution' | 'approval' | 'workflow' | 'error';
  userId?: string;
  details: Record<string, any>;
}

export interface BridgeMessage {
  type: string;
  payload: any;
  timestamp: number;
  id: string;
}

export interface StateSubscriber {
  onStateChange(state: ExtensionState): void;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
