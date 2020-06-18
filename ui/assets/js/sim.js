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
  sensorData = {
    light: 1,
    soil: 1,
    tempAvg: 1,
    humidity: 1,
    pressure: 1
  };
  keepSynced = false;

  lightGreenLeafColor = swim.Color.rgb(128, 197, 110);
  darkGreenLeafColor = swim.Color.rgb(102, 172, 102);
  lightBrownLeafColor = swim.Color.rgb(197, 157, 110);
  darkBrownLeafColor = swim.Color.rgb(172, 145, 102);

  constructor(swimUrl) {
    this.swimUrl = swimUrl

  }

  initialize() {

    // load list of animations saved in swim animationService
    this.plantListLink = swim.nodeRef(this.swimUrl, '/aggregationService').downlinkMap().laneUri('plantList')
      .didUpdate((key, value) => {
        if (!document.getElementById(key.stringValue())) {
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
        if (removeDiv) {
          document.getElementById("plantListingDiv").removeChild(removeDiv);
        }
      })
      .didSync(() => {

        if (!this.plantListSynced) {
          this.plantListSynced = true;
          // this.selectPlant(Object.keys(this.plantList)[0]);
        }
      });

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

    if (!plant) {
      this.keepSynced = false;
      return;
    }
    this.keepSynced = true;

    this.links['plantInfo'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkValue().laneUri('info')
      .didSet((newData, oldData) => {
        if (newData.isDefined()) {
          this.plantInfo = newData.toObject();
          document.getElementById("plantIdValue").value = this.plantInfo.id;
          document.getElementById("plantNameValue").value = this.plantInfo.name;
          document.getElementById("plantDataHeader").innerText = document.getElementById("plantNameValue").value;
        }

      })
      .open()
    this.links['sensorList'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkMap().laneUri('sensorList')
      .didUpdate((key, value) => {
        console.info(key, value);
        if (!this.sensorList[key.stringValue()]) {
          this.sensorList[key.stringValue()] = value.stringValue();
          this.startSensorListener(plantId, key.stringValue());
        }

      })


    // open all our swim links
    for (let linkLKey in this.links) {
      console.info("open link", linkLKey);
      this.links[linkLKey].open();
    }

  }

  startSensorListener(plantId, sensorId) {
    this.links[`sensor-${sensorId}-latest`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensorId}`).downlinkValue().laneUri('latest')
      .didSet((newValue, oldValue) => {
        switch (sensorId) {
          case "soil":
            document.getElementById("soilValue").value = `${newValue.stringValue()}`;
            document.getElementById("soilRange").value = `${newValue.stringValue()}`;
            const soilIntValue = newValue.numberValue();
            // interpolate: (startValue, endValue, stepNumber, lastStepNumber) => {
            // const newLightColorR = Utils.interpolate(this.lightBrownLeafColor.r, this.lightGreenLeafColor.r, soilIntValue, 100);
            // const newLightColorG = Utils.interpolate(this.lightBrownLeafColor.b, this.lightGreenLeafColor.g, soilIntValue, 100);
            // const newLightColorB = Utils.interpolate(this.lightBrownLeafColor.b, this.lightGreenLeafColor.b, soilIntValue, 100);
            // const newDarkColorR = Utils.interpolate(this.darkBrownLeafColor.r, this.darkGreenLeafColor.r, soilIntValue, 100);
            // const newDarkColorG = Utils.interpolate(this.darkBrownLeafColor.g, this.darkGreenLeafColor.g, soilIntValue, 100);
            // const newDarkColorB = Utils.interpolate(this.darkBrownLeafColor.b, this.darkGreenLeafColor.r, soilIntValue, 100);

            const newLightColorH = Utils.interpolate(this.lightBrownLeafColor.hsl().h, this.lightGreenLeafColor.hsl().h, soilIntValue, 100);
            const newLightColor = swim.Color.hsl(newLightColorH, this.lightBrownLeafColor.hsl().s, this.lightBrownLeafColor.hsl().l).toHexString();

            const newDarkColorH = Utils.interpolate(this.darkBrownLeafColor.hsl().h, this.darkGreenLeafColor.hsl().h, soilIntValue, 100);
            const newDarkColor = swim.Color.hsl(newDarkColorH, this.darkBrownLeafColor.hsl().s, this.darkBrownLeafColor.hsl().l).toHexString();

            // const newLightColor = swim.Color.rgb(newLightColorR, newLightColorG, newLightColorB).toHexString();
            // const newDarkColor = swim.Color.rgb(newDarkColorR, newDarkColorG, newDarkColorB).toHexString();
            // console.info(newLightColor, newDarkColor);
            for (let svgItem of document.getElementById("plantLeaves").children) {
              if (svgItem.getAttribute("type") == "light") {
                svgItem.style.fill = newLightColor;
              }
              if (svgItem.getAttribute("type") == "dark") {
                svgItem.style.fill = newDarkColor;
              }
            }
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
      .open();

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
          // console.info(this.swimUrl, `/sensor/${plantId}/${sensorKey}`, 'setLatest', msg);
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