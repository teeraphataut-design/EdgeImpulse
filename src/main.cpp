#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <MPU6050_light.h>

// --- Configuration ---
char WIFI_SSID[] = "Wokwi-GUEST";
char WIFI_PASSWORD[] = "";      
const char* token = "P6MOn9W43XjOraUTUOdw"; // ThingsBoard device access token
const char* thingsboard_server = "thingsboard.cloud"; // <-- Replace with your ThingsBoard server address
// if DNS fail use demo.thingsboard.io[104.196.24.70] | thingsboard.cloud[44.194.165.190] | eu.thingsboard.cloud[3.69.110.78]
// or try ping <domain name> to get IP address from CMD

const int port = 1883;

const char STUDENT_ID[]      = "68069710";
const char FIRMWARE_VERSION[] = "1.0"; 

// --- Hardware Pins (from diagram.json — ESP32-S3) ---
#define pinLED 4       // LED cathode → GPIO 4 (active-LOW: sink to turn ON)
#define LED_ON  LOW    // LED wired 3V3 → R → Anode → Cathode → GPIO: LOW = ON
#define LED_OFF HIGH

bool ledState = false;  // current LED state (true = ON), reported as "led_state" attribute

#define pinSDA 8       // MPU6050 SDA → GPIO 8 (10kΩ pull-up to 3V3)
#define pinSCL 9       // MPU6050 SCL → GPIO 9 (10kΩ pull-up to 3V3)

// --- MPU6050 Configuration ---
#define NUM_MPUS 1
MPU6050 mpu[NUM_MPUS] = { MPU6050(Wire) };
const int AD0pin[NUM_MPUS] = {5};   // AD0 → GPIO 5

// --- Peripheral Objects ---
WiFiClient espClient;
PubSubClient client(espClient);

// --- Timing ---
unsigned long lastMPUPrintTime = 0;
const unsigned long MPUPrintInterval = 1000;

unsigned long lastMPUPublishTime = 0;
const unsigned long MPUPublishInterval = 1000;

// --- WiFi / MQTT non-blocking reconnect state ---
unsigned long lastWiFiRetry = 0;
const unsigned long wifiRetryInterval = 500;

unsigned long lastMQTTRetry = 0;
const unsigned long mqttRetryInterval = 5000;

// --- Prototypes ---
void onMessage(char* topic, byte* payload, unsigned int length);
void connectToWiFi();
void connectToMQTTBroker();
void setupMPU();
void updateMPU();
void readMPU();
void SelectMPU(int selection);
void publishMPUTelemetry();
void publishAttributes();

// ====================================================================
//  setup()
// ====================================================================
void setup() {
  Serial.begin(115200);  // ESP32-S3 convention; matches boot ROM baud rate
  pinMode(pinLED, OUTPUT);
  digitalWrite(pinLED, LED_OFF);

  // --- Initialize I2C and MPU6050 ---
  setupMPU();

  // --- WiFi (non-blocking initial connect) ---
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  // Allow up to ~10s for initial connect, then fall through to loop()
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 10000) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Connected to WiFi");
  } else {
    Serial.println("\n⚠️ WiFi not connected yet — will retry in loop()");
  }

  client.setServer(thingsboard_server, port);
  client.setBufferSize(512);  // headroom for 10-field MPU JSON + MQTT framing
  // *** set Callback receive from Server ***
  client.setCallback(onMessage);
}

// ====================================================================
//  loop()
// ====================================================================
void loop() {
  // --- Non-blocking WiFi reconnect ---
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
    return;  // skip MQTT/telemetry until WiFi is up
  }

  // --- Non-blocking MQTT reconnect ---
  if (!client.connected()) {
    connectToMQTTBroker();
    return;  // skip telemetry until MQTT is up
  }
  client.loop();

  // Keep MPU complementary filter running every iteration
  updateMPU();

  // Serial debug output (gated by MPUPrintInterval)
  readMPU();

  // Publish to ThingsBoard (gated by MPUPublishInterval)
  publishMPUTelemetry();
}

// ====================================================================
//  MPU6050 Functions
// ====================================================================

// Initialize I2C on diagram-specified pins and set up all MPU6050 sensors.
void setupMPU() {
  Wire.begin(pinSDA, pinSCL);
  Wire.setTimeOut(1000);  // guard against a wedged I2C bus (avoids interrupt-WDT panic)

  for (int i = 0; i < NUM_MPUS; i++) {
    pinMode(AD0pin[i], OUTPUT);
    digitalWrite(AD0pin[i], HIGH);  // default HIGH → address 0x69 (deselected)
  }

  Serial.println(F("Initializing MPU-6050 sensors. Do not move the sensor."));
  delay(500);

  for (int i = 0; i < NUM_MPUS; i++) {
    SelectMPU(i);

    byte status = mpu[i].begin();
    Serial.print(F("Initializing MPU-6050 "));
    Serial.print(i);
    Serial.print(F(", error = "));
    Serial.print(status);
    if (status == 0)
      Serial.print(F(" (no error)"));
    Serial.println();

    // calcOffsets() runs a tight 500-iteration I2C polling loop that hangs
    // Wokwi's simulated I2C bus and trips the interrupt watchdog — skip it
    // here; offsets default to 0 (set in the MPU6050 constructor).
  }

  Serial.println(F("MPU-6050 initialization done"));
  Serial.println(F("Click on a MPU-6050 module and change the acceleration and gyro."));

  lastMPUPrintTime = millis();
  lastMPUPublishTime = millis();
}

// Call every loop() iteration to keep the complementary filter updated.
void updateMPU() {
  for (int i = 0; i < NUM_MPUS; i++) {
    SelectMPU(i);
    mpu[i].update();
  }
}

// Print detailed sensor readings to Serial (non-blocking, interval-gated).
void readMPU() {
  if (millis() - lastMPUPrintTime < MPUPrintInterval) return;
  lastMPUPrintTime = millis();

  for (int i = 0; i < NUM_MPUS; i++) {
    SelectMPU(i);

    Serial.print(i);
    Serial.print(":");
    Serial.print(F("T="));
    Serial.print(mpu[i].getTemp(), 0);
    Serial.print(F(",ACC="));
    Serial.print(mpu[i].getAccX());
    Serial.print(",");
    Serial.print(mpu[i].getAccY());
    Serial.print(",");
    Serial.print(mpu[i].getAccZ());

    Serial.print(F(",GYRO="));
    Serial.print(mpu[i].getGyroX(), 0);
    Serial.print(",");
    Serial.print(mpu[i].getGyroY(), 0);
    Serial.print(",");
    Serial.print(mpu[i].getGyroZ(), 0);

    Serial.print(F(",ACC ANGLE="));
    Serial.print(mpu[i].getAccAngleX(), 0);
    Serial.print(",");
    Serial.print(mpu[i].getAccAngleY(), 0);

    Serial.print(F(",ANGLE="));
    Serial.print(mpu[i].getAngleX(), 0);
    Serial.print(",");
    Serial.print(mpu[i].getAngleY(), 0);
    Serial.print(",");
    Serial.print(mpu[i].getAngleZ(), 0);
    Serial.println();
  }
  Serial.println(F("======================================================================================\n"));
}

// Choose a MPU by index — drives AD0 LOW on the selected sensor (address 0x68),
// HIGH on all others (address 0x69).
void SelectMPU(int selection) {
  for (int i = 0; i < NUM_MPUS; i++) {
    if (i == selection)
      digitalWrite(AD0pin[i], LOW);   // selected → 0x68
    else
      digitalWrite(AD0pin[i], HIGH);  // not selected → 0x69
  }
}

// ====================================================================
//  ThingsBoard Telemetry — MPU6050
// ====================================================================

// Publish MPU6050 telemetry to ThingsBoard (independent timer from serial debug).
void publishMPUTelemetry() {
  if (millis() - lastMPUPublishTime < MPUPublishInterval) return;
  lastMPUPublishTime = millis();

  for (int i = 0; i < NUM_MPUS; i++) {
    SelectMPU(i);

    JsonDocument doc;
    doc["mpu_temp"]    = mpu[i].getTemp();
    doc["acc_x"]       = mpu[i].getAccX();
    doc["acc_y"]       = mpu[i].getAccY();
    doc["acc_z"]       = mpu[i].getAccZ();
    doc["gyro_x"]      = mpu[i].getGyroX();
    doc["gyro_y"]      = mpu[i].getGyroY();
    doc["gyro_z"]      = mpu[i].getGyroZ();
    doc["angle_x"]     = mpu[i].getAngleX();
    doc["angle_y"]     = mpu[i].getAngleY();
    doc["angle_z"]     = mpu[i].getAngleZ();

    char payload[256];
    size_t len = serializeJson(doc, payload, sizeof(payload));
    if (len > 0) {
      client.publish("v1/devices/me/telemetry", payload);
      Serial.print(F("📨 MPU Sent: "));
      Serial.println(payload);
    }
  }
}

// ====================================================================
//  RPC Callback Function
// ====================================================================
// this function active when Postman/ThingsBoard send API
void onMessage(char* topic, byte* payload, unsigned int length) {
  Serial.print(F("📩 Message arrived ["));
  Serial.print(topic);
  Serial.println("]");

  // Build response topic by replacing "request" with "response".
  // Copy it first: `topic` points into PubSubClient's shared buffer,
  // which any client.publish() call overwrites.
  char responseTopic[128];
  strncpy(responseTopic, topic, sizeof(responseTopic) - 1);
  responseTopic[sizeof(responseTopic) - 1] = '\0';
  char* reqPtr = strstr(responseTopic, "request");
  if (reqPtr) {
    // In-place replace: "request" (7 chars) → "response" (8 chars)
    // Shift tail right by 1 to make room
    size_t tailLen = strlen(reqPtr + 7);
    memmove(reqPtr + 8, reqPtr + 7, tailLen + 1);
    memcpy(reqPtr, "response", 8);
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.print(F("❌ JSON parse error: "));
    Serial.println(err.c_str());
    return;
  }

  const char* methodName = doc["method"];  // "setLed"
  bool params = doc["params"];             // true or false

  bool handled = false;
  if (methodName && strcmp(methodName, "setLed") == 0) {
    handled = true;
    ledState = params;
    digitalWrite(pinLED, ledState ? LED_ON : LED_OFF);
    Serial.print(F("💡 LED Status: "));
    Serial.println(ledState ? "ON" : "OFF");
  }

  // send Response back (Two-way RPC)
  JsonDocument resp;
  resp["success"] = handled;
  if (handled) resp["led_state"] = ledState;
  char respPayload[64];
  serializeJson(resp, respPayload, sizeof(respPayload));
  client.publish(responseTopic, respPayload);

  // Publish attributes only after the response — it reuses the MQTT buffer
  if (handled) publishAttributes();  // report new LED state to ThingsBoard
}

// ====================================================================
//  Non-blocking WiFi Reconnect
// ====================================================================
void connectToWiFi() {
  if (millis() - lastWiFiRetry < wifiRetryInterval) return;
  lastWiFiRetry = millis();

  Serial.print(".");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Connected to WiFi");
  }
}

// ====================================================================
//  Non-blocking MQTT Connection
// ====================================================================
void connectToMQTTBroker() {
  if (millis() - lastMQTTRetry < mqttRetryInterval) return;
  lastMQTTRetry = millis();

  Serial.println(F("☁️ Connecting to ThingsBoard..."));
  if (client.connect("ESP32_Client", token, NULL)) {
    Serial.println(F("✅ Connected"));
    // *** Subscribe topic receive RPC ***
    client.subscribe("v1/devices/me/rpc/request/+");
    publishAttributes();
  } else {
    Serial.print(F("❌ MQTT connect failed, rc="));
    Serial.println(client.state());
  }
}

// ====================================================================
//  ThingsBoard Attributes
// ====================================================================
void publishAttributes() {
  JsonDocument doc;
  doc["student_id"] = STUDENT_ID;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["led_state"] = ledState;

  char payload[128];
  size_t len = serializeJson(doc, payload, sizeof(payload));

  if (len > 0 && client.publish("v1/devices/me/attributes", payload)) {
    Serial.print(F("📨 Attributes sent: "));
    Serial.println(payload);
  } else {
    Serial.println(F("❌ Attributes publish failed"));
  }
}
