/**
 * LedMatrixPage class drives the LED Animation page
 * in this code a 'panel' is any LED panel, matrix, array, etx that can be animated
 * It is assumed that every panel has an array of individually addressable RGB LEDs. 
 * This class handles the page only. The actual driving and updating of LED panels is handled
 * with Node in /node/main.js of this project.
 */
class PlantPage {

  swimUrl = null;
  links = {};
  plantList = {};
  plantListSynced = false;
  plantListLink = null;
  plantDataLink = null;
  plantInfo = null;

  sensorList = [];
  sensorListSynced = false;

  tween = swim.Transition.duration(120);

  mainGauge = null;
  soilDial = null;
  lightDial = null;
  tempDial = null;

  soilColor = swim.Color.rgb(14, 173, 105);
  lightColor = swim.Color.rgb(255, 210, 63);
  tempColor = swim.Color.rgb(238, 66, 102);

  charts = [];
  plots = [];

  constructor(swimUrl) {
    this.swimUrl = swimUrl;

  }

  /**
   * class init. setup swim links and deafault objects/variable 
   * and then call start()
   */
  initialize() {

    // load list of animations saved in swim animationService
    this.plantListLink = swim.nodeRef(this.swimUrl, '/aggregationService').downlinkMap().laneUri('plantList')
      .didUpdate((key, value) => {
        this.plantList[key.stringValue()] = value.toObject();
      })
      .didRemove((key) => {
        delete this.plantList[key.stringValue()];
      })
      .didSync(() => {
        if (!this.plantListSynced) {
          this.plantListSynced = true;
          this.selectPlant(Object.keys(this.plantList)[0]);
        }
      });

    this.start();
  }

  /**
   * Start up the LED Animator page
   */
  start() {
    this.initPage();
    this.plantListLink.open()


  }

  initPage() {
    const gaugePanel = new swim.HtmlAppView(document.getElementById("soilGauge"));
    const canvas = gaugePanel.append("canvas");
    const count = 3;

    // Create a new gauge view
    this.mainGauge = new swim.GaugeView()
      .innerRadius(swim.Length.pct(20))
      .outerRadius(swim.Length.pct(45))
      .dialColor(swim.Color.rgb(100, 100, 100, 0.2))
      .title(new swim.TextRunView("Plant 1").font("20px sans-serif"))
      .font("14px sans-serif")
      .textColor("#ffffff")
      .cornerRadius(4)
      .dialSpacing(3)
      .startAngle(swim.Angle.rad((count === 1 ? -Math.PI / 2 : 3 * Math.PI / 4)), this.tween)
      .sweepAngle(swim.Angle.rad((count === 1 ? 2 * Math.PI : 3 * Math.PI / 2)), this.tween)
    // and append it to the canvas.
    canvas.append(this.mainGauge);

    this.soilDial = new swim.DialView()
      .total(1000)
      .value(0) // initialize to zero so the dial will tween in
      .meterColor(this.soilColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.lightDial = new swim.DialView()
      .total(1000)
      .value(0) // initialize to zero so the dial will tween in
      .meterColor(this.lightColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.tempDial = new swim.DialView()
      .total(100)
      .value(0) // initialize to zero so the dial will tween in
      .meterColor(this.tempColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.mainGauge.append(this.soilDial);
    this.mainGauge.append(this.lightDial);
    this.mainGauge.append(this.tempDial);

    const chartList = ['temperatureCh1', 'light', 'soil'];

    for (let chartKey of chartList) {
      const chartPanel = new swim.HtmlAppView(document.getElementById(`${chartKey}Chart`));
      const chartCanvas = chartPanel.append("canvas");
  
  
      this.charts[chartKey] = new swim.ChartView()
        .bottomAxis("time")
        .leftAxis("linear")
        .bottomGesture(false)
        .leftDomainPadding([0.1, 0.1])
        .domainColor("#4a4a4a")
        .tickMarkColor("#4a4a4a")
        .font("12px sans-serif")
        .textColor("#4a4a4a");

      this.plots[chartKey] = new swim.LineGraphView()
        .strokeWidth(2);

      switch(chartKey) {
        case 'soil':
          this.plots[chartKey].stroke(this.soilColor);
          break;
        case 'light':
          this.plots[chartKey].stroke(this.lightColor);
          break;
        case 'temperatureCh1':
          this.plots[chartKey].stroke(this.tempColor);
          break;

      }

      this.charts[chartKey].addPlot(this.plots[chartKey]);

      chartCanvas.append(this.charts[chartKey]);

    }
  }


  selectPlant(plantId) {
    this.links['plantInfo'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkValue().laneUri('info')
      .didSet((newData, oldData) => {
        if (newData.isDefined()) {
          this.plantInfo = newData.toObject();
        }

      })
      .open()
    this.links['sensorList'] = swim.nodeRef(this.swimUrl, `/plant/${plantId}`).downlinkMap().laneUri('sensorList')
      .didUpdate((key, value) => {
        this.sensorList[key.stringValue()] = value.stringValue();
      })
      .didSync(() => {
        if (!this.sensorListSynced) {
          this.sensorListSynced = true;
          for (let sensor in this.sensorList) {
            this.links[`sensor-${sensor}-latest`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensor}`).downlinkValue().laneUri('latest')
              .didSet((newValue, oldValue) => {
                switch (sensor) {
                  case "soil":
                    this.soilDial.value(newValue.numberValue(), this.tween);
                    const labelValue1 = Math.round((newValue.stringValue() / 1000) * 100);
                    this.soilDial.label(`${labelValue1}%`);
                    break;
                  case "light":
                    this.lightDial.value(newValue.numberValue(), this.tween);
                    const labelValue2 = Math.round((newValue.stringValue() / 1000) * 100);
                    this.lightDial.label(`${labelValue2}%`);
                    break;
                  case "temperatureCh1":
                    this.tempDial.value(newValue.numberValue(), this.tween);
                    this.tempDial.label(`${newValue.stringValue()}°F`);
                    break;

                }
              })
              .open();

            this.links[`sensor-${sensor}-history`] = swim.nodeRef(this.swimUrl, `/sensor/${plantId}/${sensor}`).downlinkMap().laneUri('history')
              .didUpdate((timestamp, sensorvalue) => {
                if(this.plots[sensor]) {
                  this.plots[sensor].insertDatum({ x: timestamp.numberValue(), y: sensorvalue.numberValue(), opacity: 1 });
                }
                
              })
              .didRemove((timestamp, sensorvalue) => {
                if(this.plots[sensor]) {
                  this.plots[sensor].removeDatum(timestamp.numberValue());
                }
              })
              .open();

          }

        }
      });

    // open all our swim links
    for (let linkLKey in this.links) {
      this.links[linkLKey].open();
    }

  }



}
