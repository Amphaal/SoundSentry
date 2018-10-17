var server = require('http').createServer();  
var io = require('socket.io')(server);
var fs = require('fs');

var fileWatchers = {};
var socketsByFW = {};
var newShoutVerb = 'newShout';

//on user connection
io.on('connect', function(socket) {

    //get user to watch
    const userToWatch = socket.handshake.query.userToWatch;
    if (userToWatch) {

        console.log("new connection for user's shouts \"" + userToWatch + "\"!");

        //create
        let pathToWatch = './users_data/' + userToWatch + "/shout.json";

        //if no watcher registered
        if (!fileWatchers[userToWatch]) {
            
            //watcher
            let watch = fs.watch(pathToWatch, { encoding: 'buffer' }, (eventType, filename) => {
                fs.readFile(pathToWatch, 'utf8', function (err, contents) {
                    io.to(userToWatch).emit(newShoutVerb, contents);
                }); 
            });

            //register...
            console.log("registering \"" + userToWatch + "\" shouts watcher !");
            fileWatchers[userToWatch] = watch;
            if(socketsByFW[userToWatch] == undefined) socketsByFW[userToWatch] = 0;
        }

        //initial shout fetch
        fs.readFile(pathToWatch, 'utf8', function (err, contents) {
            if (contents) socket.emit(newShoutVerb, contents);
        }); 
        socketsByFW[userToWatch] = socketsByFW[userToWatch] + 1;
        socket.join(userToWatch);

        console.log("Succesful registering for user's shouts \"" + userToWatch + "\". Total number of connections for this user : " + socketsByFW[userToWatch]);
    }

    //on user disconnect
    socket.on('disconnect', function () {

        socketsByFW[userToWatch] = socketsByFW[userToWatch] - 1;
        console.log("disconnect from user's shouts \"" + userToWatch + "\". Remaining connections for this user : " + socketsByFW[userToWatch]);

        //close watcher
        // if(socketsByFW[userToWatch] <= 0) {
        //     console.log("Closing \"" + userToWatch + "\" file watcher...");
        //     fileWatchers[userToWatch].close(); 
        //     fileWatchers[userToWatch] == null;
        // }
    });
});

server.listen(3000);