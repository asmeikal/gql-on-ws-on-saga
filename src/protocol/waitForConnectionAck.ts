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
import {
  ClientMessageTypes,
  MessageType,
  TransportMessageTypes,
} from '../types';
import { parseMessage } from '../utils/serialization';

type ConnectionAckResult =
  | { closeEvent: CloseEvent; ackPayload: undefined }
  | { closeEvent: undefined; ackPayload: Record<string, unknown> | undefined };

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

export function* waitForConnectionAck(
  ch: Channel<TransportToProtocolMessage | ClientToProtocolMessage>,
  subscriptions: Map<string, SubscribePayload>
): Generator<StrictEffect, ConnectionAckResult> {
  while (true) {
    const event = yield* take(ch);

    switch (event.type) {
      case ClientMessageTypes.Subscribe: {
        yield* call(handleSubscribe, event, subscriptions);
        break;
      }
      case ClientMessageTypes.Unsubscribe: {
        yield* call(handleUnsubscribe, event, subscriptions);
        subscriptions.delete(event.payload.id);
        break;
      }
      case TransportMessageTypes.Message: {
        const message = parseMessage(event.payload.message.data);
        if (message.type != MessageType.ConnectionAck) {
          throw new Error(`Received unexpected message ${message.type}`);
        }
        return { closeEvent: undefined, ackPayload: message.payload };
      }
      case TransportMessageTypes.Closed: {
        return { closeEvent: event.payload.event, ackPayload: undefined };
      }
      /* istanbul ignore next */
      case TransportMessageTypes.Error: {
        break;
      }
      /* istanbul ignore next */
      default: {
        throw new Error(`Unexpected message type ${event.type}`);
      }
    }
  }
}
