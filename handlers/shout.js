var fs = require('fs');
var nsfw = require('nsfw');

var fileWatchers = {};
var newShoutVerb = 'newShout';
var shoutNsp = null;

function getPathToWatch(userToWatch) {
    return '/srv/data/users/' + userToWatch + "/shout.json";
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
                fs.readFile(pathToWatch, 'utf8', function (err, contents) {
                    shoutNsp.to(userToWatch).emit(newShoutVerb, contents);
                }); 
            }).then(function(watcher) {
                watch = watcher;
                return watcher.start();
            });

            //register...
            fileWatchers[userToWatch] = watch;
        }

        //initial shout fetch
        fs.readFile(pathToWatch, 'utf8', function (err, contents) {
            if (contents) socket.emit(newShoutVerb, contents);
        }); 
        socket.join(userToWatch);
    }
}

module.exports = {
    handleSockets : handleSockets
};
