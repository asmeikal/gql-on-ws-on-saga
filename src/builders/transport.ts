import {
  TransportClosedMessage,
  TransportErrorMessage,
  TransportMessage,
  TransportOpenedMessage,
} from '../structures';
import { TransportMessageTypes } from '../types';

export function transportOpened(event: Event): TransportOpenedMessage {
  return {
    type: TransportMessageTypes.Opened,
    payload: {
      event,
    },
  };
}

export function transportMessage(message: MessageEvent): TransportMessage {
  return {
    type: TransportMessageTypes.Message,
    payload: {
      message,
    },
  };
}

export function transportError(error: Event): TransportErrorMessage {
  return {
    type: TransportMessageTypes.Error,
    payload: {
      event: error,
    },
  };
}

export function transportClosed(event: CloseEvent): TransportClosedMessage {
  return {
    type: TransportMessageTypes.Closed,
    payload: {
      event,
    },
  };
}
