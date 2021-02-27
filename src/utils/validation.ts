import { MessageType } from '../types';
import {
  CompleteMessage,
  ConnectionAckMessage,
  ConnectionInitMessage,
  ErrorMessage,
  NextMessage,
  SubscribeMessage,
} from '../structures';
import { GraphQLError } from 'graphql';

const baseHasOwnProperty = Object.prototype.hasOwnProperty;

export function isObject(val: unknown): val is Record<PropertyKey, unknown> {
  return typeof val === 'object' && val !== null;
}

export function areGraphQLErrors(obj: unknown): obj is readonly GraphQLError[] {
  return (
    Array.isArray(obj) && obj.length > 0 && obj.every(ob => 'message' in ob)
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

// eslint-disable-next-line complexity
export function isMessage(val: unknown): val is Message {
  if (isObject(val)) {
    if (!hasOwnStringProperty(val, 'type')) {
      return false;
    }
    switch (val.type) {
      case MessageType.ConnectionInit:
        return (
          !hasOwnProperty(val, 'payload') ||
          val.payload === undefined ||
          isObject(val.payload)
        );
      case MessageType.ConnectionAck:
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
