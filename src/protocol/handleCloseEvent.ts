import { StrictEffect } from 'redux-saga/effects';
import { delay, put } from 'typed-redux-saga';
import { instrumentationDisconnected } from '../builders/instrumentation';

const fatalErrors = [
  1002, // unsupported WebSocket sub-protocol
  4400, // invalid message format from client
  4401, // subscribe received before connection init
  4409, // duplicate subscription id
  4429, // too many initialization requests
];

function isFatalProtocolError(closeEvent: CloseEvent) {
  return fatalErrors.includes(closeEvent.code);
}

export function* handleCloseEvent(
  event: CloseEvent,
  retry: Generator<number>
): Generator<StrictEffect, void> {
  yield* put(instrumentationDisconnected(event));

  if (isFatalProtocolError(event)) {
    throw new Error(`Received fatal protocol close event: ${event.code}`);
  }

  yield* delay(retry.next().value as number);
}
