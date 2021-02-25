import {
  buffers,
  channel,
  runSaga,
  stdChannel,
  RunSagaOptions,
} from 'redux-saga';
import { StrictEffect } from 'redux-saga/effects';
import { fork } from 'typed-redux-saga';
import { getWebSocketImpl } from './getWebSocketImpl';
import { runSubscription, Sink, UnSubscriber } from './runSubscription';
import {
  AnyAction,
  SubscribePayload,
  TransportToProtocolMessage,
} from './structures';
import { transportLoop } from './transport';
import { protocolLoop } from './protocol';

export interface ClientOptions {
  url: string;
  wsImpl?: unknown;
}

function* mainClientLoop({
  url,
  wsImpl,
}: ClientOptions): Generator<StrictEffect, void> {
  const ch = channel<TransportToProtocolMessage>(buffers.expanding());

  const ws = getWebSocketImpl(wsImpl);

  yield* fork(transportLoop, {
    url,
    wsImpl: ws,
    channel: ch,
  });

  yield* fork(protocolLoop);
}

export interface Client {
  dispose(): Promise<void>;
  subscribe<T = unknown>(
    payload: SubscribePayload,
    sink: Sink<T>
  ): UnSubscriber;
}

export function createClient(options: ClientOptions): Client {
  const mainChannel = stdChannel<AnyAction>();

  const io: RunSagaOptions<AnyAction, null> = {
    channel: mainChannel,
    dispatch(event: AnyAction) {
      console.log(event);
      mainChannel.put(event);
    },
    getState() {
      return null;
    },
  };

  const runner = runSaga(io, mainClientLoop, options);

  return {
    dispose: () => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          runner.toPromise().then(resolve, reject);
          runner.cancel();
        }, 0);
      });
    },
    subscribe<T = unknown>(
      payload: SubscribePayload,
      sink: Sink<T>
    ): UnSubscriber {
      const r = runSaga(io, runSubscription, payload, sink);

      return () => {
        setTimeout(() => {
          r.cancel();
        }, 0);
      };
    },
  };
}
