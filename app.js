var server = require('http').createServer();  
var fs = require('fs');
var io = require('socket.io')(server);

var fileWatchers = {};
var socketsByFW = {};

//on user connection
io.on('connection', function(socket) {
    
    //get user to watch
    const pathName = socket.nsp.name;
    console.log(pathName);
    const userToWatch = null;
    

    //if no watcher registered
    if (userToWatch && !fileWatchers[userToWatch]) {

        //create
        let pathToWatch = './users_data/' + userToWatch + "/shout.json";
        let watch = fs.watch(pathToWatch, { encoding: 'buffer' }, (eventType, filename) => {
            var contents = fs.readFileSync('DATA', 'utf8');
            socket.emit('newShout', contents);
        });

        //register...
        fileWatchers[userToWatch] = watch;
        if(socketsByFW[userToWatch] == undefined) socketsByFW[userToWatch] = 0;
        socketsByFW[userToWatch] = socketsByFW[userToWatch] + 1;
    }

    //on user disconnect
    socket.on('disconnect', function () {
        //close watcher
        socketsByFW[userToWatch] = socketsByFW[userToWatch] - 1;
        if(socketsByFW[userToWatch] <= 0) fileWatchers[userToWatch].close();
    });
});

server.listen(3000);