import { readFile, existsSync, writeFileSync, chownSync } from 'fs';
import Watcher from 'watcher';
import { SoundVitrineDatabaseFolderPath, ExpectedShoutFileNameOnUserProfile } from '../_const.js';
import { WebSocket } from 'ws';

var dbFileToWatch = SoundVitrineDatabaseFolderPath + "/" + ExpectedShoutFileNameOnUserProfile;
var dbFileWatcher = null;
var db = null;

//
//
//

/**
 * Auth result
 * @typedef {{isLoginOk: boolean, accomp: "cdm"|"eud"|"unfid"|"nopass"|"pmiss"|string}} AuthResult
 */

/**
 * macro function for quickly outputing result
 * @param {("cdm"|"eud"|"unfid"|"nopass"|"pmiss"|string)} accomp can be either, the username if sucessful, or a str ID corresponding to an error
 * @param {boolean | undefined } hasNotFailed Tells if authentication process was successful (matching passwords, etc.)
 * @return {AuthResult}
 */
function produceAuthResult(accomp, hasNotFailed) {
    return {
        "isLoginOk": hasNotFailed ?? false,
        "accomp": accomp
    };
}

/**
 * @param {import('http').default} request 
 * @param {{ 
 *  next: (msgType: ("credentialsChecked"), authResult: AuthResult, outputToSend: string) => void,
 * }} options
 */
export function authenticateUser(path, auth_payload, answer) {
    //
    const username = ;
    const password = auth_payload.r;

    //
    const authResult = (() => {
        //check if credentials are here
        if(username == null || password == null) return produceAuthResult("cdm");
        if(db == null) return produceAuthResult("eud");
        
        username = String(username).toLowerCase();
        
        if(db[username] == null) return produceAuthResult("unfid");
        if(db[username]["password"] == null) return produceAuthResult("nopass");
        if(db[username]["password"] != password) return produceAuthResult("pmiss");
        
        // OK
        return produceAuthResult(username, true);
    })();
    
    //
    options.next("credentialsChecked", authResult.isLoginOk ? "ok" : authResult.accomp);
}

//replace internal users db
function updateDbCache() {
    return new Promise(function(resolve, reject) {
        readFile(dbFileToWatch, 'utf8', function (err, contents) {
            if (err) return reject(err);
            try {
                db = JSON.parse(contents);
                return resolve();
            } catch(e) {
                return reject(e);
            }
        });
    });
}

/**
 * tell the client that he could reask for credentials validation
 * @param {WebSocket[]} allSockets all connected sockets 
 * @returns 
 */
function shoutToClientsThatDatabaseUpdated(allSockets) {
    return function() {
        allSockets.emit("databaseUpdated"); 
    }
}

/**
 * On each new socket connection, do this
 * @param {WebSocket} freshSocket socket that just connected 
 * @param {WebSocket[]} allSockets all connected sockets 
 * @returns {WebSocketMiddleware}
 */
export function setupOnSocketReady(freshSocket, allSockets) {
    // Maintenance: ensure recreation of database, even if deleted
    if(!existsSync(dbFileToWatch)) {
        writeFileSync(dbFileToWatch, "{}");
        chownSync(dbFileToWatch, 1000, 1000); // permit the php server to override it
    }

    // Maintenance: if no watcher registered, do it
    if (dbFileWatcher == null) {
        //update cache
        updateDbCache().then(function() {
            //on succeed, start listener
            dbFileWatcher = new Watcher(dbFileToWatch);
            dbFileWatcher.on("all", function(_) {
                //update cache then shout
                updateDbCache().then(shoutToClientsThatDatabaseUpdated(allSockets));
            });
        })
    }

        //define behavior on credentials check request
        freshSocket.on("checkCredentials", function(username, password) {
            checkIfLoginIsOk(username, password, function(results) {
                freshSocket.send(JSON.stringify({id: "credentialsChecked", r: results}));
            })
        });

    /** Middleware router */
    return (payload) => {
        switch(payload.id) {
            case "checkCredentials": {
                authenticateUser();
            }
            break;

            default: {
                return false;
            }

            //
            return true;
        }
    };


}
