# Simple Plant Monitor Demo

## Overview
The purpose of this application is to demonstrate how to use Swim Web Agents to create digital twins of simulated devices which represent a plant with a collection of sensors.

## About Swim
SwimOS is a complete, self-contained distributed software platform for building stateful, massively real-time streaming applications. SwimOS implements a distributed microkernel, called the Swim Kernel, that is persistent without a database, reactive without a message broker, autonomous without a job manager, and which executes general purpose stateful applications without a separate app


## Application Structure
Application has three main WebAgent types. These three types are theAggregationService, PlantState, and SensorState. Each of these agents are able to communicate with each other to share data and create an application structure.

**AggregationService** - The Aggregation Service Web Agent keeps track of things that are global to the application such as list of all plants and alerts and application config. The application will only have a singe Aggregation Web Agent and the agent is started by the Application Plane on app startup.

**PlantState** - The PlantState Web Agent represents a single simulated plant. Each plant has a collection of sensors attached to it.

**SensorState** - The Sensor State Web Agent represents the state of a single resource on a device being managed by the Pelion Device Management. 

A Sensor WebAgent is created by NodeJS during Device Registration and automatically registers itself with its parent Plant Web Agent based on the plantID sent as part of sensor info.

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

You can now navigate to the [Main Page](http://127.0.0.1:9001) of the app in your browser. Next, in another tab, navigate to the [Plant Sim](http://127.0.0.1:9001), select a few value and click Create Plant. Your new sim plant will appear in the list on both pages.



