import { readFile, existsSync, writeFileSync, chownSync } from 'fs';
import Watcher from 'watcher';
import { SoundVitrineDatabaseFolderPath, ExpectedShoutFileNameOnUserProfile } from '../_const.js';
import { getBoundUserProfile } from './_all.js';
import { WebSocket } from 'ws';

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
            if (client.readyState !== WebSocket.OPEN) continue;

            //
            socket.send(JSON.stringify({
                id: "newShout",
                r: ofUser
            }));
        }
    }); 
}

/** 
 * If do not exist, create shout file 
 */
function mayCreateShoutFile(shoutFileToWatch) {
    if(existsSync(shoutFileToWatch)) return;
    console.log(userToWatch, ": create default shout file !");
    writeFileSync(shoutFileToWatch, "{}");
    chownSync(shoutFileToWatch, 1000, 1000); //permit the php server to override it
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
    watcher.on("all", function(_) {
        sendStoredShoutOfUserTo(shoutFileToWatch, userToWatch, userRooms[userToWatch]);
    });
}

/**
 * Essentially allow anonymous sockets from SoundVitrine, typically visitors of SoundVitrine, user profile
 * @param {WebSocket} freshSocket socket that just connected 
 * @param {WebSocket[]} allSockets all connected sockets 
 */
export function setupOnSocketReady(freshSocket, _) {

    //get user to watch
    const userToWatch = getBoundUserProfile(freshSocket);
    if (userToWatch == null) {
        console.warn('Socket cannot listen to shouts of ', freshSocket.url, ', url should end with username');
        return;
    }

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
