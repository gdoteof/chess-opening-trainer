/** A line-oriented UCI connection to an engine. */
export interface UciTransport {
  send(command: string): void
  listen(listener: (line: string) => void): () => void
  terminate(): void
}

export function workerTransport(worker: Worker): UciTransport {
  const listeners = new Set<(line: string) => void>()
  worker.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') return
    for (const line of event.data.split('\n')) {
      if (line) listeners.forEach((listener) => listener(line))
    }
  }
  return {
    send: (command) => worker.postMessage(command),
    listen(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    terminate: () => worker.terminate(),
  }
}
