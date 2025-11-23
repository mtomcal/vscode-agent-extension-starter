import { ExtensionConfig } from '../types/index.js';
import { Logger } from './logger.js';

/**
 * Telemetry manager for tracking extension usage.
 * Respects user's telemetry preferences.
 */
export class TelemetryManager {
  private logger: Logger;
  private enabled: boolean;
  private events: TelemetryEvent[] = [];

  constructor(private config: ExtensionConfig) {
    this.logger = new Logger('TelemetryManager', config.debugMode);
    this.enabled = config.telemetryEnabled;
  }

  /**
   * Track an event
   */
  trackEvent(
    eventName: string,
    properties?: Record<string, any>,
    measurements?: Record<string, number>
  ): void {
    if (!this.enabled) {
      return;
    }

    const event: TelemetryEvent = {
      name: eventName,
      timestamp: Date.now(),
      properties: properties || {},
      measurements: measurements || {},
    };

    this.events.push(event);
    this.logger.debug(`Event tracked: ${eventName}`, properties);

    // In a real implementation, this would send to a telemetry service
    // For now, we just log it
  }

  /**
   * Track extension activation
   */
  trackActivation(): void {
    this.trackEvent('extension.activated', {
      version: this.getExtensionVersion(),
    });
  }

  /**
   * Track agent creation
   */
  trackAgentCreated(agentType: string): void {
    this.trackEvent('agent.created', {
      agentType,
    });
  }

  /**
   * Track tool execution
   */
  trackToolExecution(toolId: string, success: boolean, duration: number): void {
    this.trackEvent(
      'tool.executed',
      {
        toolId,
        success,
      },
      {
        duration,
      }
    );
  }

  /**
   * Track workflow execution
   */
  trackWorkflowExecution(
    workflowName: string,
    success: boolean,
    iterations: number,
    duration: number
  ): void {
    this.trackEvent(
      'workflow.executed',
      {
        workflowName,
        success,
      },
      {
        iterations,
        duration,
      }
    );
  }

  /**
   * Track approval request
   */
  trackApprovalRequest(actionType: string, approved: boolean, duration: number): void {
    this.trackEvent(
      'approval.requested',
      {
        actionType,
        approved,
      },
      {
        duration,
      }
    );
  }

  /**
   * Track error
   */
  trackError(errorType: string, errorMessage: string, context?: Record<string, any>): void {
    this.trackEvent('error.occurred', {
      errorType,
      errorMessage,
      ...context,
    });
  }

  /**
   * Get all tracked events
   */
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * Clear all tracked events
   */
  clearEvents(): void {
    this.events = [];
    this.logger.debug('Telemetry events cleared');
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.enabled = true;
    this.logger.info('Telemetry enabled');
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.enabled = false;
    this.clearEvents();
    this.logger.info('Telemetry disabled');
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get extension version
   */
  private getExtensionVersion(): string {
    // In a real implementation, this would read from package.json
    return '0.0.1';
  }

  /**
   * Get telemetry summary
   */
  getSummary(): TelemetrySummary {
    const eventCounts: Record<string, number> = {};

    for (const event of this.events) {
      eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      eventCounts,
      enabled: this.enabled,
    };
  }
}

interface TelemetryEvent {
  name: string;
  timestamp: number;
  properties: Record<string, any>;
  measurements: Record<string, number>;
}

interface TelemetrySummary {
  totalEvents: number;
  eventCounts: Record<string, number>;
  enabled: boolean;
}
