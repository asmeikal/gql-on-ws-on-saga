import { InstrumentationMessageTypes } from '../types';

export interface InstrumentationConnectingMessage {
  type: InstrumentationMessageTypes.Connecting;
}

export interface InstrumentationConnectedMessage {
  type: InstrumentationMessageTypes.Connected;
  payload?: Record<string, unknown>;
}

export interface InstrumentationDisconnectedMessage {
  type: InstrumentationMessageTypes.Disconnected;
  payload: {
    event: CloseEvent;
  };
}

export type InstrumentationMessage =
  | InstrumentationConnectingMessage
  | InstrumentationConnectedMessage
  | InstrumentationDisconnectedMessage;
