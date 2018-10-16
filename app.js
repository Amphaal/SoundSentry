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

        //create
        let pathToWatch = './users_data/' + userToWatch + "/shout.json";

        //declare macro function for emit
        let rfFunc = function () {
            fs.readFile(pathToWatch, 'utf8', function (err, contents) {
                socket.emit('newShout', contents);
            }); 
        };
        rfFunc();

        //if no watcher registered
        if (!fileWatchers[userToWatch]) {
            //watcher
            let watch = fs.watch(pathToWatch, { encoding: 'buffer' }, () => {
                rfFunc();
            });

            //register...
            fileWatchers[userToWatch] = watch;
            if(socketsByFW[userToWatch] == undefined) socketsByFW[userToWatch] = 0;
            socketsByFW[userToWatch] = socketsByFW[userToWatch] + 1;
        }
    }

    //on user disconnect
    socket.on('disconnect', function () {
        //close watcher
        socketsByFW[userToWatch] = socketsByFW[userToWatch] - 1;
        if(socketsByFW[userToWatch] <= 0) fileWatchers[userToWatch].close();
    });
});

server.listen(3000);