
// include library for talking to ardunio
const ArduinoBoard = require('./modules/ArduinoBoard');

// include SWIM client
const swimClient = require('@swim/client');

const https = require('https')

// grab command line argumenets
const commandLineArgs = process.argv

class Main {

    constructor() {
        this.args = {};
        this.processCommandLineArgs();
        this.loadConfig(this.args.config || 'localhost');

        this.swimPort = this.config.swimPort;
        this.swimAddress = this.config.swimAddress;
        this.swimUrl = 'ws://' + this.swimAddress + ':' + this.swimPort;

        this.showDebug = this.config.showDebug;
        this.authtoken = this.config.authToken;
        this.apiUrl = this.config.apiUrl;
        this.deviceId = this.config.deviceId;

        this.plantInfo = this.config.plantInfo;

        this.asyncIds = [];

        this.sensorData = {};
        this.loopInterval = this.config.mainLoopInterval;
        this.loopTimeout = null;
        this.dataChanged = false;

        this.endPointUriLookup = {};
    }


    start() {

        // reigster new plant with Swim Server
        swimClient.command(this.swimUrl, `/plant/${this.plantInfo.id}`, 'createPlant', this.plantInfo);

        
        // this.deleteActiveSubscriptions(this.deviceId);

        // console.info(this.config.endpoints)

        for(const index in this.config.endpoints) {
            const endpoint = this.config.endpoints[index]
            // console.info(endpoint);
            if(endpoint.enabled) {
                this.endPointUriLookup[endpoint.subscription.uri] = endpoint;
                this.subscribeToEndpoint(this.deviceId, endpoint.subscription);
                const msg = {
                    plantId: this.plantInfo.id,
                    sensorName: endpoint.name,
                    sensorId: endpoint.lane
                }
                swimClient.command(this.swimUrl, `/sensor/${this.plantInfo.id}/${endpoint.lane}`, 'setName', msg);            
    
            }
        }

        this.mainLoop();
    }

    mainLoop() {
        if (this.showDebug) {
            // console.info('[main] mainLoop', this.sensorData);
        }

        if (this.loopTimeout !== null) {
            clearTimeout(this.loopTimeout);
        }

        this.pullNotifications();

        if(this.sensorData !== null && this.dataChanged) {
            swimClient.command(this.swimUrl, `/plant/${this.plantInfo.id}`, 'setSensorData', this.sensorData);
            for (let sensorKey in this.sensorData) {
                // console.info(this.swimUrl, `/sensor/${this.plantInfo.id}/${sensorKey}`, 'setLatest', this.sensorData[sensorKey]);
                const msg = {
                    plantId: this.plantInfo.id,
                    sensorId: sensorKey,
                    sensorData: this.sensorData[sensorKey]
                }
                // console.info(this.swimUrl, `/sensor/${this.plantInfo.id}/${sensorKey}`, 'setLatest', msg);
                swimClient.command(this.swimUrl, `/sensor/${this.plantInfo.id}/${sensorKey}`, 'setLatest', msg);
            }
            
            this.dataChanged = false;
        } 

        this.loopTimeout = setTimeout(this.mainLoop.bind(this), this.loopInterval);
    }

    deleteActiveSubscriptions(endpointName) {
        console.info('[main] deleteActiveSubscriptions', endpointName);
        this.httpRequest(`/v2/subscriptions/${endpointName}`, '', 'DELETE', (result) => {
            console.info('subs', result);
        });
    }    

    subscribeToEndpoint(endpointName, endpoint) {
        console.info('[main] subscribeToEndpoint', endpointName, endpoint);
        this.httpRequest(`/v2/subscriptions/${endpointName}${endpoint.uri}`, '', 'PUT', (result) => {
            if(result !== "NOT_CONNECTED" && result !== "QUEUE_IS_FULL" && result !== "LIMITS_EXCEEDED") {
                const resultData = JSON.parse(result);
                const newId = resultData['async-response-id'];
                this.asyncIds[newId] = {
                    asyncId: newId,
                    deviceId: endpointName,
                    uri: endpoint.uri
                }

                this.getResourceValue(endpointName, newId, endpoint.uri);
                
            } else {
                console.info(`Device ${endpointName} not connected or connection error`);
                console.info(result);
            }


        });

    }    

    getResourceValue(endpointName, asyncId, uri) {
        const msg = `{"method": "GET", "uri": "${uri}"}`;
        this.httpRequest(`/v2/device-requests/${endpointName}?async-id=${asyncId}`, msg, 'POST', (result) => {
            console.info(result);
        });
    }    

    pullNotifications() {
        this.httpRequest(`/v2/notification/pull`, null, 'GET', (result) => {
            if(result !== "CONCURRENT_PULL_REQUEST_RECEIVED") {
                try {
                    const resultData = JSON.parse(result);
                    // console.info(resultData);
                    if(resultData.notifications) {
                        this.parseNotifications(resultData.notifications);
                      
                    } else {
                        const asyncNotifs = resultData[Object.keys(resultData)[0]];
                        // console.info(asyncNotifs);
                        for(let i=0; i<asyncNotifs.length; i++) {
                            const currNotif = asyncNotifs[i];
                            const receiver = (this.asyncIds[currNotif.id]);
                            if(receiver && currNotif.payload) {
                                const data = Buffer.from(currNotif.payload, 'base64').toString('utf-8');
                                console.info(receiver.uri, data);
                                const currEndpoint = this.endPointUriLookup[receiver.uri];
                                this.sensorData[currEndpoint.lane] = data;
                                this.dataChanged = true;

                            }
                        }
                    }                     
                } catch (ex) {
                    console.info('notification parse error')
                    console.info(ex);
                }
                
              
            } else {
                // console.info(result)
            }
        });
    }

    parseNotifications(notifications) {
        for(let msg of notifications) {
            if(msg.path) {
                const data = Buffer.from(msg.payload, 'base64').toString('utf-8');
                const currEndpoint = this.endPointUriLookup[msg.path];
                this.sensorData[currEndpoint.lane] = data;
                this.dataChanged = true;
            } else {
                console.info('no receiver', msg);

            }
        }        
    }


    httpRequest(path, data, type, onComplete, onError) {

        const options = {
            hostname: this.apiUrl,
            path: path,
            method: type,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.authtoken
            }
        }

        const req = https.request(options, res => {
            // console.info(res.statusCode);
            this.httpRes = res;
            res.on('data', d => {
                // console.info(d);
                onComplete(d.toString())
            })
        })

        req.on('error', error => {
            console.error(error)
            if (onError) {
                onError(error);
            }

        })

        if (data) {
            req.write(data);
        }
        req.end()

    }    

    /**
     * utility method to handle processing arguments from the command line
     * arguments will be stored in this.args
     */
    processCommandLineArgs() {
        commandLineArgs.forEach((val, index, arr) => {
            if (val.indexOf('=') > 0) {
                const rowValue = val.split('=');
                this.args[rowValue[0]] = rowValue[1];
            }
        })
    }

    /**
     * Load up configuration values from config file
     * @param {*} configName 
     */
    loadConfig(configName) {
        if (this.showDebug) {
            console.info('[main] load config');
        }
        // load config
        this.config = require('../config/' + configName + '.json');

        if (this.showDebug) {
            console.info('[main] config loaded');
        }
    }     
}

// create Main and kick everything off by calling start()
const main = new Main();
main.start();
