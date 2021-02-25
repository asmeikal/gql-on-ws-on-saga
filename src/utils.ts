import { MessageType } from './types';
import {
  ConnectionAckMessage,
  SubscribeMessage,
  ConnectionInitMessage,
  NextMessage,
  ErrorMessage,
  CompleteMessage,
} from './structures';
import { GraphQLError } from 'graphql';

// Extremely small optimisation, reduces runtime prototype traversal
const baseHasOwnProperty = Object.prototype.hasOwnProperty;

export function isObject(val: unknown): val is Record<PropertyKey, unknown> {
  return typeof val === 'object' && val !== null;
}

export function isAsyncIterable<T = unknown>(
  val: unknown
): val is AsyncIterableIterator<T> {
  return typeof Object(val)[Symbol.asyncIterator] === 'function';
}

export function areGraphQLErrors(obj: unknown): obj is readonly GraphQLError[] {
  return (
    Array.isArray(obj) &&
    // must be at least one error
    obj.length > 0 &&
    // error has at least a message
    obj.every(ob => 'message' in ob)
  );
}

export function hasOwnProperty<
  O extends Record<PropertyKey, unknown>,
  P extends PropertyKey
>(obj: O, prop: P): obj is O & Record<P, unknown> {
  return baseHasOwnProperty.call(obj, prop);
}

export function hasOwnObjectProperty<
  O extends Record<PropertyKey, unknown>,
  P extends PropertyKey
>(obj: O, prop: P): obj is O & Record<P, Record<PropertyKey, unknown>> {
  return baseHasOwnProperty.call(obj, prop) && isObject(obj[prop]);
}

export function hasOwnArrayProperty<
  O extends Record<PropertyKey, unknown>,
  P extends PropertyKey
>(obj: O, prop: P): obj is O & Record<P, unknown[]> {
  return baseHasOwnProperty.call(obj, prop) && Array.isArray(obj[prop]);
}

export function hasOwnStringProperty<
  O extends Record<PropertyKey, unknown>,
  P extends PropertyKey
>(obj: O, prop: P): obj is O & Record<P, string> {
  return baseHasOwnProperty.call(obj, prop) && typeof obj[prop] === 'string';
}

export type Message<
  T extends MessageType = MessageType
> = T extends MessageType.ConnectionAck
  ? ConnectionAckMessage
  : T extends MessageType.ConnectionInit
  ? ConnectionInitMessage
  : T extends MessageType.Subscribe
  ? SubscribeMessage
  : T extends MessageType.Next
  ? NextMessage
  : T extends MessageType.Error
  ? ErrorMessage
  : T extends MessageType.Complete
  ? CompleteMessage
  : never;

/** Checks if the provided value is a message. */
// eslint-disable-next-line complexity
export function isMessage(val: unknown): val is Message {
  if (isObject(val)) {
    // all messages must have the `type` prop
    if (!hasOwnStringProperty(val, 'type')) {
      return false;
    }
    // validate other properties depending on the `type`
    switch (val.type) {
      case MessageType.ConnectionInit:
        // the connection init message can have optional payload object
        return (
          !hasOwnProperty(val, 'payload') ||
          val.payload === undefined ||
          isObject(val.payload)
        );
      case MessageType.ConnectionAck:
        // the connection ack message can have optional payload object too
        return (
          !hasOwnProperty(val, 'payload') ||
          val.payload === undefined ||
          isObject(val.payload)
        );
      case MessageType.Subscribe:
        return (
          hasOwnStringProperty(val, 'id') &&
          hasOwnObjectProperty(val, 'payload') &&
          (!hasOwnProperty(val.payload, 'operationName') ||
            val.payload.operationName === undefined ||
            val.payload.operationName === null ||
            typeof val.payload.operationName === 'string') &&
          hasOwnStringProperty(val.payload, 'query') &&
          (!hasOwnProperty(val.payload, 'variables') ||
            val.payload.variables === undefined ||
            val.payload.variables === null ||
            hasOwnObjectProperty(val.payload, 'variables'))
        );
      case MessageType.Next:
        return (
          hasOwnStringProperty(val, 'id') &&
          hasOwnObjectProperty(val, 'payload')
        );
      case MessageType.Error:
        return hasOwnStringProperty(val, 'id') && areGraphQLErrors(val.payload);
      case MessageType.Complete:
        return hasOwnStringProperty(val, 'id');
      default:
        return false;
    }
  }
  return false;
}

/** Parses the raw websocket message data to a valid message. */
export function parseMessage(data: unknown): Message {
  if (isMessage(data)) {
    return data;
  }
  if (typeof data !== 'string') {
    throw new Error('Message not parsable');
  }
  const message = JSON.parse(data);
  if (!isMessage(message)) {
    throw new Error('Invalid message');
  }
  return message;
}

/** Stringifies a valid message ready to be sent through the socket. */
export function stringifyMessage<T extends MessageType>(
  msg: Message<T>
): string {
  if (!isMessage(msg)) {
    throw new Error('Cannot stringify invalid message');
  }
  return JSON.stringify(msg);
}
