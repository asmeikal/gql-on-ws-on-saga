import {
  AnyAction,
  ClientToProtocolMessage,
  ProtocolToSubscriptionMessage,
  ProtocolToTransportMessage,
  TransportClosedMessage,
  TransportToProtocolMessage,
} from './structures';
import {
  ClientMessageTypes,
  ProtocolMessageTypes,
  TransportMessageTypes,
} from './types';

export function isMessageForSubscription(id: string) {
  return function(
    message: AnyAction
  ): message is ProtocolToSubscriptionMessage {
    return (
      [
        ProtocolMessageTypes.Next,
        ProtocolMessageTypes.Close,
        ProtocolMessageTypes.Error,
      ].includes(message.type) && message.payload?.id == id
    );
  };
}

export function isMessageForProtocol(
  message: AnyAction
): message is TransportToProtocolMessage | ClientToProtocolMessage {
  return [
    TransportMessageTypes.Opened,
    TransportMessageTypes.Message,
    TransportMessageTypes.Error,
    TransportMessageTypes.Closed,
    ClientMessageTypes.Subscribe,
    ClientMessageTypes.Unsubscribe,
  ].includes(message.type);
}

export function isMessageForTransport(
  message: AnyAction
): message is ProtocolToTransportMessage | TransportClosedMessage {
  return [
    ProtocolMessageTypes.Open,
    ProtocolMessageTypes.Send,
    ProtocolMessageTypes.Close,
    TransportMessageTypes.Closed,
  ].includes(message.type);
}
