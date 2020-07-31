# Simple Plant Monitor Demo

![architecture](/ui/assets/images/dataflow-diagram.png)

## Overview
The purpose of this application is to demonstrate how to use Swim Web Agents and the Pelion Connect API to create digital twins of devices being managed by Pelion Device Management and the resources on those devices. This demo assumes that each device has a fixed number of sensors attached which are mapped to resources using Arm MbedOS and the Pelion Device Management API. Visit the [Pelion blog post](https://blog.pelion.com/post/swim-ai-and-pelion-device-management) for more information on the architecture of the application.


## Setup
*Requirements:*
1. Java9+
2. NodeJS 12+
3. Git

*Install (from a command line):*
1. `git clone https://github.com/swimos/plant-monitor/tree/pelion`
2. `cd plant-monitor/node`
3. `npm install`
4. Edit `config/localhost.json` and API Keys for "authToken". You can get an API key from the [Pelion Portal](https://portal.mbedcloud.com/access/keys/list).

Starting Swim:
1. cd to /plant-monitor/java
2. Start Gradle
    * (Linux) `./gradlew run `
    * (Windows) `.\gradlew.bat run`

The gradle wrapper will automatically pull down the correct version of Gradle and then build/run the app. Once the app is running you will see "Running Swim Plant Monitor Server..." in the console. Next start up the NodeJS bridge.

Starting Node bridge:
1. Open a new command prompt
2. cd to /plant-monitor/node
3. `npm start`

You can now navigate to the [main page](http://127.0.0.1:9001) of the app in your browser.

You now need to register a device to Pelion Device Management. Start by cloning the [official reference example](https://github.com/ARMmbed/mbed-cloud-client-example) from Pelion and replacing the contents of the `main.cpp` with the contents found in `peliondm/main.cpp` folder. The reference example has been modified in order to add 'simulated' sensors ('Temperature', 'Light Level', 'Humidity', 'Pressure') which regularly send new values every 5sec to device management.

1. `git clone https://github.com/ARMmbed/mbed-cloud-client-example`
2. `cd mbed-cloud-client-example`
3. `cp ../plant-monitor/peliondm/main.cpp main.cpp`
4. Follow the [Pelion documentation](https://www.pelion.com/docs/device-management/current/connecting/mbed-os.html) to compile and flash the code in your device.


 Once your device is registered, the Connect API will send a registration event to the Node Bridge. That will trigger the bridge to query the API for the device information and then create new plant and sensor web agents for the device and its resources.
