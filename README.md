# Simple Plant Monitor

Stripped down version of our Greenhouse Demo. This version simply shows the real stime status of a series of sensor hooked up to a plant. 

Application has three swim WebAgent types:
* AggreagtionService - top level WebAgent which tracks one or more plants. Mostly used to find out what plants are being trackes
* PlantState - WebAgent which monitors the state of a single plant. Registers to AggreagtionService on startup. There should be one PlantState agent per actual plant.
* SensorState - WebAgent which tracks the state of a single sensor. Registers to a plant. Each plant can have several sensors and so several SensorState WebAgents

Web UI showing real time state of a single plant based on the agent structure decribed above.

![screenshot](/ui/assets/images/ui-screenshot.png)


## Setup
Requirements:
1. Java9+
2. Git

Starting the App for Development:
1. cd /java - cd into the java folder of the project
2. Start Gradle
    * (Linux) ./gradlew run 
    * (Windows) .\gradlew.bat run

The gradle wrapper will automatically pull down the correct version of Gradle and then build/run the app. One the app is running you will see "Running Swim Plant Montior Server..." in the console. You can now navigate to the main pages of the app in your browser:

* Main: http://127.0.0.1:9001
* Plant Sim: http://127.0.0.1:9001/sim.html



Setting up as a service 
https://www.raspberrypi.org/documentation/linux/usage/systemd.md

* cd to project root
* ./gradlew build
* untar app tar file from build to dist
* sudo cp swim-plant-monitor-* /etc/systemd/system/
* sudo systemctl daemon-reload
* sudo systemctl start swim-plant-monitor-server.service
* sudo systemctl start swim-plant-monitor-client.service
* sudo systemctl enable swim-plant-monitor-server.service
* sudo systemctl enable swim-plant-monitor-client.service