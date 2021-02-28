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
  /**
   * Where to connect to.
   */
  url: string;
  /**
   * Custom WebSocket implementation, if needed.
   */
  wsImpl?: unknown;
  /**
   * Connection params passed through the connection_init message.
   */
  connectionParams?:
    | Record<string, unknown>
    | (() => Promise<Record<string, unknown>>)
    | (() => Record<string, unknown>);
  /**
   * Attach event listeners before creating the instance of the client.
   * These event listeners will not lose any events.
   */
  on?: Partial<{ [event in Event]: EventListener<event> }>;
  /**
   * Called whenever a fatal error happens.
   * Fatal errors indicate a bug in either the client or the server.
   */
  onError?: (error: Error) => void;
}

export interface Client {
  /**
   * Closes the client and disposes of all current subscriptions.
   */
  dispose(): Promise<void>;

  /**
   * Attaches a callback to the connecting event, emitted before a WebSocket
   * connection is established.
   * Works for first connection and following ones.
   */
  onConnecting(listener: EventConnectingListener): void;

  /**
   * Attaches a callback to the connected event, emitted after a WebSocket
   * connection is established and the connection_init and connection_ack
   * messages are established successfully.
   */
  onConnected(listener: EventConnectedListener): void;

  /**
   * Attaches a callback to the closed event, emitted after a WebSocket
   * connection is closed.
   */
  onClosed(listener: EventClosedListener): void;

  /**
   * Executes a GraphQL operation via the WebSocket connection.
   */
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
