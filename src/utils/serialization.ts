import { MessageType } from '../types';
import { isMessage, Message } from './validation';

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

export function stringifyMessage<T extends MessageType>(
  msg: Message<T>
): string {
  if (!isMessage(msg)) {
    throw new Error('Cannot stringify invalid message');
  }
  return JSON.stringify(msg);
}
