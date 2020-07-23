#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>

#define DHTTYPE    DHT11     // DHT 11

int soilSensor1Pin = 0;
int lightSensor1Pin = 1;
int tmpSensor1Pin = 2;
int tmpSensor2Pin = 3;
int relayPin = 8;

int soilSensor1Value = 0;
int lightSensor1Value = 0;
float tmpSensor1Value = 0.0;
float tmpSensor2Value = 0.0;
float humidity1 = 0;
float humidity2 = 0;


int airValue = 610;
int waterValue = 275;
int intervals = (airValue - waterValue)/3;

bool lightOn = false;
uint32_t delayMS;

DHT_Unified dht1(tmpSensor1Pin, DHTTYPE);
DHT_Unified dht2(tmpSensor2Pin, DHTTYPE);

void setup() {
  Serial.begin(115200);
  pinMode(relayPin, OUTPUT);
  dht1.begin();
  dht2.begin();

  sensor_t sensor;
  
  // Set delay between sensor readings based on sensor details.
  delayMS = sensor.min_delay / 1000;  
}

float handleTmp36Value(int rawValue) {
  float voltage = rawValue * 5.0;
  voltage /= 1024.0; 

  float temperatureC = (voltage - 0.5) * 100;
  float temperatureF = (temperatureC * 9.0 / 5.0) + 32.0;

  return temperatureF;
}

float interpolate(int startValue, int endValue, int stepNumber, int lastStepNumber) {
  return (endValue - startValue) * stepNumber / lastStepNumber + startValue;
}

void loop() {
  
  if(Serial.available() > 0) {
    String incomingMsg = Serial.readString();
    if(incomingMsg.substring(0) == "lightOn") {
      if(!lightOn) {
        lightOn = true;
        digitalWrite(relayPin, HIGH);
      }
    }
    if(incomingMsg.substring(0) == "lightOff") {
      if(lightOn) {
        lightOn = false;
        digitalWrite(relayPin, LOW);
      }
    }

  }
  soilSensor1Value = analogRead(A0);
  lightSensor1Value = analogRead(lightSensor1Pin);
//  tmpSensor1Value = analogRead(tmpSensor1Pin);
//  tmpSensor2Value = analogRead(tmpSensor2Pin);

//  tmpSensor1Value = handleTmp36Value(tmpSensor1Value);
//  tmpSensor2Value = handleTmp36Value(tmpSensor2Value);

  sensors_event_t event;
  dht1.temperature().getEvent(&event);
  if (isnan(event.temperature)) {
    Serial.println(F("Error reading temperature!"));
  }
  else {
    tmpSensor1Value = event.temperature;
  }
  dht2.temperature().getEvent(&event);
  if (isnan(event.temperature)) {
    Serial.println(F("Error reading temperature!"));
  }
  else {
    tmpSensor2Value = event.temperature;
  }

  dht1.humidity().getEvent(&event);
  if (isnan(event.relative_humidity)) {
    Serial.println(F("Error reading humidity!"));
  }
  else {
    humidity1 = event.relative_humidity;
  }  

  dht2.humidity().getEvent(&event);
  if (isnan(event.relative_humidity)) {
    Serial.println(F("Error reading humidity!"));
  }
  else {
    humidity2 = event.relative_humidity;
  }

  float tempAvg = (tmpSensor1Value+tmpSensor2Value)/2;
  float humidityAvg = (humidity1+humidity2)/2;
  float soilValue = (interpolate(100, 0, (soilSensor1Value-waterValue), (airValue-waterValue)));
  float lightValue = (lightSensor1Value / 10);
  
  String returnString = "{\"soil\": ";
  returnString += soilValue;
  returnString += ",\"light\": ";
  returnString += lightValue;
  returnString += ",\"tempAvg\": ";
  returnString += tempAvg;
  returnString += ",\"temperatureCh1\": ";
  returnString += tmpSensor1Value;
  returnString += ",\"temperatureCh2\": ";
  returnString += tmpSensor2Value;
  returnString += ",\"humidity\": ";
  returnString += humidityAvg;
  returnString += ",\"humidity2\": ";
  returnString += humidity1;
  returnString += ",\"humidity2\": ";
  returnString += humidity2;
  returnString += ",\"lightRaw\": ";
  returnString += lightSensor1Value;
  returnString += ",\"soilRaw\": ";
  returnString += soilSensor1Value;
  returnString += "}";
  Serial.println(returnString);

  delay(1000);
}
