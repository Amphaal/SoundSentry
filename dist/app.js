import { existsSync, mkdirSync, readFileSync } from 'fs';
import httpsServer from 'https';
import httpServer from 'http';
import { WebSocketServer } from 'ws';
import { setupOnSocketReady as login_setupOnSocketReady } from './handlers/login.js';
import { setupOnSocketReady as shout_setupOnSocketReady } from './handlers/shout.js';
import { SSLCertFolderPath, SoundVitrineDatabaseFolderPath, ListeningPort } from './_const.js';
import ON_DEATH from 'death';

//
function setupServer () {
  //
  const env = process.env.NODE_ENV;

  if (env == 'production') {
    //
    const httpsDomainName = process.env.DOMAIN_NAME;

    //
    if (httpsDomainName != null) {
        console.log("==> Production setup, trying to run HTTPS server on [", httpsDomainName, "] ... <==");
        return httpsServer.createServer({
          key: readFileSync(SSLCertFolderPath + '/' + process.env.DOMAIN_NAME + '/privkey.pem'),
          cert: readFileSync(SSLCertFolderPath + '/' + process.env.DOMAIN_NAME + '/fullchain.pem')
        });
    } else {
      console.error("==> [DOMAIN_NAME] env variable must be defined. It is used to determine certificate names from linked certbot SSL installation. Enforcing HTTP server. <==");
    }
  } else {
    console.log("==> Non-production setup (NODE_ENV=", env, "), enforcing HTTP server <==");
  }

  //
  console.log("==> CAREFUL, running non-secure HTTP server <==");
  return httpServer.createServer();
}


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

  const webServ = setupServer();

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