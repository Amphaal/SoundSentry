import { readFile, existsSync, writeFileSync, chownSync } from 'fs';
import Watcher from 'watcher';
import { SoundVitrineDatabaseFolderPath } from '../_const.js';

var fileWatchers = {};
var newShoutVerb = 'newShout';
var shoutNsp = null;

function getPathToWatch(userToWatch) {
    return SoundVitrineDatabaseFolderPath + '/users/' + userToWatch + "/shout.json";
}

function sendUserShoutTo(pathToWatch, target) {
    readFile(pathToWatch, 'utf8', function (err, contents) {
        if (contents) {
            target.emit(newShoutVerb, contents);
        }
    }); 
}

export function handleSockets(socket, nsp) {

    //bind namespace for local usage
    if (!shoutNsp) shoutNsp = nsp;
    
    //get user to watch
    const userToWatch = socket.handshake.query.userToWatch;

    if (userToWatch) {

        let pathToWatch = getPathToWatch(userToWatch);
        
        //create if not exist
        if(!existsSync(pathToWatch)) {
            logForUser("create default shout file !");
            writeFileSync(pathToWatch, "{}");
            chownSync(pathToWatch, 1000, 1000); //permit the php server to override it
        }

        //if no watcher registered
        if (!fileWatchers[userToWatch]) {

            //register watcher..
            var watcher = new Watcher(pathToWatch);
            fileWatchers[userToWatch] = watcher;
            watcher.on("all", function(_) {
                sendUserShoutTo(pathToWatch, shoutNsp.to(userToWatch));
            });
        }

        //initial shout fetch
        sendUserShoutTo(pathToWatch, socket); 
        socket.join(userToWatch);
    }
}
