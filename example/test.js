const { createClient } = require('../lib');
const ws = require('ws');
const Observable = require('zen-observable');

const client = createClient({
  wsImpl: ws,
  url: 'ws://localhost:5002/graphql',
  on: {
    connecting: () => {
      console.log('connecting');
    },
    connected: (...args) => {
      console.log('connected', ...args);
    },
    closed: (event) => {
      console.log('closed', event.code, event.reason);
    },
  },
});

const obs = new Observable(sink => {
  return client.subscribe(
    {
      query: `subscription { catCreated { id } }`,
    },
    sink
  );
});

let count = 0;

const unsubscribe1 = obs.subscribe(msg => {
  console.log('observer 1', msg);
  count++;
  if (count > 2) {
    unsubscribe1.unsubscribe();
  }
});

obs.subscribe(msg => {
  console.log('observer 2', msg);
});

const queryObs = new Observable(sink => {
  return client.subscribe(
    {
      query: `query { hello }`,
    },
    sink
  );
});

queryObs.subscribe(msg => {
  console.log('query', msg);
});
