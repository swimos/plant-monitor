package swim.plantmonitor.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.api.lane.ValueLane;
import swim.api.lane.JoinValueLane;
import swim.codec.Utf8;
import swim.json.Json;
import swim.structure.Record;
import swim.structure.Value;
import swim.uri.Uri;
import swim.uri.UriPath;

import swim.plantmonitor.configUtil.ConfigEnv;


/**
  The PlantState Web Agent represents a single 
  simulated plant and each plant has a collection 
  of sensors attached to it.
 */
public class PlantState extends AbstractAgent {

  // application config data. Populated by SetConfig command lane.
  private Value config;

  private Boolean showDebug = false;

  /**
    Value Lane to hold all the static device data for this plant.
    This will include all device info returned from Pelion Connect API 
    from the /v3/devices query done by NodeJS
   */
  @SwimLane("info")
  ValueLane<Value> info = this.<Value>valueLane();

  /**
    Map Lane to hold list of sensors for this plant.
   */
  @SwimLane("sensorList")
  MapLane<String, Value> sensorList = this.<String, Value>mapLane();

  /**
    Map Lane to hold list of alerts for the plant
   */
  @SwimLane("alertList")
  MapLane<String, Value> alertList = this.<String, Value>mapLane();

  /**
    Command Lane used to receive application config data from 
    Aggregation Web Agent after Plant Agent is created
   */
  @SwimLane("setConfig")
  CommandLane<Value> setConfigCommand = this.<Value>commandLane()
    .onCommand(configData -> {
      this.config = configData;
    });

  /**
    Command Lane used to create a Plant Web Agent
   */
  @SwimLane("createPlant")
  CommandLane<Value> createPlantCommand = this.<Value>commandLane()
    .onCommand(plantInfo -> {
      if(this.showDebug) {
        System.out.print("[New plant]:");
        System.out.println(plantInfo);
      }
      this.info.set(plantInfo);
      command("/aggregationService", "addPlant", this.info.get());
    });

  /**
    Command Lane to add a sensor web agent to the plant's sensor list
   */
  @SwimLane("addSensor")
  CommandLane<Value> addSensorCommand = this.<Value>commandLane()
    .onCommand(sensor -> {
      if(this.showDebug) {
        String plantName = this.info.get().get("name").stringValue("none");
        System.out.print(String.format("[New Sensor for %1$s]:", plantName));
        System.out.println(sensor);
      }

      // put new sensor on sensorList
      this.sensorList.put(sensor.get("sensorId").stringValue(""), sensor);

    });

  /**
    Command Lane to add an alert to the plant alert list
   */
  @SwimLane("addAlert")
  CommandLane<Value> addAlertCommand = this.<Value>commandLane()
    .onCommand(sensor -> {
      if(this.showDebug) {
        System.out.print("[Add Sensor Alert]:");
        System.out.println(sensor);
      }

      // make sure we have sensor data to work with
      if(sensor != Value.absent()) {

        // add alert to alertList
        this.alertList.put(sensor.get("sensorId").stringValue(), sensor);

        // create record with new alert count 
        Record alertInfo = Record.create()
          .slot("plantId", this.info.get().get("id").stringValue())
          .slot("alertCount", this.alertList.size());

        // send alert count record to Aggregation Web Agent
        command("/aggregationService", "addAlert", alertInfo);

      }
    });

  /**
    Command Lane to remove an alert from the plant alert list
   */
  @SwimLane("removeAlert")
  CommandLane<Value> removeAlertCommand = this.<Value>commandLane()
    .onCommand(sensor -> {
      if(this.showDebug) {
        System.out.print("[Remove Sensor Alert]:");
        System.out.println(sensor);
      }

      // remove the alert from the alert list
      this.alertList.remove(sensor.get("sensorId").stringValue());

      // if there are no more alert, remove the plant from 
      // the Aggregation Agent alerts list, otherwise update the
      // alert count on the Aggreagation Agent alerts list
      if(this.alertList.size() == 0) {

        // remove plant from list
        command("/aggregationService", "removeAlert", this.info.get().get("id"));
        
      } else {

        // create new alert count record
        Record alertInfo = Record.create()
          .slot("plantId", this.info.get().get("id").stringValue())
          .slot("alertCount", this.alertList.size());

        // send record to aggregation agent
        command("/aggregationService", "addAlert", alertInfo);
      }
      
    });
  
}