import { log, error, warn } from '../../logger.js';

describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('log', () => {
    it('should output INFO message to console.log', () => {
      log('test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] test message');
    });
  });

  describe('error', () => {
    it('should output ERROR message to console.error', () => {
      error('error message');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message');
    });
  });

  describe('warn', () => {
    it('should output WARN message to console.warn', () => {
      warn('warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] warning message');
    });
  });
});
