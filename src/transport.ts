import { StrictEffect } from 'redux-saga/effects';
import { actionChannel, call, fork, put, take } from 'typed-redux-saga';
import { isMessageForTransport } from './guards';
import { buffers, Channel } from 'redux-saga';
import { ProtocolMessageTypes, TransportMessageTypes } from './types';
import { createWebSocket, WebSocketOptions } from './createWebSocket';
import { TransportToProtocolMessage } from './structures';

function* consume(
  ch: Channel<TransportToProtocolMessage>
): Generator<StrictEffect, void> {
  while (true) {
    const event = yield* take(ch);
    yield* put(event);
  }
}

export function* transportLoop(
  options: WebSocketOptions
): Generator<StrictEffect, void> {
  yield* fork(consume, options.channel);

  while (true) {
    const ch = yield* actionChannel(isMessageForTransport, buffers.expanding());

    const openEvent = yield* take(ch);

    if (openEvent.type != ProtocolMessageTypes.Open) {
      throw new Error(`Received unexpected event ${openEvent.type}`);
    }

    const { socket, cleanup } = yield* call(createWebSocket, options);

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
  }
}
