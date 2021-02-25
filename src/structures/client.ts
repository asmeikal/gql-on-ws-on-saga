import { ClientMessageTypes } from '../types';
import { SubscribePayload } from './common';

export interface ClientSubscribeMessage {
  type: ClientMessageTypes.Subscribe;
  payload: {
    id: string;
    subscription: SubscribePayload;
  };
}

export interface ClientUnsubscribeMessage {
  type: ClientMessageTypes.Unsubscribe;
  payload: {
    id: string;
  };
}

export interface ClientDisconnectMessage {
  type: ClientMessageTypes.Disconnect;
}

export type ClientToProtocolMessage =
  | ClientSubscribeMessage
  | ClientUnsubscribeMessage
  | ClientDisconnectMessage;
