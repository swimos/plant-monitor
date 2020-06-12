class Sim {

  showDebug = true;
  swimUrl = null;
  plantInfo = null;

  links = {};
  plantList = {};
  plantListSynced = false;
  plantListLink = null;
  plantDataLink = null;
  loopInterval = 100;
  loopTimeout = null;
  sensorData = {};

  constructor(swimUrl) {
    this.swimUrl = swimUrl

  }

  initialize() {

    // load list of animations saved in swim animationService
    this.plantListLink = swim.nodeRef(this.swimUrl, '/aggregationService').downlinkMap().laneUri('plantList')
      .didUpdate((key, value) => {
        if(!document.getElementById(key.stringValue())) {
          this.plantList[key.stringValue()] = value.toObject();
          const newDiv = document.createElement("div");
          newDiv.id = key.stringValue();
          newDiv.innerText = this.plantList[key.stringValue()].name;

          document.getElementById("plantListingDiv").appendChild(newDiv);
        }
      })
      .didRemove((key) => {
        delete this.plantList[key.stringValue()];
        const removeDiv = document.getElementById(key.stringValue());
        if(removeDiv) {
          document.getElementById("plantListingDiv").removeChild(removeDiv);
        }
      })
      .didSync(() => {
        if(!document.getElementById("none")) {
          const newDiv = document.createElement("div");
          newDiv.id = 'none';
          newDiv.innerText = "None";

          document.getElementById("plantListingDiv").appendChild(newDiv);

        }

        if (!this.plantListSynced) {
          this.plantListSynced = true;
          // this.selectPlant(Object.keys(this.plantList)[0]);
        }
      });

    this.start();
  }

  start() {
    this.plantListLink.open();
    document.getElementById("plantIdValue").value = Utils.newGuid();
    document.getElementById("plantNameValue").value = "New Plant";

    this.mainLoop();

    document.getElementById("plantListingDiv").onclick = (evt) => {
      this.handlePlantListClick(evt);
      
    }
  }

  handlePlantListClick(evt) {
    console.info(evt.target.id);
    this.selectPlant(evt.target.id)
  }

  selectPlant(plantId) {
    console.info("Select Plant:", plantId);

    // open all our swim links
    for (let linkLKey in this.links) {
      console.info("close link", linkLKey);
      this.links[linkLKey].close();
      this.links[linkLKey] = null;
    }

    this.links = {};
    this.sensorList = {};
    this.sensorListSynced = false;

    const plant = this.plantList[plantId];

    if(!plant) {
      return;
    }

    this.links['plantInfo'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkValue().laneUri('info')
      .didSet((newData, oldData) => {
        if (newData.isDefined()) {
          this.plantInfo = newData.toObject();
          document.getElementById("plantIdValue").innerText = this.plantInfo.id;
          document.getElementById("plantNameValue").innerText = this.plantInfo.name;
        }

      })
      .open()
    this.links['sensorList'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkMap().laneUri('sensorList')
      .didUpdate((key, value) => {
        this.sensorList[key.stringValue()] = value.stringValue();
        document.getElementById(`${key.stringValue()}Value`).value = this.sensorList[key.stringValue()];
    
      })
      .didSync(() => {
          for (let sensor in this.sensorList) {
            this.links[`sensor-${sensor}-latest`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensor}`).downlinkValue().laneUri('latest')
              .didSet((newValue, oldValue) => {
                switch (sensor) {
                  case "soil":
                    document.getElementById("soilValue").value = `${newValue.stringValue()}`; 
                    break;
                  case "light":
                    document.getElementById("lightValue").value = `${newValue.stringValue()}`; 
                    break;
                  case "tempAvg":
                    document.getElementById("tempAvgValue").value = `${newValue.stringValue()}`; 
                    break;
                  case "pressure":
                    document.getElementById("pressureValue").value = `${newValue.stringValue()}`; 
                    break;
                  case "humidity":
                    document.getElementById("humidityValue").value = `${newValue.stringValue()}`; 
                    break;
    
                }
              })
              .open();


          }

      });


    // open all our swim links
    for (let linkLKey in this.links) {
      console.info("open link", linkLKey);
      this.links[linkLKey].open();
    }

  }

  handleSubmit(formObj) {
    const plantId = document.getElementById("plantIdValue").value
    const plantName = document.getElementById("plantNameValue").value

    if (!this.plantList[plantId]) {
      console.info("New Plant")
      const plantInfo = {
        "id": plantId,
        "name": plantName
      }
      swim.command(this.swimUrl, `/plant/${plantId}`, 'createPlant', plantInfo);
    } else {
      console.info("Existing Plant");
    }

    this.sensorData['light'] = document.getElementById("lightValue").value || 0;
    this.sensorData['soil'] = document.getElementById("soilValue").value || 0;
    this.sensorData['tempAvg'] = document.getElementById("tempAvgValue").value || 0;
    this.sensorData['pressure'] = document.getElementById("pressureValue").value || 0;
    this.sensorData['humidity'] = document.getElementById("humidityValue").value || 0;
  }

  mainLoop() {

    if (this.showDebug) {
      // console.info('[main] mainLoop', this.sensorData);
    }

    if (this.loopTimeout !== null) {
      clearTimeout(this.loopTimeout);
    }

    if (this.sensorData !== null) {

      this.sensorData['light'] = document.getElementById("lightValue").value || 0;
      this.sensorData['soil'] = document.getElementById("soilValue").value || 0;
      this.sensorData['tempAvg'] = document.getElementById("tempAvgValue").value || 0;
      this.sensorData['pressure'] = document.getElementById("pressureValue").value || 0;
      this.sensorData['humidity'] = document.getElementById("humidityValue").value || 0;
    
      // swimClient.command(this.swimUrl, `/plant/${this.plantInfo.id}`, 'setSensorData', this.sensorData);
      for (let sensorKey in this.sensorData) {
        // console.info(this.swimUrl, `/sensor/${this.plantInfo.id}/${sensorKey}`, 'setLatest', this.sensorData[sensorKey]);
        const plantId = document.getElementById("plantIdValue").value
        const msg = {
          plantId: plantId,
          sensorId: sensorKey,
          sensorData: parseInt(this.sensorData[sensorKey])
        }
        if (this.showDebug) {
          console.info(this.swimUrl, `/sensor/${plantId}/${sensorKey}`, 'setLatest', msg);
        }
        swim.command(this.swimUrl, `/sensor/${plantId}/${sensorKey}`, 'setLatest', msg);
      }

    }
    this.loopTimeout = setTimeout(this.mainLoop.bind(this), this.loopInterval);

  }

}

Utils = {
  newGuid: () => {
    return 'xxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = (c === 'x') ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  setCookie: (cookieName, cookieValue, expireDays) => {
    var newDate = new Date();
    newDate.setTime(newDate.getTime() + (expireDays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + newDate.toUTCString();
    document.cookie = cookieName + "=" + cookieValue + ";" + expires + ";path=/";
  },

  getCookie: (cookieName) => {
    var name = cookieName + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var cookieValues = decodedCookie.split('=');
    if (cookieValues.length === 2) {
      return cookieValues[1];
    }
    return "";
  }
}