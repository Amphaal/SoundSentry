import { WebSocket } from "ws";

/**
 * WebSocket payload, for duplex communications
 * @typedef {{id: string, r: string}} WebSocketPayload
 */

/**
 *  d
 * @typedef {(payload: WebSocketPayload) => bool} WebSocketMiddleware
 */
