import { Channel } from 'redux-saga';
import {
  ClientSubscribeMessage,
  ClientToProtocolMessage,
  ClientUnsubscribeMessage,
  SubscribePayload,
  TransportToProtocolMessage,
} from '../structures';
import { StrictEffect } from 'redux-saga/effects';
import { call, take } from 'typed-redux-saga';
import { ClientMessageTypes, TransportMessageTypes } from '../types';

function handleSubscribe(
  event: ClientSubscribeMessage,
  subscriptions: Map<string, SubscribePayload>
): void {
  if (subscriptions.has(event.payload.id)) {
    throw new Error(
      `Trying to subscribe twice with same id ${event.payload.id}`
    );
  }
  subscriptions.set(event.payload.id, event.payload.subscription);
}

function handleUnsubscribe(
  event: ClientUnsubscribeMessage,
  subscriptions: Map<string, SubscribePayload>
) {
  subscriptions.delete(event.payload.id);
}

export function* waitForConnectionOpened(
  ch: Channel<TransportToProtocolMessage | ClientToProtocolMessage>,
  subscriptions: Map<string, SubscribePayload>
): Generator<StrictEffect, CloseEvent | undefined> {
  while (true) {
    const event = yield* take(ch);

    switch (event.type) {
      case ClientMessageTypes.Subscribe: {
        yield* call(handleSubscribe, event, subscriptions);
        break;
      }
      case ClientMessageTypes.Unsubscribe: {
        yield* call(handleUnsubscribe, event, subscriptions);
        break;
      }
      case TransportMessageTypes.Opened: {
        return;
      }
      case TransportMessageTypes.Closed: {
        return event.payload.event;
      }
      case TransportMessageTypes.Error: {
        break;
      }
      default: {
        throw new Error(`Unexpected message type ${event.type}`);
      }
    }
  }
}
