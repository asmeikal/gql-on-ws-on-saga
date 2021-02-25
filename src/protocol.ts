import { StrictEffect } from 'redux-saga/effects';
import { SubscribePayload } from './structures';
import { actionChannel, delay, put, take } from 'typed-redux-saga';
import { isMessageForProtocol } from './guards';
import {
  ClientMessageTypes,
  MessageType,
  TransportMessageTypes,
} from './types';
import {
  connectionInitMessage,
  protocolOpenMessage,
  protocolSendMessage,
  subscribeMessage,
  completeMessage,
  protocolNextMessage,
  protocolErrorMessage,
  protocolCompleteMessage,
} from './builders';
import {
  instrumentationConnected,
  instrumentationConnecting,
  instrumentationDisconnected,
} from './builders/instrumentation';
import { parseMessage, stringifyMessage } from './utils';

// eslint-disable-next-line complexity
export function* protocolLoop(): Generator<StrictEffect, void> {
  const ch = yield* actionChannel(isMessageForProtocol);

  const subscriptions: Record<string, SubscribePayload> = {};

  const firstSubscription = yield* take(ch);
  if (firstSubscription.type != ClientMessageTypes.Subscribe) {
    throw new Error(
      `Received unexpected first message type: ${firstSubscription.type}`
    );
  }

  subscriptions[firstSubscription.payload.id] =
    firstSubscription.payload.subscription;

  mainLoop: while (true) {
    yield* put(instrumentationConnecting());

    yield* put(protocolOpenMessage());

    firstLoop: while (true) {
      const event = yield* take(ch);

      switch (event.type) {
        case ClientMessageTypes.Subscribe: {
          if (!(event.payload.id in subscriptions)) {
            subscriptions[event.payload.id] = event.payload.subscription;
          } else {
            throw new Error(
              `Trying to subscribe twice with same id ${event.payload.id}`
            );
          }
          break;
        }
        case ClientMessageTypes.Unsubscribe: {
          if (event.payload.id in subscriptions) {
            delete subscriptions[event.payload.id];
          } else {
            throw new Error(
              `Trying to unsubscribe from unknown subscription with id ${event.payload.id}`
            );
          }
          break;
        }
        case TransportMessageTypes.Opened: {
          yield* put(
            protocolSendMessage(stringifyMessage(connectionInitMessage()))
          );
          break firstLoop;
        }
        case TransportMessageTypes.Closed: {
          yield* put(instrumentationDisconnected(event.payload.event));
          yield* delay(1000);
          continue mainLoop;
        }
      }
    }

    secondLoop: while (true) {
      const event = yield* take(ch);

      switch (event.type) {
        case ClientMessageTypes.Subscribe: {
          if (!(event.payload.id in subscriptions)) {
            subscriptions[event.payload.id] = event.payload.subscription;
          } else {
            throw new Error(
              `Trying to subscribe twice with same id ${event.payload.id}`
            );
          }
          break;
        }
        case ClientMessageTypes.Unsubscribe: {
          if (event.payload.id in subscriptions) {
            delete subscriptions[event.payload.id];
          } else {
            throw new Error(
              `Trying to unsubscribe from unknown subscription with id ${event.payload.id}`
            );
          }
          break;
        }
        case TransportMessageTypes.Message: {
          const message = parseMessage(event.payload.message.data);
          if (message.type != MessageType.ConnectionAck) {
            throw new Error(`Received unexpected message ${message.type}`);
          }
          yield* put(instrumentationConnected(message.payload));
          break secondLoop;
        }
        case TransportMessageTypes.Closed: {
          yield* put(instrumentationDisconnected(event.payload.event));
          yield* delay(1000);
          continue mainLoop;
        }
      }
    }

    for (const [id, subscription] of Object.entries(subscriptions)) {
      yield* put(
        protocolSendMessage(
          stringifyMessage(subscribeMessage(id, subscription))
        )
      );
    }

    while (true) {
      const event = yield* take(ch);

      switch (event.type) {
        case ClientMessageTypes.Subscribe: {
          if (!(event.payload.id in subscriptions)) {
            subscriptions[event.payload.id] = event.payload.subscription;
            yield* put(
              protocolSendMessage(
                stringifyMessage(
                  subscribeMessage(event.payload.id, event.payload.subscription)
                )
              )
            );
          } else {
            throw new Error(
              `Trying to subscribe twice with same id ${event.payload.id}`
            );
          }
          break;
        }
        case ClientMessageTypes.Unsubscribe: {
          if (event.payload.id in subscriptions) {
            delete subscriptions[event.payload.id];
            yield* put(
              protocolSendMessage(
                stringifyMessage(completeMessage(event.payload.id))
              )
            );
          } else {
            throw new Error(
              `Trying to unsubscribe from unknown subscription with id ${event.payload.id}`
            );
          }
          break;
        }
        case TransportMessageTypes.Message: {
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
              yield* put(protocolCompleteMessage(message.id));
              break;
            }
            default: {
              throw new Error(`Received unexpected message ${message.type}`);
            }
          }
          break;
        }
        case TransportMessageTypes.Closed: {
          yield* put(instrumentationDisconnected(event.payload.event));
          yield* delay(1000);
          continue mainLoop;
        }
      }
    }
  }
}
