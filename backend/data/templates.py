from typing import List
from models.prompt_schema import ProjectTemplate

TEMPLATES: List[ProjectTemplate] = [
    ProjectTemplate(
        id="esp32-mqtt-weather",
        title="ESP32 IoT Weather Station (MQTT & OLED)",
        category="Environmental Monitoring",
        microcontroller="ESP32 Dev Module (WROOM-32)",
        framework="Arduino C++ (PlatformIO / Arduino IDE)",
        components=["DHT22 (Temp & Humidity)", "BMP280 (Pressure)", "SSD1306 I2C OLED (0.96 inch)", "Status LED"],
        pin_mapping="DHT22 Data -> GPIO 4, BMP280/OLED I2C -> SDA (GPIO 21) & SCL (GPIO 22), Status LED -> GPIO 2",
        communication_protocol="WiFi + MQTT (PubSubClient) to Adafruit IO / EMQX Broker",
        functional_requirements="Sample environmental telemetry every 15 seconds. Display current Temp, Humidity & Pressure on 128x64 OLED. Publish JSON payload to MQTT topic 'home/weather/telemetry'. Reconnect automatically to WiFi and MQTT with exponential backoff.",
        special_constraints="Strictly non-blocking logic using millis() timers (no delay()). Include modular C++ structs and error handling for sensor I2C communication failures."
    ),
    ProjectTemplate(
        id="arduino-obstacle-rover",
        title="Obstacle Avoidance Robot with Ultrasonic Radar",
        category="Robotics",
        microcontroller="Arduino Uno (ATmega328P)",
        framework="Arduino C++",
        components=["HC-SR04 Ultrasonic Sensor", "SG90 Micro Servo", "L298N Motor Driver", "2x DC Gear Motors", "Active Buzzer"],
        pin_mapping="HC-SR04 -> Trig Pin 9, Echo Pin 10 | Servo -> Pin 6 | L298N -> IN1(4), IN2(5), IN3(7), IN4(8), ENA(3 PWM), ENB(11 PWM) | Buzzer -> Pin 12",
        communication_protocol="None (Autonomous Local Control)",
        functional_requirements="Continuous forward drive at medium speed. If obstacle detected within 25cm, stop motors, trigger buzzer chirp, rotate servo left (45 deg) and right (135 deg) to measure distance, decide clearest path, turn robot, and resume navigation.",
        special_constraints="Non-blocking state machine design (enum RobotState { FORWARD, SCANNING, TURNING, STOPPED }). Smooth PWM speed ramping to prevent voltage spikes."
    ),
    ProjectTemplate(
        id="esp8266-smart-home",
        title="ESP8266 4-Channel Home Automation & Web Server",
        category="Smart Home",
        microcontroller="ESP8266 (NodeMCU v3 / ESP-12E)",
        framework="Arduino C++ (ESP8266WebServer)",
        components=["4-Channel 5V Relay Module (Active Low)", "DHT11 Sensor", "4x Manual Push Buttons", "Status LED"],
        pin_mapping="Relays -> D1 (GPIO 5), D2 (GPIO 4), D5 (GPIO 14), D6 (GPIO 12) | DHT11 -> D7 (GPIO 13) | Push Buttons -> D3, D8, D0, RX with internal pullups",
        communication_protocol="WiFi 802.11 b/g/n + Async Web Server / REST API",
        functional_requirements="Host local responsive web dashboard with toggle buttons for each appliance and live temperature/humidity readout. Support manual toggle via physical push buttons with hardware debounce. Persist relay states in EEPROM/LittleFS across reboots.",
        special_constraints="Zero delay() calls. Use interrupt or timer-based button debounce (50ms). Provide JSON REST API endpoints (/api/status, /api/relay/toggle?id=1)."
    ),
    ProjectTemplate(
        id="smart-irrigation-soil",
        title="Automated Smart Irrigation with Soil & Rain Detection",
        category="Smart Agriculture",
        microcontroller="Arduino Nano / Uno",
        framework="Arduino C++",
        components=["Capacitive Soil Moisture Sensor v1.2", "Rain Drop Sensor (Digital & Analog)", "5V Relay (Submersible Pump)", "16x2 I2C LCD", "Piezo Buzzer"],
        pin_mapping="Soil Sensor -> A0 | Rain Sensor -> A1 (Analog) & D2 (Digital) | Relay -> D7 | LCD -> I2C (A4 SDA, A5 SCL) | Buzzer -> D8",
        communication_protocol="I2C",
        functional_requirements="Monitor soil moisture levels every 5 seconds. If soil moisture drops below 35% AND no active rain is detected, energize water pump relay for 10 seconds or until moisture reaches 65%. Display live status on LCD screen.",
        special_constraints="Prevent pump dry-run with max continuous run timeout (60s). Calibrate analog thresholds for dry vs wet soil."
    ),
    ProjectTemplate(
        id="esp32-rfid-access",
        title="ESP32 Biometric/RFID Smart Door Lock & Cloud Logging",
        category="Security & Access Control",
        microcontroller="ESP32 Dev Module",
        framework="Arduino C++ / FreeRTOS",
        components=["RC522 RFID Reader (SPI)", "SG90 Servo (Lock Latch)", "Red/Green Dual LEDs", "Active Buzzer", "128x32 OLED"],
        pin_mapping="RC522 -> SS(GPIO 5), RST(GPIO 22), SCK(GPIO 18), MOSI(GPIO 23), MISO(GPIO 19) | Servo -> GPIO 13 | Green LED -> GPIO 12 | Red LED -> GPIO 14 | Buzzer -> GPIO 27",
        communication_protocol="SPI (RFID) + WiFi HTTPS Webhook (Google Sheets / Telegram Alert)",
        functional_requirements="Scan RFID keycards against authorized UID list stored in flash. On valid card: unlock servo latch (90 deg), flash Green LED, emit single beep, post event to Cloud Webhook. On invalid card: flash Red LED, sound 3 alarm beeps, log unauthorized attempt. Auto-lock latch after 5 seconds.",
        special_constraints="Use FreeRTOS tasks (TaskRFID, TaskNetworkNotifier). Non-blocking servo sweep and non-blocking HTTPS client."
    )
]
