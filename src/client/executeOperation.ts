import { StrictEffect } from 'redux-saga/effects';
import { actionChannel, call, cancelled, put, take } from 'typed-redux-saga';
import { v4 } from 'uuid';
import { SubscribePayload } from '../structures';
import { ProtocolMessageTypes } from '../types';
import { clientSubscribeMessage, clientUnsubscribeMessage } from '../builders';
import { isMessageForSubscription } from '../utils/guards';
import { buffers } from 'redux-saga';

export function* executeOperation<T>(
  payload: SubscribePayload,
  sink: Sink<T>
): Generator<StrictEffect, void> {
  const id = v4();

  const ch = yield* actionChannel(
    isMessageForSubscription(id),
    buffers.expanding()
  );

  yield* put(clientSubscribeMessage(id, payload));

  try {
    while (true) {
      const event = yield* take(ch);
      switch (event.type) {
        case ProtocolMessageTypes.Next: {
          yield* call([sink, sink.next], event.payload.message as T);
          break;
        }
        case ProtocolMessageTypes.Complete: {
          yield* call([sink, sink.complete]);
          return;
        }
        case ProtocolMessageTypes.Error: {
          yield* call([sink, sink.error], event.payload.errors);
          return;
        }
      }
    }
  } finally {
    yield* call([ch, ch.close]);
    if (yield* cancelled()) {
      yield* put(clientUnsubscribeMessage(id));
    }
  }
}

export interface Sink<T = unknown> {
  next(value: T): void;

  error(error: unknown): void;

  complete(): void;
}

export type UnSubscriber = () => void;
