package swim.plantmonitor.agents;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.api.lane.ValueLane;
import swim.json.Json;
import swim.structure.Value;
import swim.uri.Uri;

import swim.plantmonitor.configUtil.ConfigEnv;

/**
  The Aggregation Service Web Agent keeps track of 
  things that are global to the application such as 
  list of all plants and alerts and application config.
  The application will only have a singe Aggregation Web Agent
  and the agent is started by the Application Plane on app startup.
 */
public class AggregationService extends AbstractAgent {

  // application config data
  private Value config;

  /**
    Map Lane to hold list of plants that are being tracked
   */
  @SwimLane("plantList")
  MapLane<String, Value> plantList = this.<String, Value>mapLane();

  /**
    Map Lane to hold list of alert counts for each plant
    Called by Plant Web Agent anytime one of its sensors 
    adds or removes an alert.
   */
  @SwimLane("plantAlerts")
  MapLane<String, Value> plantAlerts = this.<String, Value>mapLane();

  /**
    Command land used to update application config data
    Called on start up by Application Plane
   */
  @SwimLane("setConfig")
  CommandLane<Value> setConfigCommand = this.<Value>commandLane()
    .onCommand(configData -> {
      this.config = configData;
    });

  /**
    Command Lane to add a new plant to the plant list
    Called by a plant web agent when its created
   */
  @SwimLane("addPlant")
  CommandLane<Value> addPlantCommand = this.<Value>commandLane().onCommand(plantData -> {
    String plantId = plantData.get("id").stringValue("none");
    if (plantId != "none") {
      plantList.put(plantId, plantData);
      String plantNode = String.format("/plant/%1$s", plantId);
      command(Uri.parse(plantNode), Uri.parse("setConfig"), ConfigEnv.config);
    }  
  });

  /**
    Command Lane to add a new sensor alert to the alert list
   */
  @SwimLane("addAlert")
  CommandLane<Value> addAlertCommand = this.<Value>commandLane()
    .onCommand(sensor -> {
      this.plantAlerts.put(sensor.get("plantId").stringValue(), sensor.get("alertCount"));
    });

  /**
    Command Lane to remove an alert from the alert list
   */
  @SwimLane("removeAlert")
  CommandLane<Value> removeAlertCommand = this.<Value>commandLane()
    .onCommand(sensorId -> {
      this.plantAlerts.remove(sensorId.stringValue());
    });
  
}