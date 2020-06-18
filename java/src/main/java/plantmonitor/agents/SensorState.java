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

  @SwimLane("name")
  ValueLane<String> name = this.<String>valueLane();

  @SwimLane("asyncId")
  ValueLane<String> asyncId = this.<String>valueLane();

  @SwimLane("info")
  ValueLane<Value> info = this.<Value>valueLane();

  @SwimLane("threshold")
  ValueLane<Float> threshold = valueLane();

  @SwimLane("alert")
  ValueLane<Boolean> alert = this.<Boolean>valueLane();

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
      this.checkAlert(newValue);
    });    

  @SwimLane("setThreshold")
  CommandLane<Float> setThreshold = this.<Float>commandLane()
    .onCommand(t -> {
      threshold.set(t);
    });    

  @SwimLane("setAsyncId")
  CommandLane<String> setAsyncId = this.<String>commandLane()
    .onCommand(t -> {
      asyncId.set(t);
    });    

  @SwimLane("setInfo")
  CommandLane<Record> setInfoCommand = this.<Record>commandLane()
    .onCommand((newData) -> {
      this.name.set(newData.get("sensorName").stringValue());
      this.info.set(newData);
      if(!isRegistered) {
        String plantNode = String.format("/plant/%1$s", newData.get("plantId").stringValue());
        // System.out.println(plantNode);
        command(plantNode, "addSensor", newData);
        this.isRegistered = true;
      }

    });    

  private void checkAlert(Float newValue) {
      if (newValue <= threshold.get()) {
        // trigger alert
        if(this.alert.get() == false) {
          System.out.print("add alert: ");
          System.out.println((newValue <= threshold.get()));
          alert.set(true);
          // tell plant
          String plantNode = String.format("/plant/%1$s", this.info.get().get("plantId").stringValue());
          command(plantNode, "addAlert", this.info.get());

        }
      } else {
        // disable alert
        if(this.alert.get() == true) {
          alert.set(false);
          // tell plant
          String plantNode = String.format("/plant/%1$s", this.info.get().get("plantId").stringValue());
          command(plantNode, "removeAlert", this.info.get());

        }

      }

  }      

  @Override
  public void didStart() {
    this.latest.set(0f);
    this.threshold.set(20f);
    this.alert.set(false);    
  }  
  
}