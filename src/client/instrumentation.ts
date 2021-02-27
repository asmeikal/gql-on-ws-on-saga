import { StrictEffect } from 'redux-saga/effects';
import { actionChannel, call, take } from 'typed-redux-saga';
import {
  AnyAction,
  InstrumentationConnectedMessage,
  InstrumentationConnectingMessage,
  InstrumentationDisconnectedMessage,
} from '../structures';
import { InstrumentationMessageTypes } from '../types';

export type EventConnecting = 'connecting';
export type EventConnected = 'connected';
export type EventClosed = 'closed';
export type Event = EventConnecting | EventConnected | EventClosed;
export type EventConnectedListener = (
  payload?: Record<string, unknown>
) => void;
export type EventConnectingListener = () => void;
export type EventClosedListener = (event: CloseEvent) => void;
export type EventListener<E extends Event> = E extends EventConnecting
  ? EventConnectingListener
  : E extends EventConnected
  ? EventConnectedListener
  : E extends EventClosed
  ? EventClosedListener
  : never;

export function* forwardConnectingEvent(
  listener: EventConnectingListener
): Generator<StrictEffect, void> {
  const ch = yield* actionChannel(
    (action: AnyAction): action is InstrumentationConnectingMessage =>
      action.type === InstrumentationMessageTypes.Connecting
  );

  while (true) {
    yield* take(ch);
    yield* call(listener);
  }
}

export function* forwardConnectedEvent(
  listener: EventConnectedListener
): Generator<StrictEffect, void> {
  const ch = yield* actionChannel(
    (action: AnyAction): action is InstrumentationConnectedMessage =>
      action.type === InstrumentationMessageTypes.Connected
  );

  while (true) {
    const event = yield* take(ch);
    yield* call(listener, event.payload);
  }
}

export function* forwardClosedEvent(
  listener: EventClosedListener
): Generator<StrictEffect, void> {
  const ch = yield* actionChannel(
    (action: AnyAction): action is InstrumentationDisconnectedMessage =>
      action.type === InstrumentationMessageTypes.Disconnected
  );

  while (true) {
    const event = yield* take(ch);
    yield* call(listener, event.payload.event);
  }
}
