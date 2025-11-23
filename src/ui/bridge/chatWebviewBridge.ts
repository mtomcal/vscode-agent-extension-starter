import * as vscode from 'vscode';
import { BridgeMessage } from '../../types/index.js';
import { Logger } from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Bridge for bidirectional communication between Copilot Chat and Webviews.
 * Enables chat messages to trigger webview updates and webview actions to send chat messages.
 */
export class ChatWebviewBridge {
  private webview: vscode.Webview | null = null;
  private messageQueue: BridgeMessage[] = [];
  private messageHandlers: Map<string, (message: BridgeMessage) => Promise<void>> = new Map();
  private logger: Logger;
  private maxQueueSize = 100;

  constructor(debugMode: boolean = false) {
    this.logger = new Logger('ChatWebviewBridge', debugMode);
  }

  /**
   * Connect a webview to the bridge
   */
  connect(webview: vscode.Webview): void {
    this.logger.info('Connecting webview to bridge');
    this.webview = webview;
    this.flushMessageQueue();
  }

  /**
   * Disconnect the current webview
   */
  disconnect(): void {
    this.logger.info('Disconnecting webview from bridge');
    this.webview = null;
  }

  /**
   * Send a message from chat to webview
   */
  async sendToWebviewFromChat(message: any): Promise<void> {
    const bridgeMessage: BridgeMessage = {
      type: 'chatUpdate',
      payload: message,
      timestamp: Date.now(),
      id: uuidv4(),
    };

    if (!this.webview) {
      this.logger.debug('Webview not connected, queuing message');
      this.queueMessage(bridgeMessage);
      return;
    }

    try {
      await this.webview.postMessage(bridgeMessage);
      this.logger.debug(`Message sent to webview: ${bridgeMessage.id}`);
    } catch (error) {
      this.logger.error('Failed to send message to webview', error);
      this.queueMessage(bridgeMessage);
    }
  }

  /**
   * Send a message from webview to chat
   */
  async sendToChatFromWebview(message: any): Promise<void> {
    this.logger.debug('Message received from webview for chat');

    const bridgeMessage: BridgeMessage = {
      type: 'webviewUpdate',
      payload: message,
      timestamp: Date.now(),
      id: uuidv4(),
    };

    // Call registered handlers
    const handler = this.messageHandlers.get(bridgeMessage.type);
    if (handler) {
      try {
        await handler(bridgeMessage);
      } catch (error) {
        this.logger.error('Handler failed for message', error);
      }
    }

    // In a real implementation, this would integrate with the Copilot Chat API
    // For now, we'll show a notification
    vscode.window.showInformationMessage(`Webview message: ${JSON.stringify(message)}`);
  }

  /**
   * Register a handler for a specific message type
   */
  registerHandler(
    messageType: string,
    handler: (message: BridgeMessage) => Promise<void>
  ): void {
    this.messageHandlers.set(messageType, handler);
    this.logger.debug(`Handler registered for: ${messageType}`);
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(messageType: string): void {
    this.messageHandlers.delete(messageType);
    this.logger.debug(`Handler unregistered for: ${messageType}`);
  }

  /**
   * Broadcast a message to all connected components
   */
  async broadcast(type: string, payload: any): Promise<void> {
    const message: BridgeMessage = {
      type,
      payload,
      timestamp: Date.now(),
      id: uuidv4(),
    };

    // Send to webview
    if (this.webview) {
      try {
        await this.webview.postMessage(message);
      } catch (error) {
        this.logger.error('Failed to broadcast to webview', error);
      }
    }

    // Call handlers
    const handler = this.messageHandlers.get(type);
    if (handler) {
      try {
        await handler(message);
      } catch (error) {
        this.logger.error('Handler failed for broadcast', error);
      }
    }
  }

  /**
   * Queue a message for later delivery
   */
  private queueMessage(message: BridgeMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.logger.warn('Message queue full, removing oldest message');
      this.messageQueue.shift();
    }

    this.messageQueue.push(message);
    this.logger.debug(`Message queued: ${message.id}, queue size: ${this.messageQueue.length}`);
  }

  /**
   * Flush the message queue when webview connects
   */
  private async flushMessageQueue(): Promise<void> {
    if (!this.webview || this.messageQueue.length === 0) {
      return;
    }

    this.logger.info(`Flushing ${this.messageQueue.length} queued messages`);

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        await this.webview.postMessage(message);
        this.logger.debug(`Queued message sent: ${message.id}`);
      } catch (error) {
        this.logger.error(`Failed to send queued message: ${message.id}`, error);
      }
    }
  }

  /**
   * Get the current queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear the message queue
   */
  clearQueue(): void {
    const size = this.messageQueue.length;
    this.messageQueue = [];
    this.logger.info(`Cleared ${size} queued messages`);
  }
}
