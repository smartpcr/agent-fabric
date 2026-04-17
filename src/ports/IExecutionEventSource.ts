/** Port interface for subscribing to execution lifecycle events. */
export interface IExecutionEventSource {
  /** Subscribe to execution events; returns an unsubscribe callback. */
  subscribe(listener: (event: unknown) => void): () => void;
}
