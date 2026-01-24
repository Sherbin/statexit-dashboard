import { log, error, warn, logger, LogLevel } from '../../logger.js';

describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    logger.setLevel('info'); // Reset to default
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('legacy functions', () => {
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

  describe('Logger class', () => {
    describe('setLevel and getLevel', () => {
      it('should set and get log level', () => {
        logger.setLevel('debug');
        expect(logger.getLevel()).toBe('debug');

        logger.setLevel('error');
        expect(logger.getLevel()).toBe('error');
      });
    });

    describe('info', () => {
      it('should log info messages with timestamp and stage', () => {
        logger.info('TEST', 'test message');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\d{4}-\d{2}-\d{2}T.*\[INFO\] \[TEST\] test message/)
        );
      });

      it('should include data when provided', () => {
        logger.info('TEST', 'with data', { key: 'value' });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[TEST]'),
          expect.stringContaining('"key":"value"')
        );
      });
    });

    describe('debug', () => {
      it('should not log when level is info', () => {
        logger.setLevel('info');
        logger.debug('TEST', 'debug message');

        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      it('should log when level is debug', () => {
        logger.setLevel('debug');
        logger.debug('TEST', 'debug message');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[DEBUG]')
        );
      });
    });

    describe('warn', () => {
      it('should log to console.warn', () => {
        logger.warn('TEST', 'warning');

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[WARN]')
        );
      });

      it('should not log when level is error', () => {
        logger.setLevel('error');
        logger.warn('TEST', 'warning');

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe('error', () => {
      it('should log to console.error', () => {
        logger.error('TEST', 'error message');

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]')
        );
      });

      it('should always log regardless of level', () => {
        logger.setLevel('error');
        logger.error('TEST', 'error message');

        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe('log levels hierarchy', () => {
      it('should respect log level hierarchy', () => {
        logger.setLevel('warn');

        logger.debug('TEST', 'debug');
        logger.info('TEST', 'info');
        logger.warn('TEST', 'warn');
        logger.error('TEST', 'error');

        expect(consoleLogSpy).not.toHaveBeenCalled(); // debug and info filtered
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      });
    });
  });
});
