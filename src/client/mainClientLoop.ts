import { StrictEffect } from 'redux-saga/effects';
import { fork } from 'typed-redux-saga';
import {
  EventClosedListener,
  EventConnectedListener,
  EventConnectingListener,
  forwardClosedEvent,
  forwardConnectedEvent,
  forwardConnectingEvent,
} from './instrumentation';
import { transportLoop } from '../transport/transportLoop';
import { protocolLoop } from '../protocol/protocolLoop';
import { ClientOptions } from './createClient';

export function* mainClientLoop({
  url,
  wsImpl,
  connectionParams,
  on,
}: ClientOptions): Generator<StrictEffect, void> {
  if (on) {
    for (const [event, listener] of Object.entries(on)) {
      switch (event) {
        case 'connecting': {
          yield* fork(
            forwardConnectingEvent,
            listener as EventConnectingListener
          );
          break;
        }
        case 'connected': {
          yield* fork(
            forwardConnectedEvent,
            listener as EventConnectedListener
          );
          break;
        }
        case 'closed': {
          yield* fork(forwardClosedEvent, listener as EventClosedListener);
          break;
        }
      }
    }
  }

  yield* fork(transportLoop, { url, wsImpl });

  yield* fork(protocolLoop, { connectionParams });
}
