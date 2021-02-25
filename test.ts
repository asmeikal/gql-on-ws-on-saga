import { createClient } from './src';
import ws from 'ws';
import Observable from 'zen-observable';

const client = createClient({
  wsImpl: ws,
  url: 'ws://localhost:5002/graphql',
});

const obs = new Observable(sink => {
  return client.subscribe(
    {
      query: `subscription { catCreated { id } }`,
    },
    sink
  );
});

obs.subscribe(msg => {
  console.log('observer', msg);
});
