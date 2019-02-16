var shout = require('./shout');
//var login = require('./login');

var server = require('https').createServer({
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
  });  
var io = require('socket.io')(server);

///
/// APP
///

//on user connection
io.on('connect', function(socket) {
    shout.handleSockets(socket);
    //login.handleSockets(socket);
});

server.listen(3000);