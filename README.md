# Simple Plant Monitor

Stripped down version of our Greenhouse Demo. This version simply shows the real stime status of a series of sensor hooked up to a plant. 

Application has three swim WebAgent types:
* AggreagtionService - top level WebAgent which tracks one or more plants. Mostly used to find out what plants are being trackes
* PlantState - WebAgent which monitors the state of a single plant. Registers to AggreagtionService on startup. There should be one PlantState agent per actual plant.
* SensorState - WebAgent which tracks the state of a single sensor. Registers to a plant. Each plant can have several sensors and so several SensorState WebAgents

Sensor data received by NodeJS which roues the data into Swim via command lanes. This could be replaced with a data simulator.

Web UI showing real time state of a single plant based on the agent structure decribed above.

![screenshot](/ui/assets/images/ui-screenshot.png)

setting up as a service
https://www.raspberrypi.org/documentation/linux/usage/systemd.md

* cd to proejct root
* sudo cp swim-plant-monitor-* /etc/systemd/system/
* sudo systemctl daemon-reload
* sudo systemctl start swim-plant-monitor-server.service
* sudo systemctl start swim-plant-monitor-client.service
* sudo systemctl enable swim-plant-monitor-server.service
* sudo systemctl enable swim-plant-monitor-client.service