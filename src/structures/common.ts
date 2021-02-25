/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SubscribePayload {
  readonly operationName?: string | null;
  readonly query: string;
  readonly variables?: Record<string, unknown> | null;
}

export interface Action<T = any> {
  type: T;
}

export interface AnyAction extends Action {
  [extraProps: string]: any;
}
