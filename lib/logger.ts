type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, any>;

const isBrowser = typeof window !== 'undefined';

function getBaseContext() {
  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    url: isBrowser ? window.location.href : undefined,
    userAgent: isBrowser ? navigator.userAgent : undefined,
  };
}

function formatError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function sendToSentry(error: Error, context?: LogContext) {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/nextjs');
    Sentry.captureException(error, { contexts: { custom: context || {} } });
  } catch (sentryError) {
    console.error('Sentry capture failed:', sentryError);
  }
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    ...getBaseContext(),
    ...(context ? { context } : {}),
  };

  if (level === 'error') {
    console.error(payload);
    return;
  }
  if (level === 'warn') {
    console.warn(payload);
    return;
  }
  if (level === 'info') {
    console.info(payload);
    return;
  }
  console.debug(payload);
}

export const logger = {
  debug(message: string, context?: LogContext) {
    emit('debug', message, context);
  },
  info(message: string, context?: LogContext) {
    emit('info', message, context);
  },
  warn(message: string, context?: LogContext) {
    emit('warn', message, context);
  },
  error(error: Error | string, context?: LogContext) {
    if (typeof error === 'string') {
      emit('error', error, context);
      return;
    }

    const errorContext = {
      ...context,
      error: formatError(error),
    };
    emit('error', error.message, errorContext);
    sendToSentry(error, errorContext);
  },
};
