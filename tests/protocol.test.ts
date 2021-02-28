import { protocolLoop } from '../src/protocol/protocolLoop';
import { SagaTester } from '@moveaxlab/redux-saga-tester';
import {
  clientSubscribeMessage,
  clientUnsubscribeMessage,
  transportClosed,
  transportMessage,
  transportOpened,
} from '../src/builders';
import { v4 } from 'uuid';
import {
  InstrumentationMessageTypes,
  MessageType,
  ProtocolMessageTypes,
  TransportMessageTypes,
} from '../src/types';
import { stringifyMessage } from '../src/utils/serialization';

const onUnhandledRejection = jest.fn();
process.on('unhandledRejection', onUnhandledRejection);

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

afterAll(() => {
  process.off('unhandledRejection', onUnhandledRejection);
});

describe('Test protocol loop', () => {
  it('sends subscriptions only after connection ack', async () => {
    const tester = new SagaTester();

    const subId1 = v4();
    const subId2 = v4();
    const subId3 = v4();

    const mockOpenEvent = {} as Event;
    const mockAckEvent = {
      data: stringifyMessage({ type: MessageType.ConnectionAck }),
    } as MessageEvent;
    const mockCloseEvent = {} as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(
      clientSubscribeMessage(subId1, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(
      clientSubscribeMessage(subId2, { query: `query { hello }` })
    );

    tester.dispatch(transportOpened(mockOpenEvent));

    tester.dispatch(
      clientSubscribeMessage(subId3, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(transportMessage(mockAckEvent));

    tester.dispatch(transportClosed(mockCloseEvent));

    const calledActions = tester.getCalledActions();

    // three subscriptions were sent
    expect(
      calledActions.filter(
        a =>
          a.type === ProtocolMessageTypes.Send &&
          a.payload.message.includes('subscribe')
      )
    ).toHaveLength(3);

    // all subscriptions were sent after ack
    const ackIdx = calledActions.findIndex(
      a =>
        a.type === TransportMessageTypes.Message &&
        a.payload.message.data.includes(MessageType.ConnectionAck)
    );

    const firstSubIdx = calledActions.findIndex(
      a =>
        a.type === ProtocolMessageTypes.Send &&
        a.payload.message.includes(subId1)
    );
    const secondSubIdx = calledActions.findIndex(
      a =>
        a.type === ProtocolMessageTypes.Send &&
        a.payload.message.includes(subId2)
    );
    const thirdSubIdx = calledActions.findIndex(
      a =>
        a.type === ProtocolMessageTypes.Send &&
        a.payload.message.includes(subId3)
    );

    expect(ackIdx).toBeLessThan(firstSubIdx);
    expect(ackIdx).toBeLessThan(secondSubIdx);
    expect(ackIdx).toBeLessThan(thirdSubIdx);
  });

  it('does not send subscriptions if they were unsubscribed before ack', async () => {
    const tester = new SagaTester();

    const subId1 = v4();
    const subId2 = v4();
    const subId3 = v4();

    const mockOpenEvent = {} as Event;
    const mockAckEvent = {
      data: stringifyMessage({ type: MessageType.ConnectionAck }),
    } as MessageEvent;
    const mockCloseEvent = {} as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(
      clientSubscribeMessage(subId1, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(clientUnsubscribeMessage(subId1));

    tester.dispatch(
      clientSubscribeMessage(subId2, { query: `query { hello }` })
    );

    tester.dispatch(transportOpened(mockOpenEvent));

    tester.dispatch(clientUnsubscribeMessage(subId2));

    tester.dispatch(
      clientSubscribeMessage(subId3, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(clientUnsubscribeMessage(subId3));

    tester.dispatch(transportMessage(mockAckEvent));

    tester.dispatch(transportClosed(mockCloseEvent));

    // no subscriptions were sent
    expect(
      tester
        .getCalledActions()
        .filter(
          a =>
            a.type === ProtocolMessageTypes.Send &&
            a.payload.message.includes('subscribe')
        )
    ).toHaveLength(0);
  });

  it('fails if first message is not a subscribe message', done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    tester.start(protocolLoop, {});

    tester.dispatch(clientUnsubscribeMessage(v4()));
  });

  it('fails if fatal error is received during connection', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const mockClosedEvent = { code: 1002 } as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(clientSubscribeMessage(v4(), { query: `query { hello }` }));

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportClosed(mockClosedEvent));
  });

  it('fails if fatal error is received before connection ack', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const mockOpenEvent = {} as Event;
    const mockClosedEvent = { code: 1002 } as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(clientSubscribeMessage(v4(), { query: `query { hello }` }));

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(transportClosed(mockClosedEvent));
  });

  it('fails if fatal error is received during main loop', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const mockOpenEvent = {} as Event;
    const mockAckEvent = {
      data: stringifyMessage({ type: MessageType.ConnectionAck }),
    } as MessageEvent;
    const mockClosedEvent = { code: 1002 } as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(clientSubscribeMessage(v4(), { query: `query { hello }` }));

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(transportMessage(mockAckEvent));

    await tester.waitFor(InstrumentationMessageTypes.Connected);

    tester.dispatch(transportClosed(mockClosedEvent));
  });

  it('fails if subscription is established multiple times before connection open', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const subId = v4();

    tester.start(protocolLoop, {});

    tester.dispatch(
      clientSubscribeMessage(subId, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(
      clientSubscribeMessage(subId, { query: `query { hello }` })
    );
  });

  it('fails if subscription is established multiple times before connection ack', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const subId = v4();

    const mockOpenEvent = {} as Event;

    tester.start(protocolLoop, {});

    tester.dispatch(
      clientSubscribeMessage(subId, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(
      clientSubscribeMessage(subId, { query: `query { hello }` })
    );
  });

  it('fails if subscription is established multiple times during main loop', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const subId = v4();

    const mockOpenEvent = {} as Event;
    const mockAckEvent = {
      data: stringifyMessage({ type: MessageType.ConnectionAck }),
    } as MessageEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(
      clientSubscribeMessage(subId, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(transportMessage(mockAckEvent));

    await tester.waitFor(InstrumentationMessageTypes.Connected);

    tester.dispatch(
      clientSubscribeMessage(subId, { query: `query { hello }` })
    );
  });

  it('restarts loop if connection is closed before init', async () => {
    jest.useFakeTimers();

    const tester = new SagaTester({});

    const mockCloseEvent = {} as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(clientSubscribeMessage(v4(), { query: `query { hello }` }));

    await tester.waitFor(ProtocolMessageTypes.Open);

    const newOpenRequest = tester.waitFor(ProtocolMessageTypes.Open, true);

    tester.dispatch(transportClosed(mockCloseEvent));

    jest.advanceTimersToNextTimer();

    await newOpenRequest;
  });

  it('restarts loop if connection is closed before ack', async () => {
    jest.useFakeTimers();

    const tester = new SagaTester({});

    const mockOpenEvent = {} as Event;
    const mockCloseEvent = {} as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(clientSubscribeMessage(v4(), { query: `query { hello }` }));

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    const newOpenRequest = tester.waitFor(ProtocolMessageTypes.Open, true);

    tester.dispatch(transportClosed(mockCloseEvent));

    jest.advanceTimersToNextTimer();

    await newOpenRequest;
  });

  it('restarts loop if connection is closed during main loop', async () => {
    jest.useFakeTimers();

    const tester = new SagaTester({});

    const mockOpenEvent = {} as Event;
    const mockAckEvent = {
      data: stringifyMessage({ type: MessageType.ConnectionAck }),
    } as MessageEvent;
    const mockCloseEvent = {} as CloseEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(clientSubscribeMessage(v4(), { query: `query { hello }` }));

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    const secondSend = tester.waitFor(ProtocolMessageTypes.Send, true);

    tester.dispatch(transportMessage(mockAckEvent));

    await secondSend;

    const newOpenRequest = tester.waitFor(ProtocolMessageTypes.Open, true);

    tester.dispatch(transportClosed(mockCloseEvent));

    jest.advanceTimersToNextTimer();

    await newOpenRequest;
  });

  it('fails if unexpected protocol message is received instead of ack', async done => {
    const tester = new SagaTester({
      options: {
        onError: () => {
          done();
        },
      },
    });

    const mockOpenEvent = {} as Event;
    const mockMessageEvent = {
      data: stringifyMessage({
        type: MessageType.Next,
        id: v4(),
        payload: { data: { hello: 'world' } },
      }),
    } as MessageEvent;

    tester.start(protocolLoop, {});

    tester.dispatch(clientSubscribeMessage(v4(), { query: `query { hello }` }));

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(transportMessage(mockMessageEvent));
  });

  it('multiple unsubscribe are idempotent', async done => {
    const tester = new SagaTester({ options: { onError: done } });

    const mockOpenEvent = {} as Event;
    const mockAckEvent = {
      data: stringifyMessage({ type: MessageType.ConnectionAck }),
    } as MessageEvent;

    const subId1 = v4();
    const subId2 = v4();
    const subId3 = v4();

    tester.start(protocolLoop, {});

    tester.dispatch(
      clientSubscribeMessage(subId1, { query: `query { hello }` })
    );
    tester.dispatch(
      clientSubscribeMessage(subId2, { query: `query { hello }` })
    );
    tester.dispatch(
      clientSubscribeMessage(subId3, { query: `query { hello }` })
    );

    await tester.waitFor(ProtocolMessageTypes.Open);

    tester.dispatch(clientUnsubscribeMessage(subId1));
    tester.dispatch(clientUnsubscribeMessage(subId1));

    tester.dispatch(transportOpened(mockOpenEvent));

    await tester.waitFor(ProtocolMessageTypes.Send);

    tester.dispatch(clientUnsubscribeMessage(subId1));
    tester.dispatch(clientUnsubscribeMessage(subId2));
    tester.dispatch(clientUnsubscribeMessage(subId2));

    tester.dispatch(transportMessage(mockAckEvent));

    await tester.waitFor(InstrumentationMessageTypes.Connected);

    tester.dispatch(clientUnsubscribeMessage(subId1));
    tester.dispatch(clientUnsubscribeMessage(subId2));
    tester.dispatch(clientUnsubscribeMessage(subId3));
    tester.dispatch(clientUnsubscribeMessage(subId3));

    done();
  });
});
