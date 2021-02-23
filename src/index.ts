import { buffers, Channel, channel, stdChannel, runSaga, Buffer as SagaBuffer } from "redux-saga";
import { call, cancelled, delay, put, spawn, take } from 'redux-saga/effects';
import ws from 'ws';
import Observable from 'zen-observable';

const WebSocket = ws;

function* createWebSocket(url: string, ch: Channel<any>) {
  const socket = new WebSocket(url, ['graphql-transport-ws']);

  socket.addEventListener('open', (event) => {
    ch.put({
      type: '@@socket/open',
      payload: event,
    });
  });
  socket.addEventListener('message', (event) => {
    ch.put({
      type: '@@socket/message',
      payload: event,
    });
  });
  socket.addEventListener('error', (error) => {
    ch.put({
      type: '@@socket/error',
      payload: error,
      error: true,
    })
  });
  socket.addEventListener('close', (event) => {
    ch.put({
      type: '@@socket/close',
      payload: event,
    });
  });

  return socket;
}

function* consume(ch: Channel<any>) {
  while (true) {
    const event = yield take(ch);
    // console.log(event);
    yield put(event);
    if (event.type === '@@socket/close') {
      return;
    }
  }
}

function* main(url: string) {
  const ch = channel(buffers.expanding(1024));

  let socket;

  while (true) {
    socket = yield call(createWebSocket, url, ch);

    yield call(consume, ch);

    yield delay(1000);
  }
}

function* flushToSink(sink: ZenObservable.SubscriptionObserver<any>) {
  try {
    while (true) {
      console.log('new loop run');
      const event = yield take((a: any) => a.type.startsWith('@@socket'));
      console.log('sink received event', event.type);
      sink.next(event);
    }
  } finally {
    console.log('sink is terminating...');
    if (yield cancelled()) {
      console.log('flush to sink cancelled')
    }
  }
}

function* flushToChan(ch: Channel<any>) {
  while (true) {
    const event = yield take((a: any) => a.type.startsWith('@@socket'));
    ch.put(event);
  }
}

function* subscribe() {
  const ch = channel();
  const obs = new Observable(s => {
    ch.take(e => s.next(e));
  })
  yield spawn(flushToChan, ch);
  return obs;
}

const mainChannel = stdChannel();

const io = {
  channel: mainChannel,
  dispatch(event: any) {
    mainChannel.put(event);
  },
  getState() {
    return null;
  }
}

const runner = runSaga(io, main, 'ws://localhost:5002/graphql');

runner.toPromise().then((...res) => {
  console.log(res);
}, err => {
  console.error(err);
})

const obs = new Observable(sink => {
  const r = runSaga(io, flushToSink, sink);
  return () => {
    setTimeout((r) => {
      r.cancel();
    }, 0, r);
  }
})

let count = 0;

const unsub = obs.subscribe({
  next(e: any) {
    console.log('observer', e.type);
    count++;
    if (count > 1) {
      console.log('killing observer...');
      unsub.unsubscribe();
    }
  }
})

