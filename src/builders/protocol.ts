import { ExecutionResult, GraphQLError } from 'graphql';
import {
  CompleteMessage,
  ConnectionInitMessage,
  ProtocolCloseMessage,
  ProtocolCompleteMessage,
  ProtocolErrorMessage,
  ProtocolNextMessage,
  ProtocolOpenMessage,
  ProtocolSendMessage,
  SubscribeMessage,
} from '../structures';
import { ProtocolMessageTypes } from '../types';
import { stringifyMessage } from '../utils/serialization';

export function protocolNextMessage(
  id: string,
  message: ExecutionResult
): ProtocolNextMessage {
  return {
    type: ProtocolMessageTypes.Next,
    payload: {
      id,
      message,
    },
  };
}

export function protocolCompleteMessage(id: string): ProtocolCompleteMessage {
  return {
    type: ProtocolMessageTypes.Complete,
    payload: {
      id,
    },
  };
}

export function protocolErrorMessage(
  id: string,
  errors: readonly GraphQLError[]
): ProtocolErrorMessage {
  return {
    type: ProtocolMessageTypes.Error,
    payload: {
      id,
      errors,
    },
  };
}

export function protocolOpenMessage(): ProtocolOpenMessage {
  return {
    type: ProtocolMessageTypes.Open,
  };
}

export function protocolSendMessage(
  message: SubscribeMessage | ConnectionInitMessage | CompleteMessage
): ProtocolSendMessage {
  return {
    type: ProtocolMessageTypes.Send,
    payload: {
      message: stringifyMessage(message),
    },
  };
}

export function protocolCloseMessage(
  code: number,
  reason: string
): ProtocolCloseMessage {
  return {
    type: ProtocolMessageTypes.Close,
    payload: {
      code,
      reason,
    },
  };
}
