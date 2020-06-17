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

  @SwimLane("createPlant")
  CommandLane<Value> createPlantCommand = this.<Value>commandLane()
    .onCommand(plantInfo -> {
      System.out.println(plantInfo);
      this.info.set(plantInfo);
      command("/aggregationService", "addPlant", this.info.get());
    });

  @SwimLane("addSensor")
  CommandLane<Value> addSensorCommand = this.<Value>commandLane()
    .onCommand(sensor -> {

      this.sensorList.put(sensor.get("sensorId").stringValue(), sensor);
    });

  @Override
  public void didStart() {
     
  }  
  
}