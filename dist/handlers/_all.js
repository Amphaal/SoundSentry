import { WebSocket } from "ws";

/**
 * WebSocket payload, for duplex communications
 * @typedef {{id: string, r: string}} WebSocketPayload
 */

/**
 * 
 * @typedef {(payload: WebSocketPayload) => bool} WebSocketMiddleware
 */

/**
 * 
 * @param {WebSocket} ofSocket 
 * @returns {undefined | string} username
 */
export function getBoundUserProfile(ofSocket) {
    const pathSegments = ofSocket.url.split('/');
    if (pathSegments.length < 1 || pathSegments[0].length == 0) {
        return undefined;
    }
    return pathSegments[0];
}