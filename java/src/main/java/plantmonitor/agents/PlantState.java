package swim.plantmonitor.agents;

import swim.api.SwimLane;
import swim.api.agent.AbstractAgent;
import swim.api.lane.CommandLane;
import swim.api.lane.MapLane;
import swim.api.lane.ValueLane;
import swim.api.lane.JoinValueLane;
import swim.codec.Utf8;
import swim.concurrent.TimerRef;
import swim.json.Json;
import swim.structure.Record;
import swim.structure.Value;
import swim.uri.Uri;
import swim.uri.UriPath;
import java.util.Timer;
import java.util.TimerTask;

import java.io.InputStream;
import java.io.OutputStream;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.GZIPInputStream;

public class PlantState extends AbstractAgent {

  private String blinkAsyncId;

  @SwimLane("info")
  ValueLane<Value> info = this.<Value>valueLane();

  @SwimLane("sensorList")
  MapLane<String, Value> sensorList = this.<String, Value>mapLane();

  @SwimLane("alertList")
  MapLane<String, Value> alertList = this.<String, Value>mapLane();


  @SwimLane("blinkAsyncIdJoin")
  private JoinValueLane<String, String> blinkAsyncIdJoin = this.<String, String>joinValueLane()
    .didUpdate((k,n,o) -> {
      System.out.println("Blink Async ID updated: ");
      System.out.println(k);
      System.out.println(n);
      System.out.println(o);
      this.blinkAsyncId = n;
  
    });  

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
      if(sensor.get("sensorId").stringValue("").equals("blinkAction")) {
        System.out.println("create blink join");
        System.out.println(this.info.get().get("id").stringValue("0"));
        
        final Uri nodeUri = Uri.from(UriPath.from("/", "sensor", "/", this.info.get().get("id").stringValue("0"), "blinkAction"));
        System.out.println(nodeUri);
        //joinTaxiPositions.downlink(nodeUri).nodeUri(nodeUri).laneUri("vehiclesPosition").open(); 
        blinkAsyncIdJoin.downlink(nodeUri.toString()).nodeUri(nodeUri).laneUri("asyncId").open();
      }
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

        try {
          String urlString = String.format("https://api.us-east-1.mbedcloud.com/v2/device-requests/%1$s?async-id=%2$s", this.info.get().get("id").stringValue("0"), this.blinkAsyncId);
          URL baseUrl = new URL(urlString);
          System.out.println("http req");
          System.out.println(baseUrl);
          // String fullUrl = String.format("%1$s/%2$s?%3$s", newData.get("plantId").stringValue(), this.info.get().get("plantId").stringValue(), "xXXXx");
          String message = "{ \"method\": \"POST\", \"uri\": \"/3201/0/5850\" }";
          this.doHttpRequest(baseUrl, message, "POST");

        } catch(Exception ex) {
          System.out.println("request error");
          System.out.println(ex);
        }
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

  private void doHttpRequest(URL url, String message, String method) {
      final HttpURLConnection urlConnection;
      // System.out.println("OpenSky Agent: start requestStateVectors from " + url);
      try {
          urlConnection = (HttpURLConnection) url.openConnection();
          urlConnection.setDoOutput(true);
          urlConnection.setRequestMethod(method);
          urlConnection.setRequestProperty("Content-Type", "application/json");
          urlConnection.setRequestProperty("Authorization", "Bearer ak_1MDE3MjI5MWVlZWVhN2ExZTNkYzEyYWU3MDAwMDAwMDA01722982f11bceef6448061800000000hHrp7q2Ow4TeYe9x5SkkOCJ28GBIRThK");
          urlConnection.setRequestProperty("Accept-Encoding", "gzip, deflate");

          OutputStream reqStream = urlConnection.getOutputStream();
          reqStream.write(message.getBytes());    
          reqStream.flush();      

          // final InputStream stream = new GZIPInputStream(urlConnection.getInputStream());
          // System.out.println(stream);
          final InputStream stream = urlConnection.getInputStream();
          // final Value returnMsg = Utf8.read(Json.parser(), stream);

          stream.close();
          reqStream.close();

      } catch (Throwable e) {
          e.printStackTrace();
      }
      
  }     
  
}