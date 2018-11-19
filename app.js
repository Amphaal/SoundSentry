var server = require('https').createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
  });  
var io = require('socket.io')(server);
var fs = require('fs');
var nsfw = require('nsfw');

var fileWatchers = {};
var socketsByFW = {};
var newShoutVerb = 'newShout';

///
/// APP
///


//on user connection
io.on('connect', function(socket) {

    //get user to watch
    const userToWatch = socket.handshake.query.userToWatch;
    function logForUser(log) {
        console.log("\"" + userToWatch + "\" : " + log);
    }

    if (userToWatch) {

        logForUser("new connection for user's shouts");
        let pathToWatch = '/srv/users_data/' + userToWatch + "/shout.json";
        
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
            if(socketsByFW[userToWatch] == undefined) socketsByFW[userToWatch] = 0;
        }

        //initial shout fetch
        fs.readFile(pathToWatch, 'utf8', function (err, contents) {
            if (contents) socket.emit(newShoutVerb, contents);
        }); 
        socketsByFW[userToWatch] = socketsByFW[userToWatch] + 1;
        socket.join(userToWatch);

        logForUser("Succesful registering. Total number of connections for this user : " + socketsByFW[userToWatch]);
    }

    //on user disconnect
    socket.on('disconnect', function () {

        socketsByFW[userToWatch] = socketsByFW[userToWatch] - 1;
        logForUser("disconnect. Remaining connections for this user : " + socketsByFW[userToWatch]);

        //close watcher
        // if(socketsByFW[userToWatch] <= 0) {
        //     console.log("Closing \"" + userToWatch + "\" file watcher...");
        //     fileWatchers[userToWatch].close(); 
        //     fileWatchers[userToWatch] == null;
        // }
    });
});

server.listen(3000);