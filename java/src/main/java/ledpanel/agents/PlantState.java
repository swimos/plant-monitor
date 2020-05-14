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
  MapLane<String, String> sensorList = this.<String, String>mapLane();

  @SwimLane("createPlant")
  CommandLane<Value> createPlantCommand = this.<Value>commandLane()
    .onCommand(plantInfo -> {
      this.info.set(plantInfo);
      command("/aggregationService", "addPlant", this.info.get());
    });

  @SwimLane("addSensor")
  CommandLane<Value> addSensorCommand = this.<Value>commandLane()
    .onCommand(sensorId -> {
      this.sensorList.put(sensorId.stringValue(), sensorId.stringValue());
    });

  @Override
  public void didStart() {
     
  }  
  
}