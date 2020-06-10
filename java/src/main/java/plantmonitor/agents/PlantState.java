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

import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.GZIPInputStream;

import swim.plantmonitor.configUtil.ConfigEnv;


/**
  The PlantState Web Agent represnts a single 
  device being managed by Pelion. Each device has 
  a collection of sensors attached to it and each of 
  those sensors map to a resource on the the device.

  In this example NodeJS is using the config file to route data 
  coming from the Pelion Connect API back to the correct 
  Sensor Web Agent for this plant.
 */
public class PlantState extends AbstractAgent {

  // async id returned from Connect API
  // populated by 'blinkAsyncIdJoin' Join Lane
  private String blinkAsyncId;

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
    Join Lane to get the Async ID from the /blinkAction Sensor Web Agent.
    This is required for making http requests back to the Pelion Connect API 
    in order to trigger the blink action on the device itself. The async id will
    come from NodeJS during device registration.
   */
  @SwimLane("blinkAsyncIdJoin")
  private JoinValueLane<String, String> blinkAsyncIdJoin = this.<String, String>joinValueLane()
    .didUpdate((k,n,o) -> {
      this.blinkAsyncId = n;  
    });  

  /**
    Command Lane used to reviece application config data from 
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

      // if the new sensor is the 'blinkAction' sensor
      // open our join lane to get the asyn id needed to blink the LED
      if(sensor.get("sensorId").stringValue("").equals("blinkAction")) {
        final Uri nodeUri = Uri.from(UriPath.from("/", "sensor", "/", this.info.get().get("id").stringValue("0"), "blinkAction"));
        blinkAsyncIdJoin.downlink(nodeUri.toString()).nodeUri(nodeUri).laneUri("asyncId").open();
      }
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

        // if there is a blinkAsyncId, trigger blink on device
        if(this.blinkAsyncId != null) {
          this.triggerLedBlink();
        } else {
          System.out.println("No async id for this plant");
        }
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
  

  /**
    Command Lane used to trigger Plant LED blink 
   */
  @SwimLane("blinkLed")
  CommandLane<Value> blinkLedCommand = this.<Value>commandLane()
    .onCommand(msg -> {
      this.triggerLedBlink();
    });


  /**
    Make http request back to Pelion Connect API
    to trigger the LED blink for this plant (device);
   */
  private void triggerLedBlink() {
    try {
      // create the url needed to talk to the pelion connect api for this device
      String urlString = String.format("https://%1$s/v2/device-requests/%2$s?async-id=%3$s", this.config.get("apiUrl").stringValue(), this.info.get().get("id").stringValue("0"), this.blinkAsyncId);
      URL baseUrl = new URL(urlString);

      if(this.showDebug) {
        System.out.print("[http req]:");
        System.out.println(baseUrl);
      }

      // create trigger blink message and send it on a http request
      String message = "{ \"method\": \"POST\", \"uri\": \"/3201/0/5850\" }";
      this.doHttpRequest(baseUrl, message, "POST");

    } catch(Exception ex) {
      System.out.println("request error");
      System.out.println(ex);
    }
  }

  /**
    Utility method to make a HTTP Request and pass
    the proper auth headers for the Pelion Connect API    
   */
  private void doHttpRequest(URL url, String message, String method) {
      final HttpURLConnection urlConnection;
      // System.out.println("OpenSky Agent: start requestStateVectors from " + url);
      try {
          // create the auth string using authToken in config file
          String authString = String.format("Bearer %1$s", this.config.get("authToken").stringValue());

          // create a url connection
          urlConnection = (HttpURLConnection) url.openConnection();
          urlConnection.setDoOutput(true); // tell connection we will be sending data
          urlConnection.setRequestMethod(method); // set request method

          // set request header for authentication on Pelion Connect API
          urlConnection.setRequestProperty("Content-Type", "application/json");
          urlConnection.setRequestProperty("Authorization", authString);
          urlConnection.setRequestProperty("Accept-Encoding", "gzip, deflate");

          // open output stream and send our blink message
          OutputStream reqStream = urlConnection.getOutputStream();
          reqStream.write(message.getBytes());
          reqStream.flush();      

          final InputStream stream = urlConnection.getInputStream();

          // close our streams
          stream.close();
          reqStream.close();

      } catch (Throwable e) {
          e.printStackTrace();
      }
      
  }     
  
}