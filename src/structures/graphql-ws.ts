import { MessageType } from '../types';
import { ExecutionResult, GraphQLError } from 'graphql';
import { SubscribePayload } from './common';

export interface ConnectionInitMessage {
  readonly type: MessageType.ConnectionInit;
  readonly payload?: Record<string, unknown>;
}

export interface ConnectionAckMessage {
  readonly type: MessageType.ConnectionAck;
  readonly payload?: Record<string, unknown>;
}

export interface SubscribeMessage {
  readonly id: string;
  readonly type: MessageType.Subscribe;
  readonly payload: SubscribePayload;
}

export interface NextMessage {
  readonly id: string;
  readonly type: MessageType.Next;
  readonly payload: ExecutionResult;
}

export interface ErrorMessage {
  readonly id: string;
  readonly type: MessageType.Error;
  readonly payload: readonly GraphQLError[];
}

export interface CompleteMessage {
  readonly id: string;
  readonly type: MessageType.Complete;
}
