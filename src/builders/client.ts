import {
  SubscribePayload,
  ClientDisconnectMessage,
  ClientSubscribeMessage,
  ClientUnsubscribeMessage,
} from '../structures';
import { ClientMessageTypes } from '../types';

export function clientSubscribeMessage(
  id: string,
  payload: SubscribePayload
): ClientSubscribeMessage {
  return {
    type: ClientMessageTypes.Subscribe,
    payload: {
      id,
      subscription: payload,
    },
  };
}

export function clientUnsubscribeMessage(id: string): ClientUnsubscribeMessage {
  return {
    type: ClientMessageTypes.Unsubscribe,
    payload: {
      id,
    },
  };
}

export function clientDisconnectMessage(): ClientDisconnectMessage {
  return {
    type: ClientMessageTypes.Disconnect,
  };
}
