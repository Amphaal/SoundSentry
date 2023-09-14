import { readFile, existsSync, writeFileSync, chownSync, readFileSync } from 'fs';
import Watcher from 'watcher';
import { SoundVitrineDatabaseFolderPath, ExpectedUserDatabaseFileName, PHPOwnerUserID, PHPOwnerGroupID } from '../_const.js';
import { WebSocket } from 'ws';
import { createHash } from 'crypto';

//
//
//

const dbFileToWatch = SoundVitrineDatabaseFolderPath + "/" + ExpectedUserDatabaseFileName;

/**
 * can be null if unset
 * @type {Watcher}}
 */
var dbFileWatcher = null;

/**
 * key is username
 * @type {Object.<string, ?{ password: string | null }}>}
 */
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
 * @param {import("ws").WebSocket} socket socket authenticated with, might hold which username he is connected to 
 * @param {string} path path on which the socket registered. might contain username in first segment 
 * @param {id: ("checkCredentials"), r: string} auth_payload
 * @returns {id: ("credentialsChecked"), r: string}
 * @param {string} username 
 */
export function authenticateUser(socket, auth_payload, username) {
    //
    const password = auth_payload.r;

    //
    const authResult = (() => {
        if (username == null) {
            return produceAuthResult("cdm");
        }

        //check if credentials are here
        if(username == null || password == null) return produceAuthResult("cdm");
        if(db == null) return produceAuthResult("eud");
        
        username = String(username).toLowerCase();
        
        if(db[username] == null) return produceAuthResult("unfid");
        if(db[username]["password"] == null) return produceAuthResult("nopass");
        if(db[username]["password"] != password) return produceAuthResult("pmiss");
        
        //
        return produceAuthResult(username, true);
    })();
    
    //
    //
    //

    if (!authResult.isLoginOk) {
        console.log(username, ": Failed auth with code ", authResult.accomp);
    } else {
        // OK
        socket.username = username;
        socket.password_hash = createHash('md5').update(password).digest('hex');

        //
        console.log(username, ": Successfully logged !");
    }

    //
    return  {
        id: "credentialsChecked",
        r: authResult.isLoginOk ? "ok" : authResult.accomp
    };
}

/** Refreshes local copy of database from expected file */
function updateDbCache() {
    db = JSON.parse(
        readFileSync(dbFileToWatch, {
            encoding: 'utf-8'
        })
    );
}

/**
 * tell the appropriate clients that they might re-ask for credentials validation on password invalidation
 * @param {WebSocket[]} allSockets all connected sockets, which might contain sockets that are 
 * @returns 
 */
function shoutToAffectedClientsThatDatabaseUpdated(allSockets) {
    //
    const passHashesByUsers = Object.fromEntries(
        Object.entries(db).map(([username, params]) => {
            const foundPassword = params['password'];
            return [
                username, 
                foundPassword != null 
                    ? createHash('md5').update(foundPassword).digest('hex') 
                    : null
            ]
        })
    )

    //
    console.log("Trying to determine which users must re-authenticate");

    //
    for (const connectedSocket of allSockets) {
        if (connectedSocket.readyState !== WebSocket.OPEN) continue;

        // if socket not authenticated, no need to go forward
        const socketUsername = connectedSocket['username'];
        if(socketUsername == null) continue;

        // if socket has the same password hash in database, no seed to go forward
        const associatedPassHash = passHashesByUsers[socketUsername];
        if (associatedPassHash == connectedSocket['password_hash']) continue;

        //
        // reset auth on socket 
        //

        console.log(socketUsername, ": please login again !");

        connectedSocket.username = undefined;
        connectedSocket.password_hash = undefined;

        delete connectedSocket.username;
        delete connectedSocket.password_hash;

        //
        // tells the socket that database changed
        //

        //
        connectedSocket.send(JSON.stringify({
            id: "databaseUpdated",
            r: ""
        }));
    }
}

/**
 * On each new socket connection, do this
 * This Service is exclusively used by SoundBuddy to help the user understand if his credentials are OK,
 * and along side with ping / pong capabilities of WebServices, tell if the server-side services are up
 * @param {WebSocket} freshSocket socket that just connected 
 * @param {WebSocket[]} allSockets all connected sockets 
 * @param {string} username 
 * @returns {WebSocketMiddleware}
 */
export function setupOnSocketReady(freshSocket, allSockets, username) {
    // Maintenance: ensure recreation of database, even if deleted
    if(!existsSync(dbFileToWatch)) {
        writeFileSync(dbFileToWatch, "{}");
        try {
            chownSync(dbFileToWatch, PHPOwnerUserID, PHPOwnerGroupID); // permit the php server to override it
        } catch {
            console.warn("cannot update owner of file ", dbFileToWatch, " to ", PHPOwnerUserID,":",PHPOwnerGroupID);
        }
    }

    // Maintenance: if no watcher registered, do it
    if (dbFileWatcher == null) {
        //update cache
        updateDbCache();

        //on succeed, start listener
        dbFileWatcher = new Watcher(dbFileToWatch);

        // on DB file change...
        dbFileWatcher.on("all", async function(event, targetPath, targetPathNext) {
            // update cached version
            updateDbCache();

            //
            console.log("Users database changed !");

            // signals to affected sockets that their password might have changed, and thus request again their password
            shoutToAffectedClientsThatDatabaseUpdated(allSockets);
        });
    }

    /** Middleware router */
    return (payload) => {
        switch(payload.id) {
            case "checkCredentials": {
                const response = authenticateUser(freshSocket, payload, username);
                freshSocket.send(JSON.stringify(response));
            }
            break;

            default: {
                return false;
            }
        }

        //
        return true;
    };


}
