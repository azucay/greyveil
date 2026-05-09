type Callback<T = unknown> = (data: T) => void

class TypedEventEmitter {
  private listeners: Map<string, Callback[]> = new Map()

  on<T>(event: string, callback: Callback<T>): void {
    const existing = this.listeners.get(event) ?? []
    this.listeners.set(event, [...existing, callback as Callback])
  }

  off<T>(event: string, callback: Callback<T>): void {
    const existing = this.listeners.get(event) ?? []
    this.listeners.set(event, existing.filter((cb) => cb !== (callback as Callback)))
  }

  emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event) ?? []
    callbacks.forEach((cb) => cb(data))
  }
}

export const EventBus = new TypedEventEmitter()
