# Simple Plant Monitor Demo

## Overview
The purpose of this application is to demonstrate how to use Swim Web Agents and the Pelion Connect API to create digital twins of devices being managed by Pelion Device Management and the resources on those devices. This demo assumes that each device has a fixed number of sensors attached which are mapped to resources using Arm MbedOS and the Pelion Device Management API. 

## About Swim
SwimOS is a complete, self-contained distributed software platform for building stateful, massively real-time streaming applications. SwimOS implements a distributed microkernel, called the Swim Kernel, that is persistent without a database, reactive without a message broker, autonomous without a job manager, and which executes general purpose stateful applications without a separate app


## Application Structure
Application has three main WebAgent types. These three types are theAggregationService, PlantState, and SensorState. Each of these agents are able to communicate with each other to share data and create an application structure.

**AggregationService** - The Aggregation Service Web Agent keeps track of things that are global to the application such as list of all plants and alerts and application config. The application will only have a singe Aggregation Web Agent and the agent is started by the Application Plane on app startup.

**PlantState** - The PlantState Web Agent represents a single device being managed by Pelion. Each device has a collection of sensors attached to it and each of those sensors map to a resource on the the device.

In this example NodeJS is using the config file to route data coming from the Pelion Connect API back to the correct Sensor Web Agent for this plant.

**SensorState** - The Sensor State Web Agent represents the state of a single resource on a device being managed by the Pelion Device Management. 

A Sensor WebAgent is created by NodeJS during Device Registration and automatically registers itself with its parent Plant Web Agent based on the plantID sent as part of sensor info.

## Connect API Bridge
In this example we use NodeJS to bridge data between the Pelion Connect API and the WebAgent inside our Swim Application. Since this bridge uses basic HTTP requests and the Swim Client, it could also be written in Java, Python, or Rust but for simplicity, in this example we are using JavaScript. Node and the main Swim application also share the same configuration file to make things easier. 

On startup, Node will send http requests to clear any existing notification subscriptions for your API Key and then create a new websocket to receive notifications from the Connect API.

Once the websocket is opened a new http request is sent to retrieve of all devices being managed by your API key. For each device in the device list returned from the API, if the device is status is marked as `registered` then Node will send a command to Swim to create a new Plant WebAgent using the device information from the API. Node will use the "endpoints" data from the configuration file to create notification subscriptions and Sensor WebAgents for each resource endpoint. 

After Node finished create subscriptions, subsequent notifications for sensor value changes will come across the websocket. Node uses the configuration data along with the device endpoint data to route the notifications to the correct sensor for the correct plant. This mapping is based on the device and resource IDs provided by Pelion Device Management.

All resource data sent to and from the Connect API is Base64 encoded. Node handles both decoding and encoding message so that out Swim Application is always dealing with unencoded data.

In order to allow for communication back to the Connect API from the application UI, Node also passes along "AsyncIDs" for resources which support them. Those IDs are stored in the Sensor WebAgent the ID is associated with. By doing this we can setup command lanes in those Webagents which allow the UI to call back to resources on the parent device without having to pass the API key and auth tokens to the UI. 


![architecture](/ui/assets/images/dataflow-diagram.png)

Web UI showing real time state of a single plant based on the agent structure described above.

![screenshot](/ui/assets/images/ui-screenshot.png)


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

Pelion Device Simulator
1. Start docker image with proper API key
2. Navigate to the [Device Simulator Page](http://127.0.0.1:8002/view/peliondm)
3. Verify your simulated device registers itself in the device portal.

Once your device is registered, the Connect API will send a registration event to the Node Bridge. That will trigger the bridge to query the API for the device information and then create new plant and sensor web agents for the device and its resources.


