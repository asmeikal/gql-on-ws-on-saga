function isWebSocket(val: unknown): val is typeof WebSocket {
  return (
    typeof val === 'function' &&
    'constructor' in val &&
    'CLOSED' in val &&
    'CLOSING' in val &&
    'CONNECTING' in val &&
    'OPEN' in val
  );
}

export function getWebSocketImpl(wsImpl?: unknown): typeof WebSocket {
  let ws;
  if (wsImpl) {
    if (!isWebSocket(wsImpl)) {
      throw new Error('Invalid WebSocket implementation provided');
    }
    ws = wsImpl;
  } else if (typeof WebSocket !== 'undefined') {
    ws = WebSocket;
  } else if (typeof global !== 'undefined') {
    ws =
      global.WebSocket ||
      // @ts-expect-error: Support more browsers
      global.MozWebSocket;
  } else if (typeof window !== 'undefined') {
    ws =
      window.WebSocket ||
      // @ts-expect-error: Support more browsers
      window.MozWebSocket;
  }
  if (!ws) {
    throw new Error('WebSocket implementation missing');
  }
  return ws;
}
