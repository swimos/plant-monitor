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

public class SensorState extends AbstractAgent {

  private static final int HISTORY_SIZE = 5760;
  private static final int SHORT_HISTORY_SIZE = 200;
  private boolean isRegistered = false;

  @SwimLane("latest")
  ValueLane<Float> latest = this.<Float>valueLane();

  @SwimLane("history")
  MapLane<Long, Float> history = this.<Long, Float>mapLane()
    .didUpdate((key, newValue, oldValue) -> {
      if (this.history.size() > HISTORY_SIZE) {
        this.history.remove(this.history.getIndex(0).getKey());
      }
    });

  @SwimLane("shortHistory")
  MapLane<Long, Float> shortHistory = this.<Long, Float>mapLane()
    .didUpdate((key, newValue, oldValue) -> {
      if (this.shortHistory.size() > SHORT_HISTORY_SIZE) {
        this.shortHistory.remove(this.shortHistory.getIndex(0).getKey());
      }
    });

  @SwimLane("setLatest")
  CommandLane<Record> setLatestCommand = this.<Record>commandLane()
    .onCommand((newData) -> {
      // System.out.println(newData);
      final long now = System.currentTimeMillis();

      Float newValue = newData.get("sensorData").floatValue();
      latest.set(newValue);
      history.put(now, newValue);
      shortHistory.put(now, newValue);
      if(!isRegistered) {
        String plantNode = String.format("/plant/%1$s", newData.get("plantId").stringValue());
        // System.out.println(plantNode);
        command(plantNode, "addSensor", newData.get("sensorId"));
        this.isRegistered = true;
      }
    });    

  @Override
  public void didStart() {
    
  }  
  
}