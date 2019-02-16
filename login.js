var fs = require('fs');
var nsfw = require('nsfw');

var dbFileToWatch = "/srv/data/users/users.json";
var dbFileWatcher = null;
var db = null;
var verb = "isLoggedIn";

function checkIfLoginIsOk(username, password, callback) {
    let results = {
        "isLoginOk" : false,
        "error" : null
    };

    //macro func
    function updateResultsThenCb(error) {
        results["error"] = error;
        callback(results);
    }

    fs.readFile(dbFileToWatch, 'utf8', function (err, contents) {
        if(err) return updateResultsThenCb(err);
        try {
            let users = JSON.parse(contents);
        }
    }); 
}

function updateDb() {
    //replace internal users db
    fs.readFile(dbFileToWatch, 'utf8', function (err, contents) {
        try {
            db = JSON.parse(contents);
        } catch(e) {

        }
    });
}

function handleSockets(socket) {
    let username = socket.handshake.query.username;
    let password = socket.handshake.query.password;

    if(username && password) {

        //create if not exist
        if(!fs.existsSync(dbFileToWatch)) {
            fs.writeFileSync(dbFileToWatch, "[]");
            fs.chownSync(dbFileToWatch, 1000, 1000); //permit the php server to override it
        }

        socket.join(verb);

        //if no watcher registered
        if (dbFileWatcher == null) {
            nsfw(dbFileToWatch, updateDb).then(
            function(watcher) {
                dbFileWatcher = watcher;
                return watcher.start();
            });
        }

    }
}

module.exports = {
    handleSockets : handleSockets
};
