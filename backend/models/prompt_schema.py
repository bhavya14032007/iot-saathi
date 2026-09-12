# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import List, Optional

class PromptGenerationRequest(BaseModel):
    project_title: str = Field(..., description="Short title or objective of the IoT project")
    microcontroller: str = Field(..., description="Target microcontroller (e.g. ESP32, ESP8266, Arduino Uno, STM32, Raspberry Pi Pico)")
    framework: str = Field(default="Arduino C++ (PlatformIO / Arduino IDE)", description="Embedded C++ framework/SDK (e.g. Arduino C++, ESP-IDF C++, FreeRTOS)")
    components: List[str] = Field(default_factory=list, description="List of sensors, actuators, and hardware modules")
    pin_mapping: Optional[str] = Field(None, description="Specific pin connections or GPIO assignments")
    communication_protocol: Optional[str] = Field(None, description="Protocols (e.g. WiFi, MQTT, BLE, HTTP, I2C, SPI, LoRa)")
    functional_requirements: str = Field(..., description="What the system should do (logic, state machine, sensor thresholds, timing, sleep modes)")
    special_constraints: Optional[str] = Field(None, description="Non-blocking code (millis/FreeRTOS), watchdog timer, low-power sleep, error handling")
    api_key: Optional[str] = Field(None, description="Optional user-supplied Gemini API key overriding server default")

class PromptGenerationResponse(BaseModel):
    success: bool
    master_prompt: str
    tokens_estimated: int
    engine_used: str
    target_board: str
    framework: str
    system_architecture_summary: str
    suggested_llms: List[str] = [
        "Gemini 1.5 Pro / 2.0 Flash",
        "Claude 3.5 Sonnet",
        "GPT-4o",
        "DeepSeek-R1 / Coder"
    ]

class ProjectTemplate(BaseModel):
    id: str
    title: str
    category: str
    microcontroller: str
    framework: str
    components: List[str]
    pin_mapping: str
    communication_protocol: str
    functional_requirements: str
    special_constraints: str
