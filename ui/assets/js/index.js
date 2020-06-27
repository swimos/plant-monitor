class PlantPage {

  constructor(swimUrl) {
    this.swimUrl = swimUrl;
    this.links = {};
    this.sensorLinks = {};
    this.plantList = {};
    this.plantListSynced = false;
    this.plantListLink = null;
    this.plantDataLink = null;
    this.plantInfo = null;
    this.plantAlerts = [];

    this.sensorList = [];
    this.sensorListSynced = false;

    this.tween = swim.Transition.duration(300);

    this.gaugePanel = null;
    this.mainGauge = null;
    this.ledGauge = null;
    this.soilDial = null;
    this.lightDial = null;
    this.tempDial = null;

    this.soilColor = swim.Color.rgb(14, 173, 105);
    this.lightColor = swim.Color.rgb(255, 210, 63);
    this.tempColor = swim.Color.rgb(238, 66, 102);
    this.pressureColor = swim.Color.rgb(117, 69, 115)
    this.humidityColor = swim.Color.rgb(79, 121, 162)

    this.selectedPlant = null;
    this.charts = [];
    this.plots = [];

    this.tempImg = new Image();
    this.blinkAsyncId = null;
    this.patternAsyncId = null;
  }

  /**
   * class init. setup swim links and deafault objects/variable 
   * and then call start()
   */
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

  /**
   * Start up the LED Animator page
   */
  start() {
    this.plantListLink.open();
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

  /**
   * Select Plant by its unique ID
   * @param {*} plantId 
   */
  selectPlant(plantId) {
    console.info("Select Plant:", plantId);

    // clear charts
    this.removeCharts();

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

    // clear text fields
    document.getElementById("pressureValue").innerHTML = ``;
    document.getElementById("humidityValue").innerHTML = ``;

    // reset some member vars
    this.links = {};
    this.sensorList = {};
    this.plantAlerts = [];
    this.sensorListSynced = false;
    this.blinkAsyncId = null;
    this.patternAsyncId = null;

    // lookup selected plant in plant list
    const plant = this.plantList[plantId];
    this.selectedPlant = plant;

    // update plant list to highlight new selection
    let listDiv = document.getElementById("plantListingDiv");
    listDiv.childNodes.forEach((elem) => { 
      const plantId = (this.selectedPlant && this.selectedPlant.id) ? this.selectedPlant.id : "null";
      elem.className = (elem.id == plantId) ? "selectedRow" : ""; 
    } );

    // if plant is null then it was not in plantList so we are done
    if (!plant) {
      return;
    }

    // redraw our charts again
    this.drawCharts();

    // set plant name in UI
    document.getElementById("plantNameHeader").innerText = plant.name;

    // link to get plant info
    this.links['plantInfo'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkValue().laneUri('info')
      .didSet((newData, oldData) => {
        if (newData.isDefined()) {
          this.plantInfo = newData.toObject();
        }

      })

    // link to get async id to update plant blink pattern
    this.links['blinkAsyncId'] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/blinkAction`).downlinkValue().laneUri('asyncId')
      .didSet((newData, oldData) => {
        if (newData.isDefined()) {
          this.blinkAsyncId = newData.stringValue();
        }

      })

    // link to get async id to send blink led command
    this.links['patternAsyncId'] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/blinkPattern`).downlinkValue().laneUri('asyncId')
      .didSet((newData, oldData) => {
        if (newData.isDefined()) {
          this.patternAsyncId = newData.stringValue();
        }

      })

    // link to get list of alert for selected plant
    this.links['alertList'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkMap().laneUri('alertList')
      .didUpdate((key, value) => {
        this.plantAlerts[key.stringValue()] = value;
        this.mainGauge.title(new swim.TextRunView(`${Object.keys(page.plantAlerts).length} Alerts`).font("20px sans-serif"))
      })
      .didRemove((key) => {
        delete this.plantAlerts[key.stringValue()];
        this.mainGauge.title(new swim.TextRunView(`${Object.keys(page.plantAlerts).length} Alerts`).font("20px sans-serif"))
      });

    // links to get list of sensors for plant
    this.links['sensorList'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkMap().laneUri('sensorList')
      .didUpdate((key, value) => {
        this.sensorList[key.stringValue()] = value.stringValue();
      })
      .didSync(() => {
        this.createSensorListeners(plantId);
      });

    // open all our swim links
    for (let linkKey in this.links) {
      console.info("open link", linkKey);
      this.links[linkKey].open();
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
        this.sensorLinks[linkKey].close();
        this.sensorLinks[linkKey] = null;
      }

      // loop over sensor list and open links to 'latest' and 'shortHistory' lanes for each
      for (let sensor in this.sensorList) {
        this.sensorLinks[`sensor-${sensor}-latest`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensor}`).downlinkValue().laneUri('latest')
          .didSet((newValue, oldValue) => {
            switch (sensor) {
              case "soil":
                this.soilDial.value(newValue.numberValue(), this.tween);
                const labelValue1 = newValue.stringValue();
                this.soilDial.label(`${labelValue1}%`);
                break;
              case "light":
                this.lightDial.value(newValue.numberValue(), this.tween);
                const labelValue2 = newValue.stringValue();
                this.lightDial.label(`${labelValue2}%`);
                break;
              case "tempAvg":
                this.tempDial.value(newValue.numberValue(), this.tween);
                this.tempDial.label(`${newValue.stringValue()}°C`);
                break;
              case "pressure":
                this.pressureDial.value(newValue.numberValue(), this.tween);
                this.pressureDial.label(`${newValue.stringValue()} mb`);
                document.getElementById("pressureValue").innerHTML = `${newValue.stringValue()} mb`;
                break;
              case "humidity":
                this.humidityDial.value(newValue.numberValue(), this.tween);
                this.humidityDial.label(`${newValue.stringValue()}%`);
                document.getElementById("humidityValue").innerHTML = `${newValue.stringValue()}%`;
                break;

            }
          })

        this.sensorLinks[`sensor-${sensor}-history`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensor}`).downlinkMap().laneUri('shortHistory')
          .didUpdate((timestamp, sensorvalue) => {
            if (this.plots[sensor]) {
              this.plots[sensor].insertDatum({ x: timestamp.numberValue(), y: sensorvalue.numberValue(), opacity: 1 });
            }

          })
          .didRemove((timestamp, sensorvalue) => {
            if (this.plots[sensor]) {
              this.plots[sensor].removeDatum(timestamp.numberValue());
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

  /**
   * Remove all charts and gauge from UI
   */
  removeCharts() {
    if (this.mainGauge !== null) {
      // this.mainGauge
      this.mainGauge.removeAll();
      this.mainGauge = null;
      this.charts['light'].parentView.removeAll();
      this.charts['soil'].parentView.removeAll();
      this.charts['tempAvg'].parentView.removeAll();
      this.charts['pressure'].parentView.removeAll();
      this.charts['humidity'].parentView.removeAll();
      this.charts = [];
      this.plots = [];
    }

  }

  /**
   * Draw all the charts and gauge to UI
   */
  drawCharts() {
    if (this.gaugePanel === null) {
      this.gaugePanel = new swim.HtmlAppView(document.getElementById("soilGauge"));
    }
    const canvas = this.gaugePanel.append("canvas");
    const count = 3;

    // Create the main gauge view
    this.mainGauge = new swim.GaugeView()
      .innerRadius(swim.Length.pct(20))
      .outerRadius(swim.Length.pct(48))
      .dialColor(swim.Color.rgb(100, 100, 100, 0.2))
      .font("14px sans-serif")
      .textColor("#ffffff")
      .cornerRadius(4)
      .dialSpacing(3)
      .startAngle(swim.Angle.rad((count === 1 ? -Math.PI / 2 : 3 * Math.PI / 4)))
      .sweepAngle(swim.Angle.rad((count === 1 ? 2 * Math.PI : 3 * Math.PI / 2)))

    // set title of main guage
    this.mainGauge.title(new swim.TextRunView(`0 Alerts`).font("20px sans-serif"))

    // define gauge dials
    this.soilDial = new swim.DialView()
      .total(100)
      .value(0) // initialize to zero so the dial will tween in
      .meterColor(this.soilColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.lightDial = new swim.DialView()
      .total(100)
      .value(0) 
      .meterColor(this.lightColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.tempDial = new swim.DialView()
      .total(100)
      .value(0) 
      .meterColor(this.tempColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.pressureDial = new swim.DialView()
      .total(1000)
      .value(0) 
      .meterColor(this.pressureColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.humidityDial = new swim.DialView()
      .total(100)
      .value(0) 
      .meterColor(this.humidityColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    // append dials to gauge
    this.mainGauge.append(this.lightDial);
    this.mainGauge.append(this.soilDial);
    this.mainGauge.append(this.tempDial);
    this.mainGauge.append(this.pressureDial);
    this.mainGauge.append(this.humidityDial);

    // append gauge to canvas
    canvas.append(this.mainGauge);

    // array of chart names. This is looped over to create history charts
    const chartList = ['tempAvg', 'light', 'soil', 'pressure', 'humidity'];

    // loop over chart array and create history charts
    for (let chartKey of chartList) {
      // create chart app view
      const chartPanel = new swim.HtmlAppView(document.getElementById(`${chartKey}Chart`));
      // append canvas to app view
      const chartCanvas = chartPanel.append("canvas");

      const lineColor = "#fff";
      this.charts[chartKey] = new swim.ChartView()
        .bottomAxis("time")
        .leftAxis("linear")
        .bottomGesture(false)
        .leftDomainPadding([0, 0])
        .topGutter(0)
        .bottomGutter(20)
        .leftGutter(25)
        .rightGutter(0)
        .font("12px \"Open Sans\"")
        .domainColor(lineColor)
        .tickMarkColor(lineColor)
        .textColor(lineColor);

      // create line plot for current chart
      this.plots[chartKey] = new swim.LineGraphView()
        .strokeWidth(2);

      // pick line color for current plot
      switch (chartKey) {
        case 'soil':
          this.plots[chartKey].stroke(this.soilColor);
          break;
        case 'light':
          this.plots[chartKey].stroke(this.lightColor);
          break;
        case 'tempAvg':
          this.plots[chartKey].stroke(this.tempColor);
          break;
        case 'pressure':
          this.plots[chartKey].stroke(this.pressureColor);
          break;
        case 'humidity':
          this.plots[chartKey].stroke(this.humidityColor);
          break;
    
      }

      // add line plot to the current chart
      this.charts[chartKey].addPlot(this.plots[chartKey]);

      // append current chart to canvas
      chartCanvas.append(this.charts[chartKey]);

    }
  }

  /**
   * Send blink LED command to pelion device
   */
  blinkLed() {
    if (this.selectedPlant !== null && this.blinkAsyncId) {
      var xhttp = new XMLHttpRequest();
      let msg = JSON.stringify({ "method": "POST", "uri": "/3201/0/5850" });
      let str = `https://api.us-east-1.mbedcloud.com/v2/device-requests/${this.selectedPlant.id}?async-id=${this.blinkAsyncId}`

      xhttp.open('POST', str, true)
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.setRequestHeader("Authorization", "Bearer ak_1MDE3MjI5MWVlZWVhN2ExZTNkYzEyYWU3MDAwMDAwMDA01722982f11bceef6448061800000000hHrp7q2Ow4TeYe9x5SkkOCJ28GBIRThK");
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4) {
          if (this.status == 202) {
            console.info("Command sent");
          } else {
            console.info("could not send command", this)
          }
        }
      };
      xhttp.send(msg);
    } else {
      alert("Select a device");
    }
  }

  /**
   * Send command to change blink pattern to pelion device
   */
  changePattern() {
    if (this.selectedPlant !== null && this.patternAsyncId) {
      const newPattern = prompt("Enter new pattern");

      var xhttp = new XMLHttpRequest();
      let msg = `{"method": "PUT", "uri": "/3201/0/5853", "accept": "text/plain", "content-type": "text/plain", "payload-b64": "${btoa(newPattern)}"}`;
      let str = `https://api.us-east-1.mbedcloud.com/v2/device-requests/${this.selectedPlant.id}?async-id=${this.patternAsyncId}`

      xhttp.open('POST', str, true)
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.setRequestHeader("Authorization", "Bearer ak_1MDE3MjI5MWVlZWVhN2ExZTNkYzEyYWU3MDAwMDAwMDA01722982f11bceef6448061800000000hHrp7q2Ow4TeYe9x5SkkOCJ28GBIRThK");
      xhttp.onreadystatechange = function () {
        if (this.readyState == 4) {
          if (this.status == 202) {
            console.info("Command sent");
          } else {
            console.info("could not send command", this)
          }
        }
      };
      xhttp.send(msg);
    } else {
      alert("Select a device");
    }
  }
}
