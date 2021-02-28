# gql-on-ws-on-saga

[![npm](https://img.shields.io/npm/v/gql-on-ws-on-saga)](https://www.npmjs.com/package/gql-on-ws-on-saga)
[![Builds](https://img.shields.io/github/workflow/status/asmeikal/gql-on-ws-on-saga/Test%20CI/main)](https://github.com/asmeikal/gql-on-ws-on-saga/actions)
[![Code coverage](https://img.shields.io/coveralls/github/asmeikal/gql-on-ws-on-saga/main)](https://coveralls.io/github/asmeikal/gql-on-ws-on-saga)

> Turtles all the way down.

This repo is an experiment in how easily can a protocol be implemented using `redux-saga` as an engine.
The protocol in question is the [`graphql-ws` protocol](https://github.com/enisdenjo/graphql-ws),
but only for the client side.

The motivation for this experiment is a lot of frustration with the bugs
that plague the `subscriptions-transport-ws` client implementation,
and wanting to have an opinionated client for the `graphql-ws` protocol.

The implementation is split in three layers:
- the client, that handles subscriptions (and operations in general),
  and implements the public API
- the protocol, that keeps track of subscriptions, routes them through the
  transport, and sends messages from the transport to the client
- the transport, that wraps the WebSocket connection

![The three layers](https://github.com/asmeikal/gql-on-ws-on-saga/raw/main/assets/layers.png?raw=true)

The client layer is oblivious to connections and disconnections
of the underlying WebSocket (unless it listens to the instrumentation events),
while the protocol layer has the responsibility of performing all operations
that the client requests, and track them until completion.
If the WebSocket fails, it's the protocol responsibility to reconnect
the transport, and to re-establish all operations.

Is this efficient? IDK and IDC.

Is this correct? IDK but I hope it is.

Should you use this? At your own risk.

The code in this repo could be modified to create a client for the
`subscriptions-transport-ws`, even though I see no reason to do so,
since most of the bugs that plague the protocol affect also the server implementation.
