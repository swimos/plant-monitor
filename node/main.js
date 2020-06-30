
// include library for talking to ardunio
const ArduinoBoard = require('./modules/ArduinoBoard');

// include SWIM client
const swimClient = require('@swim/client');

const WebSocketClient = require('websocket').client;

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
        this.deviceLookup = [];

        this.plantInfo = this.config.plantInfo;

        this.asyncIds = [];

        this.sensorData = {};
        this.loopInterval = this.config.mainLoopInterval;
        this.loopTimeout = null;
        this.dataChanged = false;

        this.endPointUriLookup = {};

        this.msgBuffer = '';
        this.msgFirstChar = null;
    }


    /**
     * main startup. Delete any active subs and start a new session
     */
    start() {

        // delete any existing callbacks 
        this.httpRequest('/v2/notification/callback', '', 'DELETE', (result) => {
            console.info("delete /v2/notification/callback result:", result);
        });
        this.httpRequest('/v2/notification/pull', '', 'DELETE', (result) => {
            console.info("delete /v2/notification/pull result:", result);
        });
        this.httpRequest('/v2/notification/websocket', '', 'DELETE', (result) => {
            console.info("delete /v2/notification/websocket result:", result);
        });

        // create a subscription to get notifications over sockets
        this.httpRequest('/v2/notification/websocket', '', 'PUT', (result) => {
            console.info("create socket request result:", result);
            // open websocket to get notifitcations
            this.openSocket();
        });

    }

    /**
     * Open websocket to api server
     */
    openSocket() {
        if (this.websocket !== null) {
            this.websocket = null;
        }
        this.websocket = new WebSocketClient();

        this.websocket.on('connectFailed', (error) => {
            console.log('Connect Error: ' + error.toString());
            console.info(`api url ${this.apiUrl}`);
        });

        // create onConnect handler
        this.websocket.on('connect', (connection) => {
            console.log('WebSocket Client Connected');
            
            // start loading devices now that we have a socket connection
            this.getDeviceList();

            connection.on('error', (error) => {
                console.log("Connection Error: " + error.toString());
            });
            connection.on('close', (msg) => {
                console.log('WebSocket Connection Closed', msg);
                // wait 30 seconds and reconnect
                setTimeout(() => {
                    this.start();
                }, 30000);
            });
            connection.on('message', (message) => {
                if (message.type === 'utf8') {
                    // console.log("Received: '" + message.utf8Data + "'");
                    this.handleSocketMessage(message.utf8Data);
                }
            });

        });

        // define header for auth
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authtoken}`
        }

        // open socket
        this.websocket.connect(`wss://${this.apiUrl}/v2/notification/websocket-connect`, null, null, headers);

    }

    /**
     * Get list of Devices from Connect API
     */
    getDeviceList() {
        console.info('[main] getDeviceList');
        this.httpRequest('/v3/devices', '', 'GET', (result) => {

            // covert result into json
            let firstChar = result.charAt(0);
            let lastChar = result.charAt(result.length - 1);
            let resultData = null

            // if first and last charts are brackets, parse as json 
            // otherwise buffer message until first/last brackets are found
            if (firstChar === '{' && lastChar === '}') {
                console.info("Device list loaded without buffering");
                resultData = JSON.parse(result); // parse message                
                this.deviceList = resultData.data; // store parsed list as this.deviceList
                this.loadDevices(); // load devices from api
            } else {
                this.msgBuffer += result;
                let firstChar = this.msgBuffer.charAt(0);
                let lastChar = this.msgBuffer.charAt(this.msgBuffer.length - 1);

                // first last brackets found in buffer so convert to json
                if (firstChar === '{' && lastChar === '}') {
                    console.info("Device list loaded by buffering messages");
                    resultData = JSON.parse(this.msgBuffer); // parse buffer                    
                    this.deviceList = resultData.data; // store parsed list as this.deviceList
                    this.msgBuffer = ''; // reset string buffer
                    this.loadDevices(); // load devices from API
                }

            }

        });

    }

    /**
     * Load devices will get called on startup and anytime a device status changes on connect api (like deregistation)
     * for each device in device list that is registered:
     * 1. notify swim of device (plant)
     * 2. remove any active subscritions for device from api
     * 3. create new subscriptions for device
     * 4. update our device lookup with id so we know we have created subs
     */
    loadDevices() {
        // console.info(this.deviceList);
        for (let device of this.deviceList) {

            // if (this.deviceLookup.indexOf(device.id) === -1) {

                // console.info(this.swimUrl, `/plant/${device.endpoint_name}`, 'createPlant', device);
                if (device.state === "registered") {
                    // notify swim of new plant
                    swimClient.command(this.swimUrl, `/plant/${device.endpoint_name}`, 'createPlant', device);
                    // delete existing subs
                    this.deleteActiveSubscriptions(device.endpoint_name);
                    // create new subs
                    this.subscribeToDeviceEndpoints(device.endpoint_name);
                    // add device in lookup so we know its been created.
                    this.deviceLookup.push(device.id);
                } else {
                    // delete existing subs
                    this.deleteActiveSubscriptions(device.endpoint_name);
                    this.deviceLookup = this.deviceLookup.filter((value, index, arr) => { return value !== device.id});
                    console.info(`Device ${device.endpoint_name} not registered`);
                }
                
            // }
        }
    }

    /**
     * Create a new subscription to each resource endpoint
     * that is defined in our config file. 
     * This will both create a Connect API 
     * subscrition and create a Sensor WebAgent in Swim to 
     * which will recieve the resource data changes from these 
     * subscriptions.
     * @param {*} deviceId 
     */
    subscribeToDeviceEndpoints(deviceId) {
        // for each endpoint sub and add sensor
        for (const index in this.config.endpoints) {
            const endpoint = this.config.endpoints[index]; // current endpoint config data

            // if current endpoint is enabled
            if (endpoint.enabled) {
                // save current endpoint into lookup array
                this.endPointUriLookup[endpoint.subscription.uri] = endpoint;
                // call to make api subscrptions 
                this.subscribeToEndpoint(deviceId, endpoint.subscription);
                // define sensor info for current resource endpoint
                const msg = {
                    plantId: deviceId,
                    sensorName: endpoint.name,
                    sensorId: endpoint.lane,
                    resourcePath: endpoint.subscription.uri
                }

                // create new sensor webagent 
                swimClient.command(this.swimUrl, `/sensor/${deviceId}/${endpoint.lane}`, 'setInfo', msg);

            }
        }
    }

    /**
     * make http DELETE request to connect api to remove active subscritions for an endopint
     * @param {*} endpointName 
     */
    deleteActiveSubscriptions(endpointName) {
        console.info('[main] deleteActiveSubscriptions', endpointName);
        this.httpRequest(`/v2/subscriptions/${endpointName}`, '', 'DELETE', (result) => {
            console.info('deleteActiveSubscriptions', result);
        });
    }

    /**
     * Make http PUt request to subscrbe to changes to a given 
     * endpoint resource. Also parse the returned async response IDs
     * so we can make calls back to those resource endpoints later (ex: blink LED)
     * @param {*} endpointName 
     * @param {*} endpoint 
     */
    subscribeToEndpoint(endpointName, endpoint) {
        // console.info('[main] subscribeToEndpoint', endpointName, endpoint);
        this.httpRequest(`/v2/subscriptions/${endpointName}${endpoint.uri}`, '', 'PUT', (result) => {
            console.info('[main] subscribeToEndpoint', result);
            let firstChar = result.charAt(0);
            let lastChar = result.charAt(result.length - 1);

            if (firstChar === '{' && lastChar === '}') {
                const resultData = JSON.parse(result);
                const newId = resultData['async-response-id'];
                this.asyncIds[newId] = {
                    asyncId: newId,
                    deviceId: endpointName,
                    uri: endpoint.uri
                }

                this.getResourceValue(endpointName, newId, endpoint.uri);

                const currEndpoint = this.endPointUriLookup[endpoint.uri];
                swimClient.command(this.swimUrl, `/sensor/${endpointName}/${currEndpoint.lane}`, 'setAsyncId', newId);
                // console.info(this.swimUrl, `/sensor/${endpointName}/${currEndpoint.lane}`, 'setAsyncId', newId);
                // swimClient.command(this.swimUrl, `/sensor/${endpointName}/${currEndpoint.lane}`, 'setLatest', {sensorData: 0});

            } else {
                console.info(`Endpoint ${endpointName} for ${endpoint.uri} had a connection error`);
                console.info(result);
            }


        });

    }

    /**
     * Make http GET request to ask the Connect API 
     * to return the current value of a given resource endpoint.
     * Data will come back in notifcation websocket channel and will
     * be route to the correct sensor web agent there.
     * 
     * @param {*} endpointName 
     * @param {*} asyncId 
     * @param {*} uri 
     */
    getResourceValue(endpointName, asyncId, uri) {
        const msg = `{"method": "GET", "uri": "${uri}"}`;
        console.info("Get resource value", msg);
        this.httpRequest(`/v2/device-requests/${endpointName}?async-id=${asyncId}`, msg, 'POST', (result) => {
            console.info("getResourceValue", result);
        });
    }

    /**
     * handle all messages coming from the 
     * Connect API websocket connection
     * 
     * @param {*} result 
     */
    handleSocketMessage(result) {
        // console.info("socket message", result);
        if (result !== "CONCURRENT_PULL_REQUEST_RECEIVED" && result !== "URI_PATH_DOES_NOT_EXISTS") {
            try {
                //convert socker message (result) to JSON
                const resultData = JSON.parse(result);
                // console.info("SOCKET MESSAGE:", resultData);
                //decide how to deal with message based on messge content
                if (resultData.notifications) {
                    // message are from notification channel
                    this.parseNotifications(resultData.notifications);
                } else if (resultData.registrations || resultData["reg-updates"]) {
                    // message was a device registration change
                    console.info("new device(s) registered");
                    this.getDeviceList();

                } else {
                    // message was async notification and are handled
                    // differently from normal notifications because async-ids 
                    // are needs to maps back to the correct sensor web agent. 
                    // There can be multiple asinc ids in a message.
                    const asyncNotifs = resultData[Object.keys(resultData)[0]];

                    // for each asunc id notif
                    for (let i = 0; i < asyncNotifs.length; i++) {
                        const currNotif = asyncNotifs[i];

                        // find the correct receiver
                        const receiver = (this.asyncIds[currNotif.id]);
                        if (receiver && currNotif.payload) {
                            //if we have a receiver and a payload, covert payload to Base64
                            const data = Buffer.from(currNotif.payload, 'base64').toString('utf-8');

                            // find the right resource endopint for the message
                            const currEndpoint = this.endPointUriLookup[receiver.uri];
                            // console.info('async notif', receiver, currNotif, currEndpoint);

                            // send the Base64 data to the proper Sensor Webagent for the resouce endpoint
                            swimClient.command(this.swimUrl, `/sensor/${currNotif.ep}/${currEndpoint.lane}`, 'setLatest', { sensorData: data });

                            console.info(this.swimUrl, `/sensor/${currNotif.ep}/${currEndpoint.lane}`, 'setLatest', { sensorData: data });

                        }
                    }
                }
            } catch (ex) {
                // there was an error so throw it
                console.info('notification parse error')
                console.info(ex);
            }


        } 

    }

    /**
     * Parse a list of incoming notifications sent on the websoket
     * 
     * @param {*} notifications 
     */
    parseNotifications(notifications) {
        // for each notification
        for (let msg of notifications) {
            // make sure message has a resource path so we know where its from
            if (msg.path) {
                // convert message data from base64 to utf-8 string
                const data = Buffer.from(msg.payload, 'base64').toString('utf-8');
                // find resource endpoint for the message path
                const currEndpoint = this.endPointUriLookup[msg.path];
                // make sure we found the endoint
                if (currEndpoint) {
                    // update the sensor webagent for the resource endopint with the new data
                    swimClient.command(this.swimUrl, `/sensor/${msg.ep}/${currEndpoint.lane}`, 'setLatest', { sensorData: data });
                    console.info(this.swimUrl, `/sensor/${msg.ep}/${currEndpoint.lane}`, 'setLatest', { sensorData: data });
                } else {
                    console.info("end point not found in lookup:", msg.ep, msg.path);
                }
            } else {
                console.info('no receiver', msg);

            }
        }
    }
   

    /**
     * Utility method to make a HTTP Request and pass
     * the proper auth headers for the Connect API
     * 
     * @param {*} path 
     * @param {*} data 
     * @param {*} type 
     * @param {*} onComplete 
     * @param {*} onError 
     */
    httpRequest(path, data, type, onComplete, onError) {
        // console.info("httpRequest", path, data, type)

        // create auth header
        const options = {
            hostname: this.apiUrl,
            path: path,
            method: type,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authtoken}`
            }
        }

        // create request object
        const req = https.request(options, res => {
            // console.info(res);
            this.httpRes = res;
            res.on('data', d => {
                // console.info(d);
                onComplete(d.toString())
            })
        })

        // error handler
        req.on('error', error => {
            console.error(error)
            if (onError) {
                onError(error);
            }

        })

        // send data to server such as for POST or PUT
        if (data) {
            req.write(data);
        }

        // complete request
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
