/**
 * WebSocket payload, for duplex communications
 * @typedef {{id: string, r: string}} WebSocketPayload
 */

/**
 * 
 * @typedef {(payload: WebSocketPayload) => bool} WebSocketMiddleware
 */