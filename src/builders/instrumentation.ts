import {
  InstrumentationConnectedMessage,
  InstrumentationConnectingMessage,
  InstrumentationDisconnectedMessage,
} from '../structures';
import { InstrumentationMessageTypes } from '../types';

export function instrumentationConnecting(): InstrumentationConnectingMessage {
  return {
    type: InstrumentationMessageTypes.Connecting,
  };
}

export function instrumentationConnected(
  payload?: Record<string, unknown>
): InstrumentationConnectedMessage {
  return {
    type: InstrumentationMessageTypes.Connected,
    payload,
  };
}

export function instrumentationDisconnected(
  event: CloseEvent
): InstrumentationDisconnectedMessage {
  return {
    type: InstrumentationMessageTypes.Disconnected,
    payload: {
      event,
    },
  };
}
