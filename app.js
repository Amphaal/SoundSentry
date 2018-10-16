var server = require('http').createServer();  
var io = require('socket.io')(server);
var fs = require('fs');

var fileWatchers = {};
var socketsByFW = {};

//on user connection
io.on('connection', function(socket) {

    //get user to watch
    const userToWatch = socket.handshake.query.userToWatch;
    if (userToWatch) {

        process.stdout.write("new connection for user's shouts \"" + userToWatch + "\"!");

        //create
        let pathToWatch = './users_data/' + userToWatch + "/shout.json";

        //if no watcher registered
        if (!fileWatchers[userToWatch]) {
            
            //watcher
            let watch = fs.watch(pathToWatch, { encoding: 'buffer' }, (eventType, filename) => {
                fs.readFile(pathToWatch, 'utf8', function (err, contents) {
                    io.of(socket.nsp.name).emit('newShout', contents);
                }); 
            });

            //register...
            process.stdout.write("registering \"" + userToWatch + "\" shouts watcher !");
            fileWatchers[userToWatch] = watch;
            if(socketsByFW[userToWatch] == undefined) socketsByFW[userToWatch] = 0;
        }

        //initial shout fetch
        fs.readFile(pathToWatch, 'utf8', function (err, contents) {
            socket.emit('newShout', contents);
        }); 
        socketsByFW[userToWatch] = socketsByFW[userToWatch] + 1;

        process.stdout.write("Succesful registering for user's shouts \"" + userToWatch + "\". Total number of connections for this user : " + socketsByFW[userToWatch]);
    }

    //on user disconnect
    socket.on('disconnect', function () {

        socketsByFW[userToWatch] = socketsByFW[userToWatch] - 1;
        process.stdout.write("disconnect from user's shouts \"" + userToWatch + "\". Remaining connections for this user : " + socketsByFW[userToWatch]);

        //close watcher
        if(socketsByFW[userToWatch] <= 0) {
            process.stdout.write("Closing \"" + userToWatch + "\" file watcher...");
            fileWatchers[userToWatch].close(); 
        }
    });
});

server.listen(3000);