import { TransportMessageTypes } from '../types';

export interface TransportOpenedMessage {
  type: TransportMessageTypes.Opened;
  payload: {
    event: Event;
  };
}

export interface TransportErrorMessage {
  type: TransportMessageTypes.Error;
  payload: {
    event: Event;
  };
}

export interface TransportMessage {
  type: TransportMessageTypes.Message;
  payload: {
    message: MessageEvent;
  };
}

export interface TransportClosedMessage {
  type: TransportMessageTypes.Closed;
  payload: {
    event: CloseEvent;
  };
}

export type TransportToProtocolMessage =
  | TransportOpenedMessage
  | TransportMessage
  | TransportErrorMessage
  | TransportClosedMessage;
