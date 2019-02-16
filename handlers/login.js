var fs = require('fs');
var nsfw = require('nsfw');

var dbFileToWatch = "/srv/data/users/users.json";
var dbFileWatcher = null;
var db = null;
var loginNsp = null;

function checkIfLoginIsOk(username, password, callback) {
    
    //macro function for quickly outputing result
    function updateResultsThenCb(error) {
        let results = {
            "isLoginOk" : false,
            "error" : null
        };
        if(error != null) {
           results["error"] = error;
        } else {
            results["isLoginOk"] = true;
        }
        callback(results);
    };

    //check if credentials are here
    if(username == null || password == null) updateResultsThenCb("Credential data missing");
    if(db == null) updateResultsThenCb("Empty users database");
    if(db[username] == null) updateResultsThenCb("Username not found in database");
    if(db[username]["password"] == null) updateResultsThenCb("Password for the user not found in database");
    if(db[username]["password"] != password) updateResultsThenCb("Password missmatch");
    
    //OK, callback
    updateResultsThenCb();
}

function updateDb(cb) {
    //replace internal users db
    fs.readFile(dbFileToWatch, 'utf8', function (err, contents) {
        try {
            db = JSON.parse(contents);
            cb(null);
        } catch(e) {
            cb(e);
        }
    });
}

function handleSockets(socket, nsp) {

    //bind namespace for local usage
    if (!loginNsp) loginNsp = nsp;

    //create if not exist
    if(!fs.existsSync(dbFileToWatch)) {
        fs.writeFileSync(dbFileToWatch, "[]");
        fs.chownSync(dbFileToWatch, 1000, 1000); //permit the php server to override it
    }

    //define behavior on credentials check request
    socket.on("checkCredentials", function(username, password) {
        checkIfLoginIsOk(username, password, function(results) {
            socket.send("credentialsChecked", results);
        })
    });

    //if no watcher registered
    if (dbFileWatcher == null) {
        nsfw(dbFileToWatch, function(events) {
            //update local database copy
            updateDb(function(error) {
                //tell the client that he could reask for credentials validation
                if(!error) nsp.emit("databaseUpdated");
            });
        }).then(function(watcher) {
            dbFileWatcher = watcher;
            return watcher.start();
        });
    }

}

module.exports = {
    handleSockets : handleSockets
};
