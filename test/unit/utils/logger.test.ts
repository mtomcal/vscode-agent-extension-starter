import { expect } from 'chai';
import { Logger } from '../../../src/utils/logger.js';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('TestComponent', false);
  });

  describe('Initialization', () => {
    it('should create logger with component name', () => {
      expect(logger).to.be.instanceOf(Logger);
    });

    it('should create logger with debug mode', () => {
      const debugLogger = new Logger('TestComponent', true);
      expect(debugLogger).to.be.instanceOf(Logger);
    });
  });

  describe('Logging Methods', () => {
    it('should log info message', () => {
      expect(() => logger.info('Test info message')).to.not.throw();
    });

    it('should log debug message in debug mode', () => {
      const debugLogger = new Logger('TestComponent', true);
      expect(() => debugLogger.debug('Test debug message')).to.not.throw();
    });

    it('should not log debug message without debug mode', () => {
      expect(() => logger.debug('Test debug message')).to.not.throw();
    });

    it('should log warning message', () => {
      expect(() => logger.warn('Test warning message')).to.not.throw();
    });

    it('should log error message', () => {
      expect(() => logger.error('Test error message')).to.not.throw();
    });

    it('should log error with Error object', () => {
      const error = new Error('Test error');
      expect(() => logger.error('Error occurred', error)).to.not.throw();
    });
  });

  describe('Static Methods', () => {
    it('should clear output channel', () => {
      expect(() => Logger.clear()).to.not.throw();
    });
  });
});
