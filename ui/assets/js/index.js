/**
 * LedMatrixPage class drives the LED Animation page
 * in this code a 'panel' is any LED panel, matrix, array, etx that can be animated
 * It is assumed that every panel has an array of individually addressable RGB LEDs. 
 * This class handles the page only. The actual driving and updating of LED panels is handled
 * with Node in /node/main.js of this project.
 */
class PlantPage {

  swimUrl = null;
  ledSwimUrl = "warp://192.168.1.68:9001";
  currentPanelId = "left";
  panelWidth = 32;
  panelHeight = 32;
  links = {};
  plantList = {};
  plantListSynced = false;
  plantListLink = null;
  plantDataLink = null;
  plantInfo = null;

  sensorList = [];
  sensorListSynced = false;

  tween = swim.Transition.duration(300);

  mainGauge = null;
  ledGauge = null;
  soilDial = null;
  lightDial = null;
  tempDial = null;

  soilColor = swim.Color.rgb(14, 173, 105);
  lightColor = swim.Color.rgb(255, 210, 63);
  tempColor = swim.Color.rgb(238, 66, 102);

  charts = [];
  plots = [];

  tempImg = new Image();

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

    // const mainElem = document.getElementsByTagName("main")[0];
    // mainElem.appendChild(this.tempImg);

    this.syncPanelToPreview()
  }

  initPage() {
    const gaugePanel = new swim.HtmlAppView(document.getElementById("soilGauge"));
    const canvas = gaugePanel.append("canvas");
    const count = 3;

    // Create a new gauge view
    this.mainGauge = new swim.GaugeView()
      .innerRadius(swim.Length.pct(20))
      .outerRadius(swim.Length.pct(50))
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
      .total(100)
      .value(0) // initialize to zero so the dial will tween in
      .meterColor(this.soilColor)
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.lightDial = new swim.DialView()
      .total(100)
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

    const ledGaugePanel = new swim.HtmlAppView(document.getElementById("ledGauge"));
    const ledcanvas = ledGaugePanel.append("canvas");

    // Create a new gauge view
    this.ledGauge = new swim.GaugeView()
      .innerRadius(swim.Length.pct(30))
      .outerRadius(swim.Length.pct(49))
      .dialColor(swim.Color.rgb(30, 30, 30, 0.1))
      .title(new swim.TextRunView("1"))
      .font("10px \"orbitron\"")
      .textColor("#ccc")
      // .cornerRadius(4)
    // and append it to the canvas.
    
    ledcanvas.append(this.ledGauge);
    this.ledGauge.parentView.node.style.letterSpacing="1px";

    this.ledDial = new swim.DialView()
      .total(100)
      .value(0) // initialize to zero so the dial will tween in
      .meterColor(swim.Color.rgb(0,0,255))
      .label(new swim.TextRunView().textColor("#4a4a4a"));

    this.ledGauge.append(this.ledDial);

    const chartList = ['tempAvg', 'light', 'soil'];

    for (let chartKey of chartList) {
      const chartPanel = new swim.HtmlAppView(document.getElementById(`${chartKey}Chart`));
      const chartCanvas = chartPanel.append("canvas");
  
  
      const clr = "#fff";
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
        .domainColor(clr)
        .tickMarkColor(clr)
        .textColor(clr);

      this.plots[chartKey] = new swim.LineGraphView()
        .strokeWidth(2);

      switch(chartKey) {
        case 'soil':
          this.plots[chartKey].stroke(this.soilColor);
          break;
        case 'light':
          this.plots[chartKey].stroke(this.lightColor);
          break;
        case 'tempAvg':
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
                    const labelValue1 = newValue.stringValue();
                    this.soilDial.label(`${labelValue1}%`);
                    break;
                  case "light":
                    this.lightDial.value(newValue.numberValue(), this.tween);
                    const labelValue2 = newValue.stringValue();
                    this.lightDial.label(`${labelValue2}%`);
                    break;
                  case "tempAvg":
                    this.ledDial.value(newValue.numberValue(), this.tween);
                    this.ledGauge.title(newValue.stringValue());
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

  
  chartToLed() {
    const mainElem = document.getElementsByTagName("main")[0];
    this.tempImg.style.imageRendering = "pixelated"
    this.tempImg.height = this.panelHeight;
    this.tempImg.width = this.panelWidth;
    // mainElem.appendChild(this.tempImg);

    this.tempImg.onload = (() => {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = this.panelWidth;
      tempCanvas.height = this.panelHeight;
      const canvasContext = tempCanvas.getContext("2d");
      canvasContext.drawImage(this.tempImg, 0, 0, this.panelWidth, this.panelHeight);
      // mainElem.appendChild(tempCanvas);
  
      const newFrame = [];
      const pallette = [];
      const canvasWidth = this.tempImg.width;
      const canvasHeight = this.tempImg.height;
      const totalPixels = canvasWidth * canvasHeight;
      let row = -1;
      let rowIndex = 0;
  
      // foreach pixel in frame
      for (let i = 0; i < totalPixels; i++) {
        if (i % canvasWidth == 0) {
          row++;
          rowIndex = 0;
        }
        let x = rowIndex;
        let y = row;
  
        let pixelData = canvasContext.getImageData(x, y, 1, 1).data;
  
        const currColorStr = [pixelData[0], pixelData[1], pixelData[2]].toString();
        if (pallette.indexOf(currColorStr) === -1) {
          pallette.push(currColorStr);
        }
        const colorIndex = pallette.indexOf(currColorStr);
        newFrame.push(colorIndex);
        // console.info(x, y, frame, row);
        rowIndex++;
      }    
      this.pushFrameSizeToPanel();
      this.pushPalletteToPanel(JSON.stringify(pallette));
      this.showLedPixels(newFrame.toString());

    });
    this.tempImg.src = document.getElementsByTagName("canvas")[4].toDataURL();

  }

  

  showLedPixels(pixels) {
    // this.ledPixels = JSON.parse(pixels);

    swim.command(this.ledSwimUrl, `/ledPanel/${this.currentPanelId}`, 'setLedPixelIndexes', pixels);
    // swim.command(this.swimUrl, `/ledPanel/${this.currentPanelId}`, 'setLedCommand', "showPixels");
  }

  stopAnimationOnPanel() {
    swim.command(this.ledSwimUrl, `/ledPanel/${this.currentPanelId}`, 'setLedCommand', 'stop');
  }  

  /**
   * util to push current active pallette to selected panel
   */
  pushPalletteToPanel(pallette) {
    swim.command(this.ledSwimUrl, `/ledPanel/${this.currentPanelId}`, 'setColorPallette', pallette);
  }

  pushFrameSizeToPanel() {
    const size = {
      width: this.panelWidth,
      height: this.panelHeight
    }
    swim.command(this.ledSwimUrl, `/ledPanel/${this.currentPanelId}`, 'setFrameSize', size);
  }  

  syncPanelToPreview() {
      this.stopAnimationOnPanel();
      swim.command(this.ledSwimUrl, `/ledPanel/${this.currentPanelId}`, 'setLedCommand', 'sync');
      this.chartToLed();
      
      setTimeout(() => {
        this.syncPanelToPreview()
      }, 20);
  }  
}
