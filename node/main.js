
// include library for talking to ardunio
const ArduinoBoard = require('./modules/ArduinoBoard');

// include SWIM client
const swimClient = require('@swim/client');

// grab command line argumenets
const commandLineArgs = process.argv

class Main {

    constructor() {
        this.showDebug = false;
        this.args = {};
        this.swimUrl = "ws://127.0.0.1:9001";
        this.plantId = "test1";
        this.plantInfo = {
            id: "test1",
            name: "Test One",
            useSim: false
        };
        this.arduino = {
            board: null,
            address: "/dev/ttyS3",
            baud: 115200
        };
        this.processCommandLineArgs();

        this.sensorData = null;
        this.loopInterval = 500;
        this.loopTimeout = null;
    }


    start() {
        this.arduino.board = new ArduinoBoard(false);
        this.arduino.board.startPort(this.arduino.address, this.arduino.baud);  
        this.arduino.board.setDataHandler(this.onSerialData.bind(this));

        swimClient.command(this.swimUrl, `/plant/${this.plantInfo.id}`, 'createPlant', this.plantInfo);

        this.mainLoop();
    }

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
            console.info('[main] mainLoop', this.sensorData);
        }

        if(this.loopTimeout !== null) {
            clearTimeout(this.loopTimeout);
        }

        if(this.sensorData !== null) {
            swimClient.command(this.swimUrl, `/plant/${this.plantInfo.id}`, 'setSensorData', this.sensorData);
            for(let sensorKey in this.sensorData) {
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
            if(val.indexOf('=') > 0) {
                const rowValue = val.split('=');
                this.args[rowValue[0]] = rowValue[1];
            }
        })
    }    

}

// create Main and kick everything off by calling start()
const main = new Main();
main.start();