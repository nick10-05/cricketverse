type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  data?: Record<string, unknown>
  timestamp: number
  userId?: string
  url?: string
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const MAX_BATCH_SIZE = 10
const FLUSH_INTERVAL_MS = 30_000

class MonitoringService {
  private buffer: LogEntry[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private enabled = true
  private currentUserId: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)

      window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        this.captureException(event.reason, { type: 'unhandledRejection' })
      })

      window.addEventListener('error', (event: ErrorEvent) => {
        this.captureException(event.error || new Error(event.message), {
          type: 'uncaughtError',
          filename: event.filename,
          lineno: event.lineno,
        })
      })
    }
  }

  setUserId(uid: string | null) {
    this.currentUserId = uid
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data)
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log('error', message, data)
  }

  captureException(error: unknown, context?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error))
    this.log('error', err.message, {
      ...context,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    })
  }

  trackPerformance(operationName: string, durationMs: number, metadata?: Record<string, unknown>) {
    this.log('info', `PERF: ${operationName}`, {
      performance: true,
      operation: operationName,
      durationMs,
      ...metadata,
    })
  }

  trackPageView(page: string) {
    this.log('info', 'page_view', { page, referrer: document.referrer })
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (!this.enabled) return

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
      userId: this.currentUserId ?? undefined,
      url: window.location.href,
    }

    if (data?.error && typeof data.error === 'object') {
      entry.error = data.error as LogEntry['error']
    }

    this.buffer.push(entry)

    if (this.buffer.length >= MAX_BATCH_SIZE) {
      this.flush()
    }

    if (level === 'error') {
      console.error(`[CricketVerse] ${message}`, data)
    } else if (level === 'warn') {
      console.warn(`[CricketVerse] ${message}`, data)
    }
  }

  private flush() {
    if (this.buffer.length === 0) return

    const batch = this.buffer.splice(0, MAX_BATCH_SIZE)

    try {
      const payload = JSON.stringify(batch)

      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon('/api/logs', payload)
        if (!sent) {
          this.fallbackStore(batch)
        }
      } else {
        this.fallbackStore(batch)
      }
    } catch {
      this.fallbackStore(batch)
    }
  }

  private fallbackStore(batch: LogEntry[]) {
    try {
      const existing = JSON.parse(localStorage.getItem('cv_logs') || '[]')
      const updated = [...existing, ...batch].slice(-100)
      localStorage.setItem('cv_logs', JSON.stringify(updated))
    } catch {
      // Silently fail — localStorage might be full or disabled
    }
  }

  getQueuedLogs(): LogEntry[] {
    return [...this.buffer]
  }

  getStoredLogs(): LogEntry[] {
    try {
      return JSON.parse(localStorage.getItem('cv_logs') || '[]')
    } catch {
      return []
    }
  }

  clearStoredLogs() {
    localStorage.removeItem('cv_logs')
  }

  destroy() {
    this.flush()
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
  }
}

export const monitoring = new MonitoringService()
export type { LogEntry, LogLevel }
