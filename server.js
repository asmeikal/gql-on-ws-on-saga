const { buildSchema, execute, subscribe } =  require('graphql');
const http = require('http');
const ws = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');


// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
  type Query {
    hello: String
  }
  type CatCreated {
    id: ID!
  }
  type Subscription {
    catCreated: CatCreated!
  }
`);

// The roots provide resolvers for each GraphQL operation
const roots = {
  query: {
    hello: () => 'Hello World!',
  },
  subscription: {
    catCreated: async function* sayHiIn5Languages() {
      let id = 1;
      while (true) {
        await new Promise(res => setTimeout(res, 10000));
        yield { catCreated: { id : `${id}` } };
        id++;
      }
    },
  },
};

const server = http.createServer(function weServeSocketsOnly(_, res) {
  res.writeHead(400);
  res.end();
});

const wsServer = new ws.Server({
  server,
  path: '/graphql',
});

useServer(
  {
    schema, // from the previous step
    roots, // from the previous step
    execute,
    subscribe,
  },
  wsServer,
  1000,
);

server.listen(5002);
