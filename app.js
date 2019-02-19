var fs = require('fs');

var shout = require('./handlers/shout');
var login = require('./handlers/login');

var server = require('https').createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
  });  
var io = require('socket.io')(server);

///
/// APP
///

//on user connections for shouts updates
var shoutNsp = io.of('/shout');
shoutNsp.on('connection', function(socket) {
  shout.handleSockets(socket, shoutNsp);
});

//on user connections for login checks
var loginNsp = io.of('/login');
loginNsp.on('connection', function(socket) {
  login.handleSockets(socket, loginNsp);
});

server.listen(3000);