/* eslint-disable prefer-const */
import express from 'express';
import {
  ApolloServer,
  PubSub,
  gql,
  makeExecutableSchema,
} from 'apollo-server-express';
import ws from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { execute, subscribe } from 'graphql';
import { createClient, Client } from '../src';
import Observable from 'zen-observable';
import * as http from 'http';
import { Disposable } from 'graphql-ws';
import { SagaTester } from '@moveaxlab/redux-saga-tester';
import { ProtocolMessageTypes, TransportMessageTypes } from '../src/types';

const typeDefs = gql`
  type Query {
    hello: String
  }
  type Notification {
    id: ID!
  }
  type Subscription {
    notification: Notification!
  }
`;

const pubSub = new PubSub();

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      hello: () => 'world',
    },
    Subscription: {
      notification: {
        subscribe: () => pubSub.asyncIterator(['notification']),
      },
    },
  },
});

const app = express();

const apolloServer = new ApolloServer({ schema });

apolloServer.applyMiddleware({ app });

let server: http.Server;

let wsServer: ws.Server;

let disposable: Disposable;

let client: Client;

const serverOnConnect = jest.fn();

beforeAll(() => {
  server = app.listen(5002, () => {
    wsServer = new ws.Server({
      server,
      path: '/graphql',
    });

    disposable = useServer(
      {
        schema,
        execute,
        subscribe,
        onConnect: serverOnConnect,
      },
      wsServer
    );
  });
});

afterAll(async () => {
  await disposable.dispose();
  await wsServer.close();
  await server.close();
  await apolloServer.stop();
});

afterEach(async () => {
  await client.dispose();
  jest.resetAllMocks();
});

describe('Test client implementation', () => {
  it('receives a subscription', done => {
    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      onError: done,
    });

    client.onConnected(() => {
      setTimeout(() => {
        pubSub.publish('notification', {
          notification: {
            id: '1',
          },
        });
      }, 100);
    });

    const obs = new Observable(sink =>
      client.subscribe(
        {
          query: `subscription { notification { id } }`,
        },
        sink
      )
    );

    const unsubscribe = obs.subscribe(msg => {
      expect(msg).toEqual({ data: { notification: { id: '1' } } });
      unsubscribe.unsubscribe();
      done();
    });
  });

  it('sends async connection params', done => {
    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      connectionParams: async () => ({
        param: 1,
      }),
      onError: done,
    });

    client.onConnected(() => {
      expect(serverOnConnect).toHaveBeenCalledTimes(1);
      expect(serverOnConnect.mock.calls[0][0].connectionParams).toEqual({
        param: 1,
      });
      done();
    });

    client.subscribe(
      {
        query: `subscription { notification { id } }`,
      },
      { next: jest.fn(), complete: jest.fn(), error: jest.fn() }
    );
  });

  it('reconnects on authentication error', done => {
    serverOnConnect
      .mockImplementationOnce(() => {
        return false;
      })
      .mockImplementation(() => {
        return true;
      });

    const onClose = jest.fn();

    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      on: { closed: onClose },
      onError: done,
    });

    client.onConnected(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose.mock.calls[0][0].code).toEqual(4403);
      expect(onClose.mock.calls[0][0].reason).toEqual('Forbidden');
      expect(serverOnConnect).toHaveBeenCalledTimes(2);
      done();
    });

    client.subscribe(
      {
        query: `subscription { notification { id } }`,
      },
      { next: jest.fn(), complete: jest.fn(), error: jest.fn() }
    );
  });

  it('receives connection ack payload', done => {
    serverOnConnect.mockReturnValue({ msg: 'hello' });

    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      onError: done,
    });

    client.onConnected(msg => {
      expect(msg).toEqual({ msg: 'hello' });
      done();
    });

    client.subscribe(
      {
        query: `subscription { notification { id } }`,
      },
      { next: jest.fn(), complete: jest.fn(), error: jest.fn() }
    );
  });

  it('runs queries through socket transport', done => {
    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      onError: done,
    });

    client.subscribe(
      {
        query: `query { hello }`,
      },
      {
        next(msg) {
          expect(msg).toEqual({ data: { hello: 'world' } });
        },
        complete() {
          done();
        },
        error(err) {
          done(err);
        },
      }
    );
  });

  it('receives subscription errors', done => {
    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      onError: done,
    });

    client.subscribe(
      {
        query: `subscription { nonExisting { id } }`,
      },
      {
        next() {
          done(new Error(`Received unexpected message`));
        },
        complete() {
          done(new Error(`Received unexpected complete`));
        },
        error() {
          done();
        },
      }
    );
  });

  it('fails to connect if server is unreachable', done => {
    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:34567/graphql',
      onError: done,
    });

    client.onClosed(() => {
      done();
    });

    client.subscribe(
      {
        query: `subscription { notification { id } }`,
      },
      { next: jest.fn(), complete: jest.fn(), error: jest.fn() }
    );
  });

  it('calls instrumentation callbacks passed in constructor', done => {
    const onConnecting = jest.fn();
    const onConnected = jest.fn();
    const onDisconnected = jest.fn();

    let socket: WebSocket;

    serverOnConnect.mockImplementation(ctx => {
      socket = ctx.extra.socket;
      return true;
    });

    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      onError: done,
      on: {
        connecting: onConnecting,
        connected: () => {
          onConnected();
          socket.close(1000, 'Going away');
        },
        closed: () => {
          onDisconnected();
          expect(onConnecting).toHaveBeenCalledBefore(onConnected);
          expect(onConnected).toHaveBeenCalledBefore(onDisconnected);
          done();
        },
      },
    });

    client.subscribe(
      {
        query: `subscription { notification { id } }`,
      },
      { next: jest.fn(), complete: jest.fn(), error: jest.fn() }
    );
  });

  it('calls instrumentation callbacks set after client creation', done => {
    const onConnecting = jest.fn();
    const onConnected = jest.fn();
    const onDisconnected = jest.fn();

    let socket: WebSocket;

    serverOnConnect.mockImplementation(ctx => {
      socket = ctx.extra.socket;
      return true;
    });

    client = createClient({
      wsImpl: ws,
      url: 'ws://localhost:5002/graphql',
      onError: done,
    });

    client.onConnecting(onConnecting);
    client.onConnected(() => {
      onConnected();
      socket.close(1000, 'Going away');
    });
    client.onClosed(() => {
      onDisconnected();
      expect(onConnecting).toHaveBeenCalledBefore(onConnected);
      expect(onConnected).toHaveBeenCalledBefore(onDisconnected);
      done();
    });

    client.subscribe(
      {
        query: `subscription { notification { id } }`,
      },
      { next: jest.fn(), complete: jest.fn(), error: jest.fn() }
    );
  });

  it('queues operation during connection phase', done => {
    let startSubscriptionBeforeOpen: () => void;
    let startSubscriptionBeforeAck: () => void;

    const tester = new SagaTester({
      middlewares: [
        () => next => action => {
          if (action.type === ProtocolMessageTypes.Open) {
            startSubscriptionBeforeOpen();
          } else if (action.type === TransportMessageTypes.Opened) {
            startSubscriptionBeforeAck();
          }
          return next(action);
        },
      ],
    });

    client = createClient(
      {
        wsImpl: ws,
        url: 'ws://localhost:5002/graphql',
        onError: done,
      },
      {
        run: tester.start.bind(tester),
      }
    );

    let beforeOpenReceived = false;
    let beforeAckReceived = false;
    let startSubscriptionReceived = false;

    client.onConnected(() => {
      setTimeout(() => {
        pubSub.publish('notification', { notification: { id: '1' } });
        setTimeout(() => {
          expect(beforeOpenReceived).toBeTruthy();
          expect(beforeAckReceived).toBeTruthy();
          expect(startSubscriptionReceived).toBeTruthy();
          done();
        }, 100);
      }, 100);
    });

    startSubscriptionBeforeOpen = () => {
      client.subscribe(
        {
          query: `subscription { notification { id } }`,
        },
        {
          next: () => {
            beforeOpenReceived = true;
          },
          complete: jest.fn(),
          error: jest.fn(),
        }
      );
    };

    startSubscriptionBeforeAck = () => {
      client.subscribe(
        {
          query: `subscription { notification { id } }`,
        },
        {
          next: () => {
            beforeAckReceived = true;
          },
          complete: jest.fn(),
          error: jest.fn(),
        }
      );
    };

    client.subscribe(
      {
        query: `subscription { notification { id } }`,
      },
      {
        next: () => {
          startSubscriptionReceived = true;
        },
        complete: jest.fn(),
        error: jest.fn(),
      }
    );
  });
});
