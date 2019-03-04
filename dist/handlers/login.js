var fs = require('fs');
var nsfw = require('nsfw');

var dbFileToWatch = "/srv/data/users.json";
var dbFileWatcher = null;
var db = null;

function checkIfLoginIsOk(username, password, callback) {

    //macro function for quickly outputing result
    function updateResultsThenCb(accomp, noError) {
        let results = {
            "isLoginOk" : false,
            "accomp" : accomp
        };
        
        if(noError) {
            results["isLoginOk"] = true;
        } 

        callback(results);
    };

    //check if credentials are here
    if(username == null || password == null) return updateResultsThenCb("cdm");
    if(db == null) return updateResultsThenCb("eud");
    
    username = String(username).toLowerCase();
    
    if(db[username] == null) return updateResultsThenCb("unfid");
    if(db[username]["password"] == null) return updateResultsThenCb("nopass");
    if(db[username]["password"] != password) return updateResultsThenCb("pmiss");
    
    //OK, callback
    return updateResultsThenCb(username, true);
}

//replace internal users db
function updateDbCache() {
    return new Promise(function(resolve, reject) {
        fs.readFile(dbFileToWatch, 'utf8', function (err, contents) {
            if (err) return reject(err);
            try {
                db = JSON.parse(contents);
                return resolve();
            } catch(e) {
                return reject(e);
            }
        });
    });
}

//
function bindAndStartWatcher(watcher) {
    dbFileWatcher = watcher;
    return watcher.start();
}

//tell the client that he could reask for credentials validation
function shoutToClientsDatabaseUpdate(nsp) {
    return function() {
        nsp.emit("databaseUpdated"); 
    }
}

function handleSockets(socket, nsp) {

    //create if not exist
    if(!fs.existsSync(dbFileToWatch)) {
        fs.writeFileSync(dbFileToWatch, "[]");
        fs.chownSync(dbFileToWatch, 1000, 1000); //permit the php server to override it
    }

    //define behavior on credentials check request
    socket.on("checkCredentials", function(username, password) {
        checkIfLoginIsOk(username, password, function(results) {
            socket.emit("credentialsChecked", results);
        })
    });

    //if no watcher registered
    if (dbFileWatcher == null) {

        //update cache
        updateDbCache().then(function() {
            
            //on succeed, start listener
            nsfw(dbFileToWatch, function(events) {
                
                //update cache then shout
                updateDbCache().then(shoutToClientsDatabaseUpdate(nsp));

            }).then(bindAndStartWatcher);

        })
    }

}

module.exports = {
    handleSockets : handleSockets
};
