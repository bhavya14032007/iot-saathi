import os
import sys
import re
import logging
from typing import Tuple

import json
from typing import Tuple, Optional, Dict, Any

try:
    from models.prompt_schema import (
        PromptGenerationRequest,
        ChatFollowupRequest,
        ChatFollowupResponse
    )
except ModuleNotFoundError:
    from backend.models.prompt_schema import (
        PromptGenerationRequest,
        ChatFollowupRequest,
        ChatFollowupResponse
    )

logger = logging.getLogger("gemini_service")

SYSTEM_META_PROMPT = """You are a Principal Embedded Firmware Architect and Prompt Engineering Specialist.
Your task is to transform the user's IoT hardware & functional requirements into a hyper-dense, precision-engineered "Master Prompt" that the user can feed into any frontier AI (Gemini, Claude, GPT-4o, DeepSeek) to generate production-grade, bug-free Embedded C++ firmware code.

CRITICAL INSTRUCTIONS:
1. OUTPUT ONLY THE MASTER PROMPT. DO NOT generate the actual C++ code yourself.
2. USE MINIMAL TOKENS. Use compact markdown, precise technical jargon, explicit pin mappings, state machine definitions, and architectural constraints.
3. STRUCTURE OF THE GENERATED MASTER PROMPT:
   - [ROLE & OBJECTIVE]: Expert Embedded C++ Developer for <MCU>
   - [HARDWARE SPECIFICATION]: MCU model, exact GPIO pinouts, I2C/SPI addresses, power constraints
   - [LIBRARIES & DEPENDENCIES]: Recommended lightweight libraries
   - [ARCHITECTURE & CONCURRENCY]: Non-blocking timers (millis()/FreeRTOS tasks), state machine enum, ISR safety
   - [FUNCTIONAL FLOW]: Numbered step-by-step operational logic
   - [EDGE CASES & FAULT TOLERANCE]: Watchdog timer, connection drops, sensor NaN handling, debounce
   - [CODE QUALITY RULES]: Clean C++17/C++20 idioms, const-correctness, zero blocking delay(), memory safety (no heap fragmentation/String misuse).
   - [OUTPUT FORMAT REQUIRED FROM TARGET LLM]: Single compilable .cpp/.ino with clear setup() & loop() or FreeRTOS task declarations.

Output strictly the master prompt text, with no introductory or concluding conversational filler."""

def build_deterministic_prompt(req: PromptGenerationRequest) -> str:
    """Fallback deterministic prompt builder when Gemini API is offline or unconfigured."""
    components_str = ", ".join(req.components) if req.components else "Standard sensor/actuator setup"
    pins_str = req.pin_mapping if req.pin_mapping else "Define clean, designated GPIO pin constants"
    protocol_str = req.communication_protocol if req.communication_protocol else "Local deterministic control / GPIO polling"
    constraints_str = req.special_constraints if req.special_constraints else "Strictly non-blocking logic via millis() or FreeRTOS tasks. No delay()."

    return f"""### 🎯 EMBEDDED C++ MASTER PROMPT FOR LLM

**ROLE & TARGET:**
Act as a Senior Embedded Systems Engineer. Write production-ready, clean, and highly robust C++ firmware for **{req.microcontroller}** using **{req.framework}**.

**PROJECT SCOPE:**
- **Title:** {req.project_title}
- **Target Board:** {req.microcontroller}
- **Key Components:** {components_str}
- **Pin / GPIO Mapping:** {pins_str}
- **Communication Protocol:** {protocol_str}

**FUNCTIONAL LOGIC & BEHAVIOR:**
{req.functional_requirements}

**STRICT EMBEDDED C++ CONSTRAINTS:**
1. **Concurrency & Non-Blocking:** {constraints_str}
2. **Memory Safety:** Avoid heap allocations and dynamic `String` objects to prevent heap fragmentation. Use fixed-size buffers, `snprintf`, and `const char*`.
3. **Fault Tolerance:** Add sensor initialization checks, communication reconnect routines with backoff, and input boundary validation.
4. **Modularity:** Group states using clean `enum class State` and encapsulate device drivers in dedicated helper functions or structs.
5. **Readability:** Use descriptive `constexpr uint8_t` for pin numbers and configuration constants. Include inline documentation for critical register/bit operations.

**OUTPUT REQUIREMENT:**
Provide fully compilable, production-ready Embedded C++ code (.ino / .cpp) with all necessary `#include` directives, configuration constants, setup initialization, and main event loop."""

def estimate_tokens(text: str) -> int:
    """Rough estimation of token count (~4 characters per token)."""
    return max(1, len(text) // 4)

def generate_master_prompt_with_gemini(req: PromptGenerationRequest) -> Tuple[str, int, str]:
    """Generates an optimized Master Prompt using Gemini API with fallback to deterministic builder."""
    api_key = req.api_key or os.getenv("GEMINI_API_KEY")
    
    user_payload_summary = f"""Project: {req.project_title}
Microcontroller: {req.microcontroller}
Framework: {req.framework}
Components: {', '.join(req.components) if req.components else 'None specified'}
Pin Mapping: {req.pin_mapping or 'Suggest optimal pins'}
Protocol: {req.communication_protocol or 'None / Standard GPIO'}
Functional Requirements: {req.functional_requirements}
Constraints: {req.special_constraints or 'Non-blocking, fault-tolerant, memory-safe'}"""

    if not api_key:
        logger.info("No Gemini API key provided. Using deterministic prompt engine.")
        prompt = build_deterministic_prompt(req)
        return prompt, estimate_tokens(prompt), "Deterministic Embedded Prompt Engine (No API key set)"

    # Attempt calling Gemini API via google-genai or google-generativeai
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{SYSTEM_META_PROMPT}\n\n=== USER PROJECT SPECIFICATION ===\n{user_payload_summary}"
        )
        if response and response.text:
            text = response.text.strip()
            return text, estimate_tokens(text), "Google Gemini 2.5 Flash (Ultra-Dense Optimization)"
    except Exception as e:
        logger.warning(f"google-genai client attempt: {e}. Trying google.generativeai fallback...")
        try:
            import google.generativeai as legacy_genai
            legacy_genai.configure(api_key=api_key)
            model = legacy_genai.GenerativeModel("gemini-1.5-flash", system_instruction=SYSTEM_META_PROMPT)
            response = model.generate_content(f"=== USER PROJECT SPECIFICATION ===\n{user_payload_summary}")
            if response and response.text:
                text = response.text.strip()
                return text, estimate_tokens(text), "Google Gemini 1.5 Flash (Legacy SDK)"
        except Exception as e2:
            logger.error(f"Gemini API call failed ({e2}). Falling back to deterministic engine.")

    # Fallback if API calls fail
    prompt = build_deterministic_prompt(req)
    return prompt, estimate_tokens(prompt), "Deterministic Embedded Prompt Engine (API Call Fallback)"


def deterministic_chat_parser(user_msgs: list, state: dict) -> Tuple[dict, Optional[str], bool, Optional[str]]:
    """Deterministic natural language state extractor and single follow-up question generator."""
    state = dict(state or {})
    full_text = " ".join(user_msgs).lower()
    last_msg = user_msgs[-1].lower() if user_msgs else ""
    
    # 1. Title / Objective
    if not state.get("project_title") and user_msgs:
        state["project_title"] = user_msgs[0].strip().capitalize()
        
    # 2. MCU detection
    if not state.get("microcontroller"):
        if "esp32" in full_text:
            state["microcontroller"] = "ESP32 Dev Module (WROOM-32 / S3)"
        elif "esp8266" in full_text or "nodemcu" in full_text:
            state["microcontroller"] = "ESP8266 (NodeMCU v3 / D1 Mini)"
        elif "uno" in full_text:
            state["microcontroller"] = "Arduino Uno (ATmega328P)"
        elif "nano" in full_text:
            state["microcontroller"] = "Arduino Nano (ATmega328P)"
        elif "stm32" in full_text or "blue pill" in full_text:
            state["microcontroller"] = "STM32 Blue Pill (STM32F103C8T6)"
        elif "pico" in full_text or "rp2040" in full_text:
            state["microcontroller"] = "Raspberry Pi Pico (RP2040)"

    # 3. Framework
    if not state.get("framework"):
        if "esp-idf" in full_text:
            state["framework"] = "ESP-IDF C++ (FreeRTOS Native)"
        elif "freertos" in full_text:
            state["framework"] = "FreeRTOS on Arduino C++"
        else:
            state["framework"] = "Arduino C++ (PlatformIO / Arduino IDE)"

    # 4. Components extraction
    components = set(state.get("components") or [])
    comp_keywords = {
        "soil moisture": "Capacitive Soil Moisture Sensor",
        "dht22": "DHT22 Temp & Humidity Sensor",
        "dht11": "DHT11 Temp & Humidity Sensor",
        "ultrasonic": "HC-SR04 Ultrasonic Distance Sensor",
        "relay": "5V Relay Module",
        "pump": "Water Pump Relay",
        "oled": "SSD1306 128x64 I2C OLED Display",
        "lcd": "16x2 I2C LCD Display",
        "servo": "SG90 Micro Servo Motor",
        "motor": "DC Motors & L298N Driver",
        "buzzer": "Active Buzzer",
        "pir": "PIR Motion Sensor",
        "gas": "MQ-2 Gas Sensor",
        "rfid": "RC522 RFID SPI Module"
    }
    for kw, comp_name in comp_keywords.items():
        if kw in full_text:
            components.add(comp_name)
    state["components"] = list(components)

    # 5. Protocol extraction
    if not state.get("communication_protocol"):
        if "mqtt" in full_text:
            state["communication_protocol"] = "WiFi + MQTT Protocol"
        elif "wifi" in full_text or "web server" in full_text or "http" in full_text:
            state["communication_protocol"] = "WiFi + HTTP REST / Web Server"
        elif "ble" in full_text or "bluetooth" in full_text:
            state["communication_protocol"] = "Bluetooth LE (BLE)"
        elif "i2c" in full_text:
            state["communication_protocol"] = "I2C Bus"
        elif "spi" in full_text:
            state["communication_protocol"] = "SPI Bus"

    # 6. Requirements
    if user_msgs:
        state["functional_requirements"] = " • ".join(user_msgs)

    # Question sequencing: Ask missing details
    q_count = max(0, len(user_msgs) - 1)
    
    if not state.get("microcontroller"):
        return state, "Which microcontroller board are you planning to use (e.g., ESP32, Arduino Uno, ESP8266, or STM32)?", False, None
    
    if not state.get("components"):
        return state, "Which sensors or actuators are connected (e.g., Soil Moisture Sensor, Relay Pump, OLED Display, DHT22)?", False, None

    if "control" not in full_text and "automatically" not in full_text and "pump" not in full_text and "relay" not in full_text and q_count < 2:
        return state, f"Great! Should your system automatically control an output (like a relay, pump, or motor) based on sensor readings?", False, None

    if not state.get("communication_protocol") and q_count < 3:
        return state, "Will this project connect over WiFi / MQTT for cloud telemetry, or operate locally/offline?", False, None

    # Ready state reached after enough info collected
    summary = f"{state.get('project_title', 'IoT System')} built on {state.get('microcontroller', 'Embedded MCU')} with {len(state.get('components', []))} component(s)."
    return state, None, True, summary


def process_chat_followup(req: ChatFollowupRequest) -> ChatFollowupResponse:
    """Processes user message history, updates project state, and asks next question or prepares prompt synthesis."""
    user_msgs = [m.content for m in req.messages if m.role == "user"]
    state = req.current_state or {}
    api_key = req.api_key or os.getenv("GEMINI_API_KEY")

    if api_key and req.messages:
        try:
            prompt = f"""You are IoT Saathi, an expert AI embedded system architect.
Analyze the user's project conversation history:
{json.dumps([{"role": m.role, "content": m.content} for m in req.messages], indent=2)}

Current extracted project state:
{json.dumps(state, indent=2)}

Task:
1. Update project_state dictionary with extracted values:
   - project_title
   - microcontroller (e.g. ESP32, ESP8266, Arduino Uno, STM32, Raspberry Pi Pico)
   - framework (e.g. Arduino C++, ESP-IDF C++, FreeRTOS)
   - components (list of strings)
   - pin_mapping
   - communication_protocol
   - functional_requirements
   - special_constraints
2. Determine if enough core project details are collected (Objective, MCU, primary components & basic logic flow).
   - If YES: set ready_for_prompt = true, next_question = null, summary = concise overview.
   - If NO: set ready_for_prompt = false, and ask ONE single friendly follow-up question asking for the next missing technical detail. Never re-ask for details already known!

Output ONLY raw valid JSON:
{{"project_state": {{...}}, "next_question": "...", "ready_for_prompt": false, "summary": "..."}}"""

            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if response and response.text:
                cleaned = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                data = json.loads(cleaned)
                return ChatFollowupResponse(
                    success=True,
                    next_question=data.get("next_question"),
                    ready_for_prompt=data.get("ready_for_prompt", False),
                    questions_answered_count=max(0, len(user_msgs) - 1),
                    project_state=data.get("project_state", state),
                    summary=data.get("summary")
                )
        except Exception as e:
            logger.warning(f"Gemini chat followup failed ({e}), using deterministic fallback.")

    # Fallback execution
    updated_state, next_q, is_ready, summary = deterministic_chat_parser(user_msgs, state)
    return ChatFollowupResponse(
        success=True,
        next_question=next_q,
        ready_for_prompt=is_ready,
        questions_answered_count=max(0, len(user_msgs) - 1),
        project_state=updated_state,
        summary=summary
    )

