export enum MessageType {
  ConnectionInit = 'connection_init', // Client -> Server
  ConnectionAck = 'connection_ack', // Server -> Client

  Subscribe = 'subscribe', // Client -> Server
  Next = 'next', // Server -> Client
  Error = 'error', // Server -> Client
  Complete = 'complete', // bidirectional
}
