import watcher from '@parcel/watcher';
import { dirname, normalize } from 'path';

/**
 * WebSocket payload, for duplex communications
 * @typedef {{id: string, r: string}} WebSocketPayload
 */

/**
 * @typedef {(payload: WebSocketPayload) => boolean} WebSocketMiddleware
 */

/**
 * key is username
 * @type {Object.<string, Date>}
 */
var debouncer = {};

//
const eventDebounceMs = 300;

/**
 * 
 * @param {string} fileToWatch path to file
 * @param {() => void} onChange 
 * @returns {Promise<watcher.AsyncSubscription>}
 */
export async function watchFile(fileToWatch, onChange) {
    //
    fileToWatch = normalize(fileToWatch);

    //
    const folderContaining_fileToWatch = dirname(fileToWatch);

    //
    const subscription = await watcher.subscribe(folderContaining_fileToWatch, function(err, events) {
        // TODO: debounce subscriptions
        for(const event of events) {
            //
            if (event.path != fileToWatch) continue;

            // debounce ?
            const latestPubDate = debouncer[event.path];
            if (latestPubDate != null && ((Date.now() - latestPubDate.getTime()) < eventDebounceMs)) {
                // events too close to eachother for this specific path, skip
                continue;
            }

            //
            debouncer[event.path] = new Date();

            //
            console.log("detected change on file [", event.path ,"] (\"", event.type, "\")");
            
            //
            onChange();
        }
    });
    
    //
    console.log("Registered filewatch on [", fileToWatch,']');

    //
    return subscription;
}