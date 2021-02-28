import { transportLoop } from '../src/transport/transportLoop';
import ws from 'ws';
import * as http from 'http';
import { SagaTester } from '@moveaxlab/redux-saga-tester';
import { channel } from 'redux-saga';
import { TransportToProtocolMessage } from '../src/structures';
import {
  connectionInitMessage,
  protocolCloseMessage,
  protocolOpenMessage,
  protocolSendMessage,
} from '../src/builders';
import { ProtocolMessageTypes, TransportMessageTypes } from '../src/types';

const onUnhandledRejection = jest.fn();
process.on('unhandledRejection', onUnhandledRejection);

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

afterAll(() => {
  process.off('unhandledRejection', onUnhandledRejection);
});

describe('Test transport loop', () => {
  let httpServer: http.Server;
  let wsServer: ws.Server;

  beforeEach(() => {
    httpServer = new http.Server();
    wsServer = new ws.Server({ server: httpServer });
    httpServer = httpServer.listen(5003);
  });

  afterEach(done => {
    wsServer.close(err => {
      if (err) done(err);
      httpServer.close(done);
    });
  });

  it('opens a connection when open is received', async () => {
    const tester = new SagaTester();

    const ch = channel<TransportToProtocolMessage>();

    const onConnection = jest.fn();
    wsServer.on('connection', onConnection);

    tester.run(transportLoop, {
      url: 'ws://localhost:5003',
      wsImpl: ws,
      channel: ch,
    });

    tester.dispatch(protocolOpenMessage());

    await tester.waitFor(TransportMessageTypes.Opened);

    expect(onConnection).toHaveBeenCalledTimes(1);
  });

  it('closes a connection when close is received', async done => {
    const tester = new SagaTester();

    const ch = channel<TransportToProtocolMessage>();

    wsServer.on('connection', socket => {
      socket.on('close', (code, reason) => {
        expect(code).toEqual(4321);
        expect(reason).toEqual('Custom reason');
        done();
      });
    });

    tester.run(transportLoop, {
      url: 'ws://localhost:5003',
      wsImpl: ws,
      channel: ch,
    });

    tester.dispatch(protocolOpenMessage());

    await tester.waitFor(TransportMessageTypes.Opened);

    tester.dispatch(protocolCloseMessage(4321, 'Custom reason'));
  });

  it('accepts new open messages once socket is closed', async () => {
    const tester = new SagaTester();

    const ch = channel<TransportToProtocolMessage>();

    let connectionCount = 0;

    wsServer.on('connection', socket => {
      connectionCount++;
      if (connectionCount == 1) {
        socket.close(1000, 'Going away!');
      }
    });

    tester.run(transportLoop, {
      url: 'ws://localhost:5003',
      wsImpl: ws,
      channel: ch,
    });

    tester.dispatch(protocolOpenMessage());

    await tester.waitFor(TransportMessageTypes.Opened);
    await tester.waitFor(TransportMessageTypes.Closed);

    const secondOpen = tester.waitFor(TransportMessageTypes.Opened, true);

    tester.dispatch(protocolOpenMessage());

    await secondOpen;

    expect(connectionCount).toEqual(2);
  });

  it('sends messages through socket', async done => {
    const tester = new SagaTester();

    const ch = channel<TransportToProtocolMessage>();

    wsServer.on('connection', socket => {
      socket.on('message', message => {
        expect(message).toEqual('Hello, world!');
        done();
      });
    });

    tester.run(transportLoop, {
      url: 'ws://localhost:5003',
      wsImpl: ws,
      channel: ch,
    });

    tester.dispatch(protocolOpenMessage());

    await tester.waitFor(TransportMessageTypes.Opened);

    tester.dispatch({
      type: ProtocolMessageTypes.Send,
      payload: {
        message: 'Hello, world!',
      },
    });
  });

  it('crashes if first message is not an open message', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const ch = channel<TransportToProtocolMessage>();

    tester.run(transportLoop, {
      url: 'ws://localhost:5003',
      wsImpl: ws,
      channel: ch,
    });

    tester.dispatch(protocolSendMessage(connectionInitMessage()));
  });
});
