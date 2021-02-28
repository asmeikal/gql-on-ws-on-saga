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
import { buffers, channel, Channel } from 'redux-saga';
import { ProtocolMessageTypes, TransportMessageTypes } from '../types';
import { createConnection } from './createConnection';
import {
  ProtocolToTransportMessage,
  TransportClosedMessage,
  TransportToProtocolMessage,
} from '../structures';
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
  wsImpl?: unknown;
}

function* forwardMessagesWhileOpen(
  socket: WebSocket,
  ch: Channel<ProtocolToTransportMessage | TransportClosedMessage>
): Generator<StrictEffect, void> {
  while (true) {
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
        return;
      }
      case TransportMessageTypes.Closed: {
        return;
      }
      /* istanbul ignore next */
      default: {
        throw new Error(`Unexpected event ${JSON.stringify(event)}`);
      }
    }
  }
}

export function* transportLoop(
  options: TransportLoopOptions
): Generator<StrictEffect, void> {
  // create a channel to carry events from WebSocket connection
  const cmdCh = channel<TransportToProtocolMessage>(buffers.expanding());

  // fork a saga that will forward event from socket
  yield* fork(consume, cmdCh);

  // get WebSocket implementation from potions
  const wsImpl = getWebSocketImpl(options.wsImpl);

  while (true) {
    // create channel for current connection
    const ch = yield* actionChannel(isMessageForTransport, buffers.expanding());

    // first event must be an open event
    const openEvent = yield* take(ch);

    if (openEvent.type != ProtocolMessageTypes.Open) {
      throw new Error(`Received unexpected event ${openEvent.type}`);
    }

    // create socket connection
    const { socket, cleanup } = yield* call(createConnection, {
      url: options.url,
      channel: cmdCh,
      wsImpl,
    });

    try {
      // execute commands from protocol while socket is open
      yield* call(forwardMessagesWhileOpen, socket, ch);

      // cleanup socket event listeners
      yield* call(cleanup);

      // close channel for current loop
      yield* call([ch, ch.close]);
    } finally {
      // task will be cancelled when client is disposed, close connection
      // this is safe since socket.close is a no-op if already closed
      if (yield* cancelled()) {
        yield* call([socket, socket.close], 1000, 'Going away');
      }
    }
  }
}
