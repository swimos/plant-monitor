package swim.plantmonitor.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.api.lane.ValueLane;
import swim.concurrent.TimerRef;
import swim.structure.Record;
import swim.structure.Value;
import swim.uri.Uri;
import java.util.Timer;
import java.util.TimerTask;

public class PlantState extends AbstractAgent {

  @SwimLane("info")
  ValueLane<Value> info = this.<Value>valueLane();

  @SwimLane("sensorList")
  MapLane<String, Value> sensorList = this.<String, Value>mapLane();

  @SwimLane("alertList")
  MapLane<String, Value> alertList = this.<String, Value>mapLane();

  @SwimLane("createPlant")
  CommandLane<Value> createPlantCommand = this.<Value>commandLane()
    .onCommand(plantInfo -> {
      System.out.println("New plant");
      System.out.println(plantInfo);
      this.info.set(plantInfo);
      command("/aggregationService", "addPlant", this.info.get());
    });

  @SwimLane("addSensor")
  CommandLane<Value> addSensorCommand = this.<Value>commandLane()
    .onCommand(sensor -> {
      System.out.println("add sensor");
      System.out.println(sensor);
      this.sensorList.put(sensor.get("sensorId").stringValue(""), sensor);
    });

  @SwimLane("addAlert")
  CommandLane<Value> addAlertCommand = this.<Value>commandLane()
    .onCommand(sensor -> {
      System.out.println("add sensor alert");
      System.out.println(sensor);
      if(sensor != Value.absent()) {
        this.alertList.put(sensor.get("sensorId").stringValue(), sensor);

        Record alertInfo = Record.create()
          .slot("plantId", this.info.get().get("id").stringValue())
          .slot("alertCount", this.alertList.size());
        command("/aggregationService", "addAlert", alertInfo);
      }
    });

  @SwimLane("removeAlert")
  CommandLane<Value> removeAlertCommand = this.<Value>commandLane()
    .onCommand(sensor -> {
      System.out.println("remove sensor alert");
      System.out.println(sensor);
      this.alertList.remove(sensor.get("sensorId").stringValue());

      if(this.alertList.size() == 0) {
        command("/aggregationService", "removeAlert", this.info.get().get("id"));
      } else {
        Record alertInfo = Record.create()
          .slot("plantId", this.info.get().get("id").stringValue())
          .slot("alertCount", this.alertList.size());
        command("/aggregationService", "addAlert", alertInfo);
      }
      
    });

  @Override
  public void didStart() {
     
  }  
  
}