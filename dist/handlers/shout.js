var fs = require('fs');
var nsfw = require('nsfw');

var fileWatchers = {};
var newShoutVerb = 'newShout';
var shoutNsp = null;

function getPathToWatch(userToWatch) {
    return '/srv/data/users/' + userToWatch + "/shout.json";
}

function sendUserShoutTo(pathToWatch, target) {
    fs.readFile(pathToWatch, 'utf8', function (err, contents) {
        if (contents) {
            target.emit(newShoutVerb, contents);
        }
    }); 
}

function handleSockets(socket, nsp) {

    //bind namespace for local usage
    if (!shoutNsp) shoutNsp = nsp;
    
    //get user to watch
    const userToWatch = socket.handshake.query.userToWatch;

    if (userToWatch) {

        let pathToWatch = getPathToWatch(userToWatch);
        
        //create if not exist
        if(!fs.existsSync(pathToWatch)) {
            logForUser("create default shout file !");
            fs.writeFileSync(pathToWatch, "{}");
            fs.chownSync(pathToWatch, 1000, 1000); //permit the php server to override it
        }

        //if no watcher registered
        if (!fileWatchers[userToWatch]) {

            //watcher
            let watch;
            nsfw(pathToWatch, function(events) {
                sendUserShoutTo(pathToWatch, shoutNsp.to(userToWatch));
            }).then(function(watcher) {
                watch = watcher;
                return watcher.start();
            });

            //register...
            fileWatchers[userToWatch] = watch;
        }

        //initial shout fetch
        sendUserShoutTo(pathToWatch, socket); 
        socket.join(userToWatch);
    }
}

module.exports = {
    handleSockets : handleSockets
};
