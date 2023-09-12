import { readFileSync } from 'fs';
import httpsServer from 'https';
import httpServer from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { handleSockets as handleShoutSockets } from './handlers/shout.js';
import { handleSockets as handleLoginSockets } from './handlers/login.js';
import { SoundVitrineDatabaseFolderPath, ListeningPort } from '../_const.js';

var env = process.env.NODE_ENV || 'development';



if (env != 'production') {
  //
  console.log("==> NON-PRODUCTION ENV, running non-secure HTTP server <==");

  //
  var webServ = httpServer.createServer();
} else {
  //
  console.log("==> PRODUCTION ENV, trying to run HTTPS server ... <==");

  //
  if (process.env.DOMAIN_NAME) {
    console.error("[DOMAIN_NAME] env variable must be defined. It is used to determine certificate names from linked certbot SSL installation.");
  }

  //
  var webServ = httpsServer.createServer({
    key: readFileSync(SoundVitrineDatabaseFolderPath + '/' + process.env.DOMAIN_NAME + '.key'),
    cert: readFileSync(SoundVitrineDatabaseFolderPath + '/' + process.env.DOMAIN_NAME + '.crt')
  });
}

var io = new SocketIOServer(webServ);

///
/// APP
///

//on user connections for shouts updates
var shoutNsp = io.of('/shout');
shoutNsp.on('connection', function(socket) {
  handleShoutSockets(socket, shoutNsp);
});

//on user connections for login checks
var loginNsp = io.of('/login');
loginNsp.on('connection', function(socket) {
  handleLoginSockets(socket, loginNsp);
});

webServ.listen(ListeningPort);

console.log("Sucessfully ran on port " + ListeningPort + ". Awaiting connections...");