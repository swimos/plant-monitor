const express = require('express');
const app = require('express')();
const http = require('http').Server(express);
const https = require('https');
const path = require('path');
const fs = require('fs');
// const expressHandlebars = require('express-handlebars');
// const swim = require('@swim/client');
// const swim = new client.Client({sendBufferSize: 1024*1024});

class HttpServer {
    constructor(port = 9001, isSecure = false, showDebug = false) {
        this.showDebug = showDebug;
        this.port = port;
        this.isSecure = isSecure;

	    console.info(`create ${(this.isSecure) ? 'https' : 'http'} server @ port ${this.port}`);
    }
    /**
     * start up http server and setup express
     */
    setUpEngine() {

        // initialized ExpressJS
        this.webApp = express();
        // this.webApp.use('/js', express.static(path.join(__dirname + '/views/js')));
        // this.webApp.use('/css', express.static(path.join(__dirname + '/views/css')));
        // this.webApp.use('/assets', express.static(path.join(__dirname + '/views/assets')));

        // define our webserver
        this.server = require((this.isSecure) ? 'https' : 'http').Server(this.webApp);


    }


    /**
     * server error handler
     * @param  {[Object]} err [message object]
     */
    onServerStarted(err) {
        if (err) {
            console.error('[httpServer] startup error', err);
        }
        if (this.showDebug) {
            console.info(`[httpServer] express server listening on ${this.port}`);
        }

    }

    /**
     * utility method which creates all the page routes to be used by ExpressJS
     */
    createPageRoutes() {
        this.webApp.use('/', express.static(path.join(__dirname, '../ui')))


    }

    /**
     * startup http server
     */
    startServer() {
        this.setUpEngine();
		this.createPageRoutes();

        if(this.isSecure) {
            https.createServer({
                key: fs.readFileSync('../../key.pem'),
                cert: fs.readFileSync('../../cert.pem'),
                passphrase: 'localhost'
            }, this.webApp)            
            .listen(this.port, this.onServerStarted.bind(this));
        } else {
            this.server.listen(this.port, this.onServerStarted.bind(this));
        }
        

    }


}

// module.exports = HttpServer;
const showDebug = true;
const httpServer = new HttpServer(9001, false, showDebug);
httpServer.startServer();

const httpsServer = new HttpServer(443, true, showDebug);
httpsServer.startServer();