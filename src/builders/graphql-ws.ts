import {
  CompleteMessage,
  ConnectionInitMessage,
  SubscribeMessage,
  SubscribePayload,
} from '../structures';
import { MessageType } from '../types';

export function connectionInitMessage(
  payload?: Record<string, unknown>
): ConnectionInitMessage {
  return {
    type: MessageType.ConnectionInit,
    payload,
  };
}

export function subscribeMessage(
  id: string,
  payload: SubscribePayload
): SubscribeMessage {
  return {
    type: MessageType.Subscribe,
    id,
    payload,
  };
}

export function completeMessage(id: string): CompleteMessage {
  return {
    type: MessageType.Complete,
    id,
  };
}
