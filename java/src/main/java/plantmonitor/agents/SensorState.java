package swim.plantmonitor.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.api.lane.ValueLane;
import swim.structure.Record;
import swim.structure.Value;
import swim.uri.Uri;

/**
  The Sensor State Web Agent represents the state of
  a single sensor attached to a plant.
 */
public class SensorState extends AbstractAgent {

  // max number of records to hold in history lane
  private static final int HISTORY_SIZE = 17280;

  // bool used to keep track of if the sensor has registered to its plant
  private boolean isRegistered = false;

  private Boolean showDebug = false;

  /**
    Value Lane that holds the sensor name
   */
  @SwimLane("name")
  ValueLane<String> name = this.<String>valueLane();


  /**
    Value Lane that hold the latest value from the sensor (resource)
   */
  @SwimLane("latest")
  ValueLane<Float> latest = this.<Float>valueLane()
    .didSet((newValue, oldValue) -> {

      // create timestamp
      final long now = System.currentTimeMillis();

      // update history lane with new value and timestamp
      this.history.put(now, newValue);

      // check if new value is under threshold
      this.checkAlert(newValue);

    });

  /**
    Value Lane which hold all the resource information for 
    this sensor which was passed from the Connect API by NodeJS
   */
  @SwimLane("info")
  ValueLane<Value> info = this.<Value>valueLane();

  /**
    Value Lane which holds the threshold value used when
    checking if there is an 'alert' on this sensor. 
   */
  @SwimLane("threshold")
  ValueLane<Float> threshold = valueLane();

  /**
    Value Lane which is a boolean of if there is an alert or not
    on this sensor.
   */
  @SwimLane("alert")
  ValueLane<Boolean> alert = this.<Boolean>valueLane();

  /**
    Map Lane which holds the history of this sensor values keyed by timestamp    
   */
  @SwimLane("history")
  MapLane<Long, Float> history = this.<Long, Float>mapLane()
    .didUpdate((key, newValue, oldValue) -> {
      if (this.history.size() > HISTORY_SIZE) {
        this.history.remove(this.history.getIndex(0).getKey());
      }
    });

  /**
    Command Lane used to set the latest sensor value.
   */
  @SwimLane("setLatest")
  CommandLane<Record> setLatestCommand = this.<Record>commandLane()
    .onCommand((newData) -> {
      Float newValue = newData.get("sensorData").floatValue();
      latest.set(newValue);

      if(this.showDebug) {
        System.out.print(String.format("[%1$s Sensor Value]:", this.name.get()));
        System.out.println(newValue);
      }
    });    

  /**
    Command Lane used to change the sensor threshold value.
   */
  @SwimLane("setThreshold")
  CommandLane<Float> setThreshold = this.<Float>commandLane()
    .onCommand(newValue -> {
      if(this.showDebug) {
        System.out.print(String.format("[%1$s Threshold Value]:", this.name.get()));
        System.out.println(newValue);
      }

      threshold.set(newValue);
    });    

  /**
    Command Lane used to sent the info for the current sensor
   */
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

  /**
    private method used to check if there should be an alert for this sensor.
    The method checks if the value in the 'latest' lane is less then the value
    in the 'threshold' lane, and if it is trigger an alert.
   */
  private void checkAlert(Float newValue) {
    // create url to the sensor's parent plant
    String plantNode = String.format("/plant/%1$s", this.info.get().get("plantId").stringValue("none"));

    if(plantNode != "none") {
      if (newValue <= threshold.get()) {
        // trigger alert
        if(this.alert.get() == false) {

          // toggle alert lane boolean value
          alert.set(true);

          // tell parent plant
          command(plantNode, "addAlert", this.info.get());

        }
      } else {
        // disable alert
        if(this.alert.get() == true) {

          // toggle alert lane boolean value
          alert.set(false);

          // tell parent plant
          command(plantNode, "removeAlert", this.info.get());

        }

      }
    }
  }      

  @Override
  public void didStart() {
    // set some default values for our lanes
    // this prevents the UI from getting bad values 
    // if the sensor has not been updated by NodeJS with real data
    this.latest.set(0f);
    this.threshold.set(20f);
    this.alert.set(false);    
  }  
  
}