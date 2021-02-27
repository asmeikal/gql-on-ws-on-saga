import { Channel } from 'redux-saga';
import { TransportToProtocolMessage } from '../structures';
import {
  transportClosed,
  transportError,
  transportMessage,
  transportOpened,
} from '../builders';

export interface WebSocketOptions {
  url: string;
  wsImpl: typeof WebSocket;
  channel: Channel<TransportToProtocolMessage>;
}

export function createWebSocket({
  url,
  wsImpl: WebSocketImpl,
  channel: ch,
}: WebSocketOptions) {
  const socket = new WebSocketImpl(url, ['graphql-transport-ws']);

  const onOpen = (event: Event) => ch.put(transportOpened(event));
  const onMessage = (event: MessageEvent) => ch.put(transportMessage(event));
  const onError = (error: Event) => ch.put(transportError(error));
  const onClose = (event: CloseEvent) => ch.put(transportClosed(event));

  socket.addEventListener('open', onOpen);
  socket.addEventListener('message', onMessage);
  socket.addEventListener('error', onError);
  socket.addEventListener('close', onClose);

  return {
    socket,
    cleanup: () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
    },
  };
}
