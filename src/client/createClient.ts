import { executeOperation, Sink, UnSubscriber } from './executeOperation';
import { SubscribePayload } from '../structures';
import {
  Event,
  EventClosedListener,
  EventConnectedListener,
  EventConnectingListener,
  EventListener,
  forwardClosedEvent,
  forwardConnectedEvent,
  forwardConnectingEvent,
} from './instrumentation';
import { mainClientLoop } from './mainClientLoop';
import { makeDefaultRunner, SagaRunner } from './runner';

export interface ClientOptions {
  url: string;
  wsImpl?: unknown;
  connectionParams?:
    | Record<string, unknown>
    | (() => Promise<Record<string, unknown>>)
    | (() => Record<string, unknown>);
  on?: Partial<{ [event in Event]: EventListener<event> }>;
  onError?: (error: Error) => void;
}

export interface Client {
  dispose(): Promise<void>;
  onConnecting(listener: EventConnectingListener): void;
  onConnected(listener: EventConnectedListener): void;
  onClosed(listener: EventClosedListener): void;
  subscribe<T = unknown>(
    payload: SubscribePayload,
    sink: Sink<T>
  ): UnSubscriber;
}

export function createClient(
  options: ClientOptions,
  runner?: SagaRunner
): Client {
  let actualRunner: SagaRunner;

  if (!runner) {
    actualRunner = makeDefaultRunner();
  } else {
    actualRunner = runner;
  }

  const mainSaga = actualRunner.run(mainClientLoop, options);

  mainSaga.toPromise().catch(options.onError);

  return {
    dispose() {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          mainSaga.cancel();
          mainSaga.toPromise().then(resolve, reject);
        }, 0);
      });
    },
    onConnecting(listener: EventConnectingListener) {
      actualRunner
        .run(forwardConnectingEvent, listener)
        .toPromise()
        .catch(options.onError);
    },
    onConnected(listener: EventConnectedListener) {
      actualRunner
        .run(forwardConnectedEvent, listener)
        .toPromise()
        .catch(options.onError);
    },
    onClosed(listener: EventClosedListener) {
      actualRunner
        .run(forwardClosedEvent, listener)
        .toPromise()
        .catch(options.onError);
    },
    subscribe<T = unknown>(
      payload: SubscribePayload,
      sink: Sink<T>
    ): UnSubscriber {
      const subscription = actualRunner.run(executeOperation, payload, sink);

      subscription.toPromise().catch(options.onError);

      return () => {
        setTimeout(() => {
          subscription.cancel();
        }, 0);
      };
    },
  };
}
