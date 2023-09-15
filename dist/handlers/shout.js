import { readFile, existsSync, writeFileSync, chownSync, mkdirSync } from 'fs';
import Watcher from 'watcher';
import { SoundVitrineDatabaseFolderPath, ExpectedShoutFileNameOnUserProfile, PHPOwnerUserID, PHPOwnerGroupID } from '../_const.js';
import { WebSocket } from 'ws';
import { dirname } from 'path';

/**
 * key is username
 * @type {Object.<string, Watcher>}
 */
var fileWatchers = {};

/**
 * key is username
 * @type {Object.<string, WebSocket[]>}
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
 * @param {WebSocket[]} sockets sockets which will receive update notification
 */
function sendStoredShoutOfUserTo(pathToShoutFile, ofUser, sockets) {
    readFile(pathToShoutFile, 'utf8', function (err, contents) {
        //
        if (contents == null) return;

        //
        for(const socket of sockets) {
            // TODO: might need to cleanup closed sockets in rooms
            if (socket.readyState !== WebSocket.OPEN) continue;

            //
            socket.send(JSON.stringify({
                id: "newShout",
                r: contents
            }));
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
        chownSync(shoutFileToWatch, PHPOwnerUserID, PHPOwnerGroupID); //permit the php server to override it
    } catch {
        console.warn("cannot update owner of file ", shoutFileToWatch, " to ", PHPOwnerUserID,":",PHPOwnerGroupID);
    }
}

/** 
 * TODO: Might add a cleanup method to remove "not-used-anymore" watchers, with timestamp and expiry duration (smthing like 3 hours ?)
 */
function mayRegisterShoutFileWatcher(userToWatch, shoutFileToWatch) {
    // if watcher is already there, nothing to do
    if (fileWatchers[userToWatch]) return;

    //register watcher..
    var watcher = new Watcher(shoutFileToWatch);
    fileWatchers[userToWatch] = watcher;

    //
    watcher.on("all", function(event, targetPath, targetPathNext) {
        sendStoredShoutOfUserTo(shoutFileToWatch, userToWatch, userRooms[userToWatch]);
    });
}

/**
 * Essentially allow anonymous sockets from SoundVitrine, typically visitors of SoundVitrine, user profile
 * @param {WebSocket} freshSocket socket that just connected 
 * @param {WebSocket[]} allSockets all connected sockets 
 * @param {string} userToWatch 
 */
export function setupOnSocketReady(freshSocket, _, userToWatch) {
    //
    const shoutFileToWatch = getAssociatedShoutFilePath(userToWatch);
    
    // Maintenance: create if not exist
    mayCreateShoutFile(shoutFileToWatch);

    // 
    mayRegisterShoutFileWatcher(userToWatch, shoutFileToWatch);

    // initial shout fetch
    sendStoredShoutOfUserTo(shoutFileToWatch, userToWatch, [freshSocket]); 

    // join room
    if(userRooms[userToWatch]) {
        userRooms[userToWatch].push(freshSocket);
    } else {
        userRooms[userToWatch] = [freshSocket];
    }
}
