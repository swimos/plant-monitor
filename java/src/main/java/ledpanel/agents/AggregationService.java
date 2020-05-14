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

public class AggregationService extends AbstractAgent {

    @SwimLane("plantList")
    MapLane<String, Value> plantList = this.<String, Value>mapLane();
  
    @SwimLane("addPlant")
    CommandLane<Value> addPlantCommand = this.<Value>commandLane().onCommand(plantData -> {
      String plantId = plantData.get("id").stringValue("none");
      if (plantId != "none") {
        plantList.put(plantId, plantData);
      }  
    });


    @Override
    public void didStart() {
    }
  
}