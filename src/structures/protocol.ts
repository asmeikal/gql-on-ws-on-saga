import { ProtocolMessageTypes } from '../types';
import { ExecutionResult, GraphQLError } from 'graphql';

export interface ProtocolNextMessage {
  type: ProtocolMessageTypes.Next;
  payload: {
    id: string;
    message: ExecutionResult;
  };
}

export interface ProtocolCompleteMessage {
  type: ProtocolMessageTypes.Complete;
  payload: {
    id: string;
  };
}

export interface ProtocolErrorMessage {
  type: ProtocolMessageTypes.Error;
  payload: {
    id: string;
    errors: readonly GraphQLError[];
  };
}

export interface ProtocolOpenMessage {
  type: ProtocolMessageTypes.Open;
}

export interface ProtocolSendMessage {
  type: ProtocolMessageTypes.Send;
  payload: {
    message: string;
  };
}

export interface ProtocolCloseMessage {
  type: ProtocolMessageTypes.Close;
  payload: {
    code: number;
    reason: string;
  };
}

export type ProtocolToSubscriptionMessage =
  | ProtocolNextMessage
  | ProtocolCompleteMessage
  | ProtocolErrorMessage;

export type ProtocolToTransportMessage =
  | ProtocolOpenMessage
  | ProtocolSendMessage
  | ProtocolCloseMessage;
