import { existsSync, mkdirSync } from 'fs';
import httpServer from 'http';
import { WebSocketServer } from 'ws';
import { setupOnSocketReady as login_setupOnSocketReady } from './handlers/login.js';
import { setupOnSocketReady as shout_setupOnSocketReady } from './handlers/shout.js';
import { SoundVitrineDatabaseFolderPath, ListeningPort } from './_const.js';
import ON_DEATH from 'death';

//
async function main () {
  //
  // Front Web Server setup
  //

  // on debug build, wait a bit for attached debugger to catch up. At least 2 seconds
  if (process.env.NODE_ENV != 'production') { 
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  //
  if (!existsSync(SoundVitrineDatabaseFolderPath)) {
    console.log("Could not find data folder [", SoundVitrineDatabaseFolderPath, "], creating it.")
    mkdirSync(SoundVitrineDatabaseFolderPath, { recursive: true });
  }

  // using HTTP server by default; any HTTPS should be handled by proxy, 
  // because certbot cert are access-restricted to root users, and we need this instance
  // to have rights to update files accordingly as classic FTP user
  const webServ = httpServer.createServer();

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
    let req_url = request.url;
    if (req_url == null) {
      socket.destroy();
      return;
    }

    if (req_url.startsWith('/sentry')) {
      req_url = req_url.replace('/sentry', '');
    }

    const [username, verb] = req_url.split('/').filter(Boolean);
    
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
      ws.on('message', async function message(data) {
        //
        const payloadAsJson = JSON.parse(data);

        //
        for(const middleware of middlewares) {
          const handled = (await middleware)(payloadAsJson);
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

  let shutingDown = false;

  //
  const shutdownGracefully = () => {
    //
    if (shutingDown) return;

    //
    shutingDown = true;

    //

    //
    console.log('[SoundSentry] Should shutdown now...');

    //
    webServ.on("close", () => {
      console.log('[SoundSentry] Web server gracefully out. Bye-bye !')
    });

    //
    webServ.close();
  }

  // if death-like signal intercepted at least once, try to close gracefully
  ON_DEATH(shutdownGracefully)

  //
  webServ.listen(ListeningPort, '0.0.0.0');
  console.log("Sucessfully ran on port", ListeningPort  ,", awaiting connections...");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })