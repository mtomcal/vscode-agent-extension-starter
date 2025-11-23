import * as vscode from 'vscode';
import { ExtensionConfig } from '../types/index.js';
import { Logger } from './logger.js';

/**
 * Configuration manager for the extension.
 * Manages loading and watching extension configuration.
 */
export class ConfigurationManager {
  private config: ExtensionConfig;
  private logger: Logger;
  private onChangeCallbacks: Set<(config: ExtensionConfig) => void> = new Set();

  constructor() {
    this.logger = new Logger('ConfigurationManager', false);
    this.config = this.loadConfig();
    this.setupConfigWatcher();
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<ExtensionConfig> {
    return { ...this.config };
  }

  /**
   * Get a specific config value
   */
  get<K extends keyof ExtensionConfig>(key: K): ExtensionConfig[K] {
    return this.config[key];
  }

  /**
   * Update a config value (writes to user settings)
   */
  async set<K extends keyof ExtensionConfig>(
    key: K,
    value: ExtensionConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('agentExtension');
    await workspaceConfig.update(this.configKeyToSettingKey(key), value, target);

    this.logger.info(`Configuration updated: ${String(key)} = ${value}`);
  }

  /**
   * Register a callback for config changes
   */
  onConfigurationChange(callback: (config: ExtensionConfig) => void): vscode.Disposable {
    this.onChangeCallbacks.add(callback);

    return new vscode.Disposable(() => {
      this.onChangeCallbacks.delete(callback);
    });
  }

  /**
   * Load configuration from workspace
   */
  private loadConfig(): ExtensionConfig {
    const workspaceConfig = vscode.workspace.getConfiguration('agentExtension');

    const config: ExtensionConfig = {
      telemetryEnabled: workspaceConfig.get('enableTelemetry', true),
      debugMode: workspaceConfig.get('debugMode', false),
      approvalTimeout: workspaceConfig.get('approvalTimeout', 30000),
      maxConcurrentWorkflows: workspaceConfig.get('maxConcurrentWorkflows', 5),
      autoApproveReadOnly: workspaceConfig.get('autoApproveReadOnly', true),
    };

    this.logger.info('Configuration loaded');
    return config;
  }

  /**
   * Set up configuration change watcher
   */
  private setupConfigWatcher(): void {
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('agentExtension')) {
        this.logger.info('Configuration changed, reloading');
        const oldConfig = this.config;
        this.config = this.loadConfig();

        // Notify callbacks
        for (const callback of this.onChangeCallbacks) {
          try {
            callback(this.config);
          } catch (error) {
            this.logger.error('Config change callback failed', error);
          }
        }

        // Log what changed
        this.logConfigChanges(oldConfig, this.config);
      }
    });
  }

  /**
   * Log configuration changes
   */
  private logConfigChanges(oldConfig: ExtensionConfig, newConfig: ExtensionConfig): void {
    for (const key of Object.keys(newConfig) as Array<keyof ExtensionConfig>) {
      if (oldConfig[key] !== newConfig[key]) {
        this.logger.info(`Config changed: ${String(key)}: ${oldConfig[key]} -> ${newConfig[key]}`);
      }
    }
  }

  /**
   * Convert config key to settings key
   */
  private configKeyToSettingKey(key: keyof ExtensionConfig): string {
    const keyMap: Record<keyof ExtensionConfig, string> = {
      telemetryEnabled: 'enableTelemetry',
      debugMode: 'debugMode',
      approvalTimeout: 'approvalTimeout',
      maxConcurrentWorkflows: 'maxConcurrentWorkflows',
      autoApproveReadOnly: 'autoApproveReadOnly',
    };

    return keyMap[key];
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration('agentExtension');
    const keys: Array<keyof ExtensionConfig> = [
      'telemetryEnabled',
      'debugMode',
      'approvalTimeout',
      'maxConcurrentWorkflows',
      'autoApproveReadOnly',
    ];

    for (const key of keys) {
      const settingKey = this.configKeyToSettingKey(key);
      await workspaceConfig.update(
        settingKey,
        undefined,
        vscode.ConfigurationTarget.Global
      );
    }

    this.config = this.loadConfig();
    this.logger.info('Configuration reset to defaults');
  }
}
