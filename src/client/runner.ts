import { runSaga, RunSagaOptions, stdChannel } from 'redux-saga';
import { AnyAction } from '../structures';
import { Saga, Task } from '@redux-saga/types';

export interface SagaRunner {
  run<S extends Saga>(saga: S, ...args: Parameters<S>): Task;
}

export function makeDefaultRunner(): SagaRunner {
  const mainChannel = stdChannel<AnyAction>();

  const io: RunSagaOptions<AnyAction, null> = {
    channel: mainChannel,
    dispatch(event: AnyAction) {
      mainChannel.put(event);
    },
    /* istanbul ignore next */
    getState() {
      return null;
    },
  };

  return {
    run<S extends Saga>(saga: S, ...args: Parameters<S>): Task {
      return runSaga(io, saga, ...args);
    },
  };
}
