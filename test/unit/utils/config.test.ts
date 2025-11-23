import { expect } from 'chai';
import { ConfigurationManager } from '../../../src/utils/config';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  describe('Configuration Loading', () => {
    it('should load configuration', () => {
      const config = configManager.getConfig();

      expect(config).to.have.property('telemetryEnabled');
      expect(config).to.have.property('debugMode');
      expect(config).to.have.property('approvalTimeout');
      expect(config).to.have.property('maxConcurrentWorkflows');
      expect(config).to.have.property('autoApproveReadOnly');
    });

    it('should get specific config value', () => {
      const debugMode = configManager.get('debugMode');
      expect(debugMode).to.be.a('boolean');
    });
  });

  describe('Configuration Values', () => {
    it('should have reasonable defaults', () => {
      const config = configManager.getConfig();

      expect(config.approvalTimeout).to.be.greaterThan(0);
      expect(config.maxConcurrentWorkflows).to.be.greaterThan(0);
    });
  });

  describe('Configuration Change Handlers', () => {
    it('should register change handler', () => {
      let called = false;

      const disposable = configManager.onConfigurationChange(() => {
        called = true;
      });

      expect(disposable).to.have.property('dispose');
      disposable.dispose();
    });
  });
});
