import { existsSync, mkdirSync, readFileSync } from 'fs';
import httpsServer from 'https';
import httpServer from 'http';
import { WebSocketServer } from 'ws';
import { setupOnSocketReady as login_setupOnSocketReady } from './handlers/login.js';
import { setupOnSocketReady as shout_setupOnSocketReady } from './handlers/shout.js';
import { SoundVitrineDatabaseFolderPath, ListeningPort } from './_const.js';

//
// Front Web Server setup
//

//
if (!existsSync(SoundVitrineDatabaseFolderPath)) {
  mkdirSync(SoundVitrineDatabaseFolderPath, { recursive: true });
}

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

//
// link WSS with HTTP / HTTPS server
//

const wss = new WebSocketServer({ noServer: true });

//
function onSocketError() {
  console.warn("Something wrong happened with WebSockets service");
}

//
webServ.on('upgrade', function upgrade(request, socket, head) {
  //
  socket.on('error', onSocketError);

  // url must be provided
  if (request.url == null) {
    socket.destroy();
    return;
  }

  const [username, verb] = request.url.split('/').filter(Boolean);
  
  //get user to watch
  if (username == null || verb == null) {
    socket.destroy();
    return;
  }

  //
  wss.handleUpgrade(request, socket, head, function done(ws) {
    //
    socket.removeListener('error', onSocketError);

    // says it connected anyway...
    wss.emit('connection', ws, request);
    
    //
    let middlewares = [];
    switch (verb) {
      case "shout": {
        middlewares.push(shout_setupOnSocketReady(ws, wss.clients, username));
      }

      case "login": {
        middlewares.push(login_setupOnSocketReady(ws, wss.clients, username));
      }
    }

    //
    ws.on('message', function message(data) {
      //
      const payloadAsJson = JSON.parse(data);

      //
      for(const middleware of middlewares) {
        const handled = middleware(payloadAsJson);
        if (handled) return;
      }

      //
      console.warn('Client trying to use unconfigured command, with payload: ', payloadAsJson);
    });
  });
});

//
// Igniting
//

webServ.listen(ListeningPort, '0.0.0.0');

console.log("Sucessfully ran on port " + ListeningPort + ". Awaiting connections...");