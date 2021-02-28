import { Channel } from 'redux-saga';
import {
  ClientSubscribeMessage,
  ClientToProtocolMessage,
  ClientUnsubscribeMessage,
  SubscribePayload,
  TransportMessage,
  TransportToProtocolMessage,
} from '../structures';
import { StrictEffect } from 'redux-saga/effects';
import { call, put, take } from 'typed-redux-saga';
import {
  ClientMessageTypes,
  MessageType,
  TransportMessageTypes,
} from '../types';
import {
  completeMessage,
  protocolCompleteMessage,
  protocolErrorMessage,
  protocolNextMessage,
  protocolSendMessage,
  subscribeMessage,
} from '../builders';
import { parseMessage } from '../utils/serialization';

function* handleSubscribe(
  event: ClientSubscribeMessage,
  subscriptions: Map<string, SubscribePayload>
): Generator<StrictEffect, void> {
  if (subscriptions.has(event.payload.id)) {
    throw new Error(
      `Trying to subscribe twice with same id ${event.payload.id}`
    );
  }
  subscriptions.set(event.payload.id, event.payload.subscription);
  yield* put(
    protocolSendMessage(
      subscribeMessage(event.payload.id, event.payload.subscription)
    )
  );
}

function* handleUnsubscribe(
  event: ClientUnsubscribeMessage,
  subscriptions: Map<string, SubscribePayload>
): Generator<StrictEffect, void> {
  if (subscriptions.delete(event.payload.id)) {
    yield* put(protocolSendMessage(completeMessage(event.payload.id)));
  }
}

function* handleMessage(
  event: TransportMessage,
  subscriptions: Map<string, SubscribePayload>
): Generator<StrictEffect, void> {
  const message = parseMessage(event.payload.message.data);
  switch (message.type) {
    case MessageType.Next: {
      yield* put(protocolNextMessage(message.id, message.payload));
      break;
    }
    case MessageType.Error: {
      yield* put(protocolErrorMessage(message.id, message.payload));
      break;
    }
    case MessageType.Complete: {
      subscriptions.delete(message.id);
      yield* put(protocolCompleteMessage(message.id));
      break;
    }
    /* istanbul ignore next */
    default: {
      throw new Error(`Received unexpected message ${message.type}`);
    }
  }
}

export function* waitForConnectionClosed(
  ch: Channel<TransportToProtocolMessage | ClientToProtocolMessage>,
  subscriptions: Map<string, SubscribePayload>
): Generator<StrictEffect, CloseEvent> {
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
      case TransportMessageTypes.Message: {
        yield* call(handleMessage, event, subscriptions);
        break;
      }
      case TransportMessageTypes.Closed: {
        return event.payload.event;
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
