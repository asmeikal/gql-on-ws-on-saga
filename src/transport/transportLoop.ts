import { StrictEffect } from 'redux-saga/effects';
import {
  actionChannel,
  call,
  cancelled,
  fork,
  put,
  take,
} from 'typed-redux-saga';
import { isMessageForTransport } from '../utils/guards';
import { buffers, Channel } from 'redux-saga';
import { ProtocolMessageTypes, TransportMessageTypes } from '../types';
import { createWebSocket } from './createWebSocket';
import { TransportToProtocolMessage } from '../structures';
import { getWebSocketImpl } from './getWebSocketImpl';

function* consume(
  ch: Channel<TransportToProtocolMessage>
): Generator<StrictEffect, void> {
  while (true) {
    const event = yield* take(ch);
    yield* put(event);
  }
}

export interface TransportLoopOptions {
  url: string;
  channel: Channel<TransportToProtocolMessage>;
  wsImpl?: unknown;
}

export function* transportLoop(
  options: TransportLoopOptions
): Generator<StrictEffect, void> {
  yield* fork(consume, options.channel);

  const wsImpl = getWebSocketImpl(options.wsImpl);

  while (true) {
    const ch = yield* actionChannel(isMessageForTransport, buffers.expanding());

    const openEvent = yield* take(ch);

    if (openEvent.type != ProtocolMessageTypes.Open) {
      throw new Error(`Received unexpected event ${openEvent.type}`);
    }

    const { socket, cleanup } = yield* call(createWebSocket, {
      url: options.url,
      channel: options.channel,
      wsImpl,
    });

    try {
      consume: while (true) {
        const event = yield* take(ch);
        switch (event.type) {
          case ProtocolMessageTypes.Send: {
            yield* call([socket, socket.send], event.payload.message);
            break;
          }
          case ProtocolMessageTypes.Close: {
            yield* call(
              [socket, socket.close],
              event.payload.code,
              event.payload.reason
            );
            break consume;
          }
          case TransportMessageTypes.Closed: {
            break consume;
          }
          default: {
            throw new Error(`Unexpected event ${JSON.stringify(event)}`);
          }
        }
      }

      yield* call(cleanup);

      yield* call([ch, ch.close]);
    } finally {
      if (yield* cancelled()) {
        yield* call([socket, socket.close], 1000, 'Going away');
      }
    }
  }
}
