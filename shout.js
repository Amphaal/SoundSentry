var fs = require('fs');
var nsfw = require('nsfw');

var fileWatchers = {};
var newShoutVerb = 'newShout';

function getPathToWatch(userToWatch) {
    return '/srv/data/users/' + userToWatch + "/shout.json";
}

function getRoomLength(roomName) {
    return io.sockets.adapter.rooms[roomName].length;
}

function handleSockets(socket) {

    //get user to watch
    const userToWatch = socket.handshake.query.userToWatch;

    if (userToWatch) {

        //loging factory function
        function logForUser(log) {
            console.log("\"" + userToWatch + "\" : " + log);
        }

        logForUser("new connection for user's shouts");
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
                    io.to(userToWatch).emit(newShoutVerb, contents);
                }); 
            }).then(function(watcher) {
                watch = watcher;
                return watcher.start();
            });

            //register...
            logForUser("registering shouts watcher !");
            fileWatchers[userToWatch] = watch;
        }

        //initial shout fetch
        fs.readFile(pathToWatch, 'utf8', function (err, contents) {
            if (contents) socket.emit(newShoutVerb, contents);
        }); 
        socket.join(userToWatch);

        logForUser("Succesful registering. Total number of connections for this user : " + getRoomLength(userToWatch));
    }

    //on user disconnect
    socket.on('disconnect', function () {

        logForUser("disconnect. Remaining connections for this user : " + getRoomLength(userToWatch));

        //close watcher
        // if(socketsByFW[userToWatch] <= 0) {
        //     console.log("Closing \"" + userToWatch + "\" file watcher...");
        //     fileWatchers[userToWatch].close(); 
        //     fileWatchers[userToWatch] == null;
        // }
    });
}

module.exports = {
    handleSockets : handleSockets
};
