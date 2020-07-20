
// include library for talking to ardunio
const ArduinoBoard = require('./modules/ArduinoBoard');

// include SWIM client
const swimClient = require('@swim/client');

// grab command line arguments
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
        this.deviceId = this.config.deviceId;

        this.plantInfo = this.config.plantInfo;

        this.arduino = {
            board: null,
            enabled: this.config.arduino.enabled || false,
            address: this.config.arduino.address || null,
            baud: this.config.arduino.baud || null
        };

        this.sensorData = {};
        this.loopInterval = this.config.mainLoopInterval;
        this.loopTimeout = null;
        this.dataChanged = false;
    }


    start() {
        // start Arduino connection if enabled in config
        if (this.arduino.enabled) {
            this.arduino.board = new ArduinoBoard(false);
            this.arduino.board.startPort(this.arduino.address, this.arduino.baud);
            this.arduino.board.setDataHandler(this.onSerialData.bind(this));
        }

        for (const index in this.config.sensors) {
            const sensor = this.config.sensors[index]; // current endpoint config data

            // if current endpoint is enabled
            if (sensor.enabled) {
                // define sensor info for current resource endpoint
                const msg = {
                    plantId: this.plantInfo.id,
                    sensorName: sensor.name,
                    sensorId: sensor.lane,
                }

                // create new sensor webagent 
                swimClient.command(this.swimUrl, `/sensor/${this.plantInfo.id}/${sensor.lane}`, 'setInfo', msg);

            }
        }        

        // register new plant with Swim Server
        swimClient.command(this.swimUrl, `/plant/${this.plantInfo.id}`, 'createPlant', this.plantInfo);

        // kick off app loop
        this.mainLoop();
    }

    // handle data sent from arduino or other serial device. Should be receiving JSON formatted messages.
    onSerialData(newData) {
        try {
            this.sensorData = JSON.parse(newData);
        } catch (e) {
            // we actually dont care about errors here
            // console.error(e);
        }
    }

    mainLoop() {
        if (this.showDebug) {
            // console.info('[main] mainLoop', this.sensorData);
        }

        if (this.loopTimeout !== null) {
            clearTimeout(this.loopTimeout);
        }

        if (this.sensorData !== null) {
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
            this.loopTimeout = setTimeout(this.mainLoop.bind(this), this.loopInterval);
        } else {
            this.loopTimeout = setTimeout(this.mainLoop.bind(this), 10);
        }


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
