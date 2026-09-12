import os
import sys
import re
import logging
from typing import Tuple

try:
    from models.prompt_schema import PromptGenerationRequest
except ModuleNotFoundError:
    from backend.models.prompt_schema import PromptGenerationRequest

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
