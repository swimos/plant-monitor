class Sim {

  constructor(swimUrl) {
    this.swimUrl = swimUrl
    this.showDebug = true;
    this.plantInfo = null;

    this.links = {};
    this.plantList = {};
    this.sensorLinks = {};
    this.plantListSynced = false;
    this.plantListLink = null;
    this.plantDataLink = null;
    this.loopInterval = 100;
    this.loopTimeout = null;
    this.sensorData = {
      light: 1,
      soil: 1,
      tempAvg: 1,
      humidity: 1,
      pressure: 1
    };
    this.keepSynced = false;
    this.selectedPlant = null;
    this.plantHealthAvg = 300;

    this.lightGreenLeafColor = swim.Color.rgb(128, 197, 110);
    this.darkGreenLeafColor = swim.Color.rgb(102, 172, 102);
    this.lightBrownLeafColor = swim.Color.rgb(197, 157, 110);
    this.darkBrownLeafColor = swim.Color.rgb(172, 145, 102);
  }

  initialize() {

    this.plantListLink = swim.nodeRef(this.swimUrl, '/aggregationService').downlinkMap().laneUri('plantList')
      .didUpdate((key, value) => {
        if (!document.getElementById(key.stringValue())) {
          this.plantList[key.stringValue()] = value.toObject();
          const newDiv = document.createElement("div");
          newDiv.id = key.stringValue();
          newDiv.innerHTML = `<span>${this.plantList[key.stringValue()].name}</span> <b id="${key.stringValue()}-alertCount">0</b>`;

          document.getElementById("plantListingDiv").appendChild(newDiv);
        }
      })
      .didRemove((key) => {
        delete this.plantList[key.stringValue()];
        const removeDiv = document.getElementById(key.stringValue());
        if (removeDiv) {
          document.getElementById("plantListingDiv").removeChild(removeDiv);
        }
      })
      .didSync(() => {
        if (!this.plantListSynced) {
          this.plantListSynced = true;
          this.selectPlant(Object.keys(this.plantList)[0]);
        }
        this.alertListLink.open();
      });

    this.alertListLink = swim.nodeRef(this.swimUrl, '/aggregationService').downlinkMap().laneUri('plantAlerts')
      .didUpdate((key, value) => {
        let alertCount = document.getElementById(`${key.stringValue()}-alertCount`);
        if (alertCount) {
          alertCount.innerText = value.numberValue();

        }
      })
      .didRemove((key) => {
        let alertCount = document.getElementById(`${key.stringValue()}-alertCount`);
        if (alertCount) {
          alertCount.innerText = 0;

        }
      })

    // start app
    this.start();
  }

  getRandomName() {
    return NAME_LIST[Math.floor(Math.random() * NAME_LIST.length)];
  }

  getRandomPlantName() {
    return PLANT_NAMES[Math.floor(Math.random() * PLANT_NAMES.length)];
  }

  start() {
    this.plantListLink.open();
    document.getElementById("plantIdValue").value = Utils.newGuid();
    document.getElementById("plantNameValue").value = `${this.getRandomName()} the ${this.getRandomPlantName()}`;
    document.getElementById("plantDataHeader").innerText = document.getElementById("plantNameValue").value;

    this.mainLoop();

    document.getElementById("plantListingDiv").onclick = (evt) => {
      this.handlePlantListClick(evt);

    }
  }

  /**
   * plant list click handler
   * @param {*} evt 
   */
  handlePlantListClick(evt) {
    this.selectPlant(evt.target.parentElement.id)
  }

  sliderMouseEvt(mouseState) {
    if (this.selectedPlant !== null) {
      if (mouseState === "down") {
        this.keepSynced = false;
      } else {
        this.keepSynced = true;
      }
    }
  }

  selectPlant(plantId) {
    console.info("Select Plant:", plantId);

    // close any open swim links
    for (let linkKey in this.links) {
      console.info("close link", linkKey);
      this.links[linkKey].close();
      this.links[linkKey] = null;
    }
    for (let linkKey in this.sensorLinks) {
      console.info("close sensor link", linkKey);
      this.sensorLinks[linkKey].close();
      this.sensorLinks[linkKey] = null;
    }  

    // reset some member vars
    this.links = {};
    this.sensorList = {};
    this.sensorListSynced = false;
    this.keepSynced = false;

    const plant = this.plantList[plantId];
    this.selectedPlant = plant;

    // highlight selected plant in list
    let listDiv = document.getElementById("plantListingDiv");
    listDiv.childNodes.forEach((elem) => {
      const plantId = (this.selectedPlant && this.selectedPlant.id) ? this.selectedPlant.id : "null";
      elem.className = (elem.id == plantId) ? "selectedRow" : "";
    });

    // if plant is null then it was not in plantList so we are done
    if (!plant) {
      return;
    }
    
    // link to get plant info
    this.links['plantInfo'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkValue().laneUri('info')
      .didSet((newData, oldData) => {
        if (newData.isDefined()) {
          this.plantInfo = newData.toObject();
          document.getElementById("plantIdValue").value = this.plantInfo.id;
          document.getElementById("plantNameValue").value = this.plantInfo.name;
          document.getElementById("plantDataHeader").innerText = document.getElementById("plantNameValue").value;
        }

      })

    // links to get list of sensors for plant
    this.links['sensorList'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkMap().laneUri('sensorList')
      .didUpdate((key, value) => {
        this.sensorList[key.stringValue()] = value.stringValue();
      })
      .didSync(() => {
        this.createSensorListeners(plantId);
        this.keepSynced = true;
      });


    // open all our swim links
    for (let linkLKey in this.links) {
      console.info("open link", linkLKey);
      this.links[linkLKey].open();
    }

  }

  /**
   * method to create links to fetch sensor data
   * @param {*} plantId 
   */
  createSensorListeners(plantId) {
    if (!this.sensorListSynced) {

      this.sensorListSynced = true;

      // close any open swim links
      for (let linkKey in this.sensorLinks) {
        console.info("close sensor link", linkKey);
        if(this.sensorLinks[linkKey]) {
          this.sensorLinks[linkKey].close();
        }        
        this.sensorLinks[linkKey] = null;
      }
      this.sensorLinks = [];

      // loop over sensor list and open links to 'latest' and 'shortHistory' lanes for each
      for (let sensor in this.sensorList) {
        this.sensorLinks[`sensor-${sensor}-latest`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensor}`).downlinkValue().laneUri('latest')
          .didSet((newValue, oldValue) => {
            switch (sensor) {
              case "soil":
                document.getElementById("soilValue").value = `${newValue.stringValue()}`;
                document.getElementById("soilRange").value = `${newValue.stringValue()}`;
                break;
              case "light":
                document.getElementById("lightValue").value = `${newValue.stringValue()}`;
                document.getElementById("lightRange").value = `${newValue.stringValue()}`;
                break;
              case "tempAvg":
                document.getElementById("tempAvgValue").value = `${newValue.stringValue()}`;
                document.getElementById("tempAvgRange").value = `${newValue.stringValue()}`;
                break;
              case "pressure":
                document.getElementById("pressureValue").value = `${newValue.stringValue()}`;
                document.getElementById("pressureRange").value = `${newValue.stringValue()}`;
                break;
              case "humidity":
                document.getElementById("humidityValue").value = `${newValue.stringValue()}`;
                document.getElementById("humidityRange").value = `${newValue.stringValue()}`;
                break;
      
            }
          })

      }

      // re-open new links
      for (let linkKey in this.sensorLinks) {
        console.info("open sensor link", linkKey);
        this.sensorLinks[linkKey].open();
      }      

    }    
  }

  // startSensorListener(plantId, sensorId) {
  //   this.links[`sensor-${sensorId}-latest`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensorId}`).downlinkValue().laneUri('latest')
  //     .didSet((newValue, oldValue) => {
  //       this.handleSensorChange(newValue, sensorId);
  //     })
  //     .open();

  // }

  // handleSensorChange(newValue, sensorId) {
  //   this.sensorList[sensorId] = newValue;
  //   this.plantHealthAvg = Math.round((parseInt(this.sensorData.light) + parseInt(this.sensorData.soil) + parseInt(this.sensorData.tempAvg)) / 3);
  //   if (this.keepSynced) {
  //     switch (sensorId) {
  //       case "soil":
  //         document.getElementById("soilValue").value = `${newValue.stringValue()}`;
  //         document.getElementById("soilRange").value = `${newValue.stringValue()}`;
  //         break;
  //       case "light":
  //         document.getElementById("lightValue").value = `${newValue.stringValue()}`;
  //         document.getElementById("lightRange").value = `${newValue.stringValue()}`;
  //         break;
  //       case "tempAvg":
  //         document.getElementById("tempAvgValue").value = `${newValue.stringValue()}`;
  //         document.getElementById("tempAvgRange").value = `${newValue.stringValue()}`;
  //         break;
  //       case "pressure":
  //         document.getElementById("pressureValue").value = `${newValue.stringValue()}`;
  //         document.getElementById("pressureRange").value = `${newValue.stringValue()}`;
  //         break;
  //       case "humidity":
  //         document.getElementById("humidityValue").value = `${newValue.stringValue()}`;
  //         document.getElementById("humidityRange").value = `${newValue.stringValue()}`;
  //         break;

  //     }
  //   }
  // }

  handleSubmit(formObj) {
    const plantId = document.getElementById("plantIdValue").value
    const plantName = document.getElementById("plantNameValue").value

    if (!this.plantList[plantId]) {
      console.info("New Plant")
      const plantInfo = {
        "id": plantId,
        "name": plantName
      }
      this.selectedPlant = plantInfo;
      swim.command(this.swimUrl, `/plant/${plantId}`, 'createPlant', plantInfo);
      swim.command(this.swimUrl, `/sensor/${plantId}/light`, 'setInfo', { sensorId: 'light', sensorName: "Light", "plantId": plantId });
      swim.command(this.swimUrl, `/sensor/${plantId}/soil`, 'setInfo', { sensorId: 'soil', sensorName: "Soil", "plantId": plantId });
      swim.command(this.swimUrl, `/sensor/${plantId}/tempAvg`, 'setInfo', { sensorId: 'tempAvg', sensorName: "Temp", "plantId": plantId });
      swim.command(this.swimUrl, `/sensor/${plantId}/pressure`, 'setInfo', { sensorId: 'pressure', sensorName: "Pressure", "plantId": plantId });
      swim.command(this.swimUrl, `/sensor/${plantId}/humidity`, 'setInfo', { sensorId: 'humidity', sensorName: "Humidity", "plantId": plantId });
    } else {
      console.info("Existing Plant");
    }
    this.collectFormData();
    this.selectPlant(plantId);
    this.keepSynced = true;
  }

  handleRangeUpdate(evt) {
    // console.info(evt)
    document.getElementById(evt.name.replace("Range", "Value")).value = evt.value;
  }

  collectFormData() {
    this.sensorData['light'] = document.getElementById("lightValue").value || 1;
    this.sensorData['soil'] = document.getElementById("soilValue").value || 1;
    this.sensorData['tempAvg'] = document.getElementById("tempAvgValue").value || 1;
    this.sensorData['pressure'] = document.getElementById("pressureValue").value || 1;
    this.sensorData['humidity'] = document.getElementById("humidityValue").value || 1;

  }
  mainLoop() {

    if (this.showDebug) {
      // console.info('[main] mainLoop', this.sensorData);
    }

    if (this.loopTimeout !== null) {
      clearTimeout(this.loopTimeout);
    }

    if (this.sensorData !== null && this.keepSynced) {

      this.collectFormData();
      this.plantHealthAvg = Math.round((parseInt(this.sensorData.light) + parseInt(this.sensorData.soil) + parseInt(this.sensorData.tempAvg)) / 3);
      // change color of the plant leaves
      const soilIntValue = this.plantHealthAvg;
      const newLightColorH = Utils.interpolate(this.lightBrownLeafColor.hsl().h, this.lightGreenLeafColor.hsl().h, soilIntValue, 100);
      const newLightColor = swim.Color.hsl(newLightColorH, this.lightBrownLeafColor.hsl().s, this.lightBrownLeafColor.hsl().l).toHexString();

      const newDarkColorH = Utils.interpolate(this.darkBrownLeafColor.hsl().h, this.darkGreenLeafColor.hsl().h, soilIntValue, 100);
      const newDarkColor = swim.Color.hsl(newDarkColorH, this.darkBrownLeafColor.hsl().s, this.darkBrownLeafColor.hsl().l).toHexString();

      for (let svgItem of document.getElementById("plantLeaves").children) {
        if (svgItem.getAttribute("type") == "light") {
          svgItem.style.fill = newLightColor;
        }
        if (svgItem.getAttribute("type") == "dark") {
          svgItem.style.fill = newDarkColor;
        }
      }
      
      
      // if we are not keeping sync with incoming messages then we are safe to send outgoing messages
      // if(this.keepSynced) {
        for (let sensorKey in this.sensorData) {
          // console.info(this.swimUrl, `/sensor/${this.plantInfo.id}/${sensorKey}`, 'setLatest', this.sensorData[sensorKey]);
          const plantId = document.getElementById("plantIdValue").value
          const msg = {
            plantId: plantId,
            sensorId: sensorKey,
            sensorData: parseInt(this.sensorData[sensorKey])
          }
          if (this.showDebug) {
            // console.info(this.swimUrl, `/sensor/${plantId}/${sensorKey}`, 'setLatest', msg);
          }
          swim.command(this.swimUrl, `/sensor/${plantId}/${sensorKey}`, 'setLatest', msg);
        }
      // }

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

  interpolate: (startValue, endValue, stepNumber, lastStepNumber) => {
    return (endValue - startValue) * stepNumber / lastStepNumber + startValue;
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