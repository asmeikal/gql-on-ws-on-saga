import { StrictEffect } from 'redux-saga/effects';
import {
  ClientToProtocolMessage,
  SubscribePayload,
  TransportToProtocolMessage,
} from '../structures';
import { actionChannel, call, put, take } from 'typed-redux-saga';
import { isMessageForProtocol } from '../utils/guards';
import { ClientMessageTypes } from '../types';
import {
  connectionInitMessage,
  protocolOpenMessage,
  protocolSendMessage,
  subscribeMessage,
} from '../builders';
import {
  instrumentationConnected,
  instrumentationConnecting,
} from '../builders/instrumentation';
import { waitForConnectionOpened } from './waitForConnectionOpen';
import { waitForConnectionAck } from './waitForConnectionAck';
import { waitForConnectionClosed } from './waitForConnectionClosed';
import { exponentialBackoff } from './exponentialBackoff';
import { handleCloseEvent } from './handleCloseEvent';
import { Channel } from 'redux-saga';

export interface ProtocolLoopOptions {
  connectionParams?:
    | Record<string, unknown>
    | (() => Promise<Record<string, unknown>>)
    | (() => Record<string, unknown>);
}

function* waitForFirstMessage(
  ch: Channel<TransportToProtocolMessage | ClientToProtocolMessage>,
  subscriptions: Map<string, SubscribePayload>
): Generator<StrictEffect, void> {
  const firstSubscription = yield* take(ch);

  if (firstSubscription.type != ClientMessageTypes.Subscribe) {
    throw new Error(
      `Received unexpected first message type: ${firstSubscription.type}`
    );
  }

  subscriptions.set(
    firstSubscription.payload.id,
    firstSubscription.payload.subscription
  );
}

export function* protocolLoop({
  connectionParams,
}: ProtocolLoopOptions): Generator<StrictEffect, void> {
  // setup a channel to receive all protocol messages in FIFO order
  const ch = yield* actionChannel(isMessageForProtocol);

  // exponential backoff for connection retries
  let retries = exponentialBackoff();

  // store active subscriptions between reconnections
  const subscriptions: Map<string, SubscribePayload> = new Map();

  // wait for first message before opening socket connection
  yield* call(waitForFirstMessage, ch, subscriptions);

  while (true) {
    // signal that we are connecting
    yield* put(instrumentationConnecting());

    // tell transport to open a socket connection
    yield* put(protocolOpenMessage());

    // wait for the socket connection to be established
    // subscribe/unsubscribe commands will update the subscriptions map
    const closedOnOpen = yield* call(
      waitForConnectionOpened,
      ch,
      subscriptions
    );

    // if connection could not be established, handle the close event,
    // then restart loop
    if (closedOnOpen) {
      yield* call(handleCloseEvent, closedOnOpen, retries);
      continue;
    }

    // connection was established: reset exponential backoff
    retries.return();
    retries = exponentialBackoff();

    // build connection params
    let params: Record<string, unknown> | undefined;
    if (typeof connectionParams === 'function') {
      params = yield* call(connectionParams);
    } else {
      params = connectionParams;
    }

    // send connection init message
    yield* put(protocolSendMessage(connectionInitMessage(params)));

    // wait for connection ack or for connection to be closed
    // subscribe/unsubscribe commands will update the subscriptions map
    const { closeEvent: closedBeforeAck, ackPayload } = yield* call(
      waitForConnectionAck,
      ch,
      subscriptions
    );

    // if connection was closed, handle close event then restart loop
    if (closedBeforeAck) {
      yield* call(handleCloseEvent, closedBeforeAck, retries);
      continue;
    }

    // signal that connection was established
    yield* put(instrumentationConnected(ackPayload));

    // send all active subscriptions stored in the subscriptions map
    for (const [id, subscription] of subscriptions.entries()) {
      yield* put(protocolSendMessage(subscribeMessage(id, subscription)));
    }

    // wait for close event
    // subscribe/unsubscribe command will be handled
    // and will update the subscriptions map
    const closeEvent = yield* call(waitForConnectionClosed, ch, subscriptions);

    // handle close event before restarting loop
    yield* call(handleCloseEvent, closeEvent, retries);
  }
}
