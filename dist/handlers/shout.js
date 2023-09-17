import { readFile, existsSync, writeFileSync, chownSync, mkdirSync } from 'fs';
import { SoundVitrineDatabaseFolderPath, ExpectedShoutFileNameOnUserProfile, RWUserID, RWGroupID } from '../_const.js';
import { WebSocket } from 'ws';
import { watchFile } from './_all.js';
import { dirname } from 'path';

/**
 * key is username
 * @type {Object.<string, import('@parcel/watcher').AsyncSubscription>}
 */
var fileWatchers = {};

/**
 * key is username
 * @type {Object.<string, Set<WebSocket>>}
 */
var userRooms = {};

/** 
 * @param {string} ofUser username
 * @returns path to the expected filename within database folder of the "shout file", which corresponds to user's profile folder
 */
function getAssociatedShoutFilePath(ofUser) {
    return SoundVitrineDatabaseFolderPath + '/users/' + ofUser + "/" + ExpectedShoutFileNameOnUserProfile;
}

/** 
 * @param {string} pathToShoutFile shout file that have to be emited
 * @param {string} ofUser username
 * @param {Set<WebSocket>} sockets sockets which will receive update notification
 */
function sendStoredShoutOfUserTo(pathToShoutFile, ofUser, sockets) {
    readFile(pathToShoutFile, 'utf8', function (err, contents) {
        //
        if (contents == null) return;

        let count = 0;

        //
        for(const socket of sockets) {
            // TODO: might need to cleanup closed sockets in rooms
            if (socket.readyState !== WebSocket.OPEN) continue;

            count++;

            //
            socket.send(JSON.stringify({
                id: "newShout",
                r: contents
            }));
        }

        //
        if (count > 0) {
            console.log("New shout of'", ofUser ,"', sending notification to", count, "listeners.");
        }
    }); 
}

/** 
 * If do not exist, create shout file 
 */
function mayCreateShoutFile(shoutFileToWatch) {
    //
    if(existsSync(shoutFileToWatch)) return;

    //
    console.log(shoutFileToWatch, ": create default shout file !");
    
    mkdirSync(dirname(shoutFileToWatch), { recursive: true });
    writeFileSync(shoutFileToWatch, "{}");

    try {
        chownSync(shoutFileToWatch, RWUserID, RWGroupID); //permit the php server to override it
    } catch {
        console.warn("cannot update owner of file ", shoutFileToWatch, " to ", RWUserID,":", RWGroupID);
    }
}

/** 
 * TODO: Might add a cleanup method to remove "not-used-anymore" watchers, with timestamp and expiry duration (smthing like 3 hours ?)
 */
async function mayRegisterShoutFileWatcher(userToWatch, shoutFileToWatch) {
    // if watcher is already there, nothing to do
    if (fileWatchers[userToWatch]) return;

    //register watcher..
    fileWatchers[userToWatch] = await watchFile(shoutFileToWatch, function onChange() {
        sendStoredShoutOfUserTo(shoutFileToWatch, userToWatch, userRooms[userToWatch]);
    });
}

/**
 * Essentially allow anonymous sockets from SoundVitrine, typically visitors of SoundVitrine, user profile
 * @param {WebSocket} freshSocket socket that just connected 
 * @param {Set<WebSocket>} allSockets all connected sockets 
 * @param {string} userToWatch 
 * @returns {import('./_all.js').WebSocketMiddleware}
 */
export async function setupOnSocketReady(freshSocket, allSockets, userToWatch) {
    //
    const shoutFileToWatch = getAssociatedShoutFilePath(userToWatch);
    
    // Maintenance: create if not exist
    mayCreateShoutFile(shoutFileToWatch);

    // 
    await mayRegisterShoutFileWatcher(userToWatch, shoutFileToWatch);

    // initial shout fetch
    sendStoredShoutOfUserTo(shoutFileToWatch, userToWatch, new Set([freshSocket])); 

    // join room
    if(userRooms[userToWatch]) {
        userRooms[userToWatch].add(freshSocket);
    } else {
        userRooms[userToWatch] = new Set([freshSocket]);
    }

    //
    console.log("New WS client connected to shouts of '", userToWatch , "' !");

    //
    return (_) => {
        return true;
    };
}
