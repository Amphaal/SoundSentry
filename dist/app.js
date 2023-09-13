import { readFileSync } from 'fs';
import httpsServer from 'https';
import httpServer from 'http';
import { WebSocketServer } from 'ws';
import { setupOnSocketReady as login_setupOnSocketReady } from './handlers/login.js';
import { setupOnSocketReady as shout_setupOnSocketReady } from './handlers/shout.js';
import { SoundVitrineDatabaseFolderPath, ListeningPort } from './_const.js';

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

const wss = new WebSocketServer({ noServer: true });

//
function onSocketError() {
  console.warn("Something wrong happened with WebSockets service");
}

// link WSS with HTTP / HTTPS server
webServ.on('upgrade', function upgrade(request, socket, head) {
  //
  socket.on('error', onSocketError);

  wss.handleUpgrade(request, socket, head, function done(ws) {
    socket.removeListener('error', onSocketError);

    // says it connected anyway...
    wss.emit('connection', ws, request);
    
    const login_middleware = login_setupOnSocketReady(ws, wss.clients);
    const shout_middleware = shout_setupOnSocketReady(ws, wss.clients);

    ws.on('message', function message(data) {
      const payloadAsJson = JSON.parse(data);

      const middlewares = [
        login_middleware,
        shout_middleware
      ];

      for(const middleware of middlewares) {
        const handled = middleware(payloadAsJson);
        if (handled) break;
      }

      console.warn('Client trying to use unconfigured command');
    });
  });
});

///
/// APP
///

/*
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
*/

webServ.listen(ListeningPort, '0.0.0.0');

console.log("Sucessfully ran on port " + ListeningPort + ". Awaiting connections...");