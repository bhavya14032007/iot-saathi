/**
 * IoT Saathi - Master Prompt Generator Engine Client
 * Communicates with FastAPI backend for minimal-token Embedded C++ prompt generation.
 */

// API Base URL resolution: supports localhost, custom Render URL, or relative /api proxy
const API_BASE_URL = (() => {
    if (window.IOT_SAATHI_API_URL) return window.IOT_SAATHI_API_URL;
    if (localStorage.getItem('iot_saathi_api_url')) return localStorage.getItem('iot_saathi_api_url');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000/api';
    }
    return '/api';
})();

// State
let availableTemplates = [];
let selectedComponents = new Set();

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupComponentTagListeners();
    setupFormSubmission();
    setupCopyButton();
    await checkBackendHealth();
    await loadTemplates();
}

/**
 * Health check to verify backend connection and Gemini configuration
 */
async function checkBackendHealth() {
    const statusText = document.getElementById('engine-status-text');
    const statusDot = document.getElementById('engine-status-dot');

    try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) {
            const data = await res.json();
            if (statusText && statusDot) {
                statusText.textContent = data.gemini_api_configured 
                    ? `Backend Connected • ${data.mode}` 
                    : `Backend Connected • Deterministic High-Yield Mode`;
                statusDot.style.backgroundColor = 'var(--color-success)';
            }
        }
    } catch (err) {
        console.warn('Backend server offline or unreachable. Offline synthesis will be used.', err);
        if (statusText && statusDot) {
            statusText.textContent = 'Backend Offline (Click run.py in backend to enable Gemini)';
            statusDot.style.backgroundColor = 'var(--color-accent)';
        }
    }
}

/**
 * Fetch and populate templates
 */
async function loadTemplates() {
    const templatesList = document.getElementById('templates-list');
    if (!templatesList) return;

    try {
        const res = await fetch(`${API_BASE_URL}/templates`);
        if (res.ok) {
            availableTemplates = await res.json();
        }
    } catch (err) {
        // Fallback default templates if backend is starting
        availableTemplates = [
            {
                id: 'esp32-weather',
                title: 'ESP32 MQTT Weather Station',
                microcontroller: 'ESP32 Dev Module',
                framework: 'Arduino C++ (PlatformIO / Arduino IDE)',
                components: ['DHT22 (Temp & Humidity)', 'BMP280 (Pressure)', 'SSD1306 OLED', 'Status LED'],
                pin_mapping: 'DHT22 Data -> GPIO 4 | OLED/BMP280 I2C -> SDA (21), SCL (22) | LED -> GPIO 2',
                communication_protocol: 'WiFi + MQTT (PubSubClient) to Adafruit IO',
                functional_requirements: 'Sample environmental sensors every 15s. Display values on OLED. Publish JSON payload to MQTT topic. Reconnect with exponential backoff on drop.',
                special_constraints: 'Zero blocking delay() calls. Use millis() timers. Include watchdog timer and I2C error recovery.'
            },
            {
                id: 'obstacle-robot',
                title: 'Arduino Obstacle Avoidance Robot',
                microcontroller: 'Arduino Uno (ATmega328P)',
                framework: 'Arduino C++',
                components: ['HC-SR04 Ultrasonic Sensor', 'SG90 Micro Servo', 'L298N Motor Driver', '2x DC Motors', 'Buzzer'],
                pin_mapping: 'HC-SR04 -> Trig 9, Echo 10 | Servo -> Pin 6 | L298N -> IN1-IN4 (4,5,7,8), ENA(3), ENB(11) | Buzzer -> Pin 12',
                communication_protocol: 'Autonomous Local Control',
                functional_requirements: 'Drive forward continuously. If obstacle < 25cm, stop motors, scan 45 deg left and 135 deg right with servo, turn toward clearest direction, resume forward motion.',
                special_constraints: 'State machine architecture with enum RobotState. Non-blocking sensor pulses.'
            },
            {
                id: 'esp8266-home',
                title: 'ESP8266 4-Ch Smart Relay Web Server',
                microcontroller: 'ESP8266 (NodeMCU)',
                framework: 'Arduino C++ (ESP8266WebServer)',
                components: ['4-Channel 5V Relay Module', 'DHT11 Sensor', '4x Push Buttons', 'Status LED'],
                pin_mapping: 'Relays -> D1, D2, D5, D6 | DHT11 -> D7 | Buttons -> D3, D8, D0, RX',
                communication_protocol: 'WiFi 802.11 b/g/n + Web Server UI & REST API',
                functional_requirements: 'Host responsive HTML dashboard with appliance toggle buttons. Allow manual physical push button toggles with debounce. Persist states in LittleFS.',
                special_constraints: 'Non-blocking 50ms software debounce. REST API endpoints /api/status and /api/relay.'
            }
        ];
    }

    templatesList.innerHTML = '';
    availableTemplates.forEach(t => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'template-chip';
        chip.textContent = t.title;
        chip.addEventListener('click', () => applyTemplate(t));
        templatesList.appendChild(chip);
    });
}

/**
 * Apply a selected template into form fields
 */
function applyTemplate(template) {
    document.getElementById('project-title').value = template.title;
    document.getElementById('microcontroller').value = template.microcontroller;
    document.getElementById('framework').value = template.framework;
    document.getElementById('pin-mapping').value = template.pin_mapping;
    document.getElementById('protocol').value = template.communication_protocol;
    document.getElementById('requirements').value = template.functional_requirements;
    document.getElementById('constraints').value = template.special_constraints;

    // Reset and select component tags
    selectedComponents.clear();
    document.querySelectorAll('.tag-badge').forEach(tag => {
        const name = tag.dataset.name;
        if (template.components.some(c => c.toLowerCase().includes(name.toLowerCase()))) {
            tag.classList.add('selected');
            selectedComponents.add(name);
        } else {
            tag.classList.remove('selected');
        }
    });

    updateCustomComponentsInput();
}

/**
 * Component tag toggling
 */
function setupComponentTagListeners() {
    document.querySelectorAll('.tag-badge').forEach(tag => {
        tag.addEventListener('click', () => {
            const name = tag.dataset.name;
            if (selectedComponents.has(name)) {
                selectedComponents.delete(name);
                tag.classList.remove('selected');
            } else {
                selectedComponents.add(name);
                tag.classList.add('selected');
            }
            updateCustomComponentsInput();
        });
    });
}

function updateCustomComponentsInput() {
    const input = document.getElementById('custom-components');
    if (input) {
        input.value = Array.from(selectedComponents).join(', ');
    }
}

/**
 * Form Submission & API Trigger
 */
function setupFormSubmission() {
    const form = document.getElementById('prompt-generator-form');
    const submitBtn = document.getElementById('btn-generate');
    const terminal = document.getElementById('prompt-terminal');
    const tokenBadge = document.getElementById('token-count-badge');
    const engineBadge = document.getElementById('engine-badge');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('project-title').value.trim();
        const mcu = document.getElementById('microcontroller').value;
        const framework = document.getElementById('framework').value;
        const pins = document.getElementById('pin-mapping').value.trim();
        const protocol = document.getElementById('protocol').value.trim();
        const requirements = document.getElementById('requirements').value.trim();
        const constraints = document.getElementById('constraints').value.trim();
        const apiKey = document.getElementById('custom-api-key')?.value.trim();

        // Collect components from input and tags
        const customCompText = document.getElementById('custom-components').value.trim();
        const components = customCompText ? customCompText.split(',').map(s => s.trim()).filter(Boolean) : Array.from(selectedComponents);

        if (!title || !requirements) {
            alert('Please provide a project title and functional logic requirements.');
            return;
        }

        // Loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⚡ Engineering Master Prompt...';
        terminal.classList.remove('empty-state');
        terminal.textContent = 'Synthesizing concise Embedded C++ Master Prompt with Gemini optimization...';

        const payload = {
            project_title: title,
            microcontroller: mcu,
            framework: framework,
            components: components,
            pin_mapping: pins,
            communication_protocol: protocol,
            functional_requirements: requirements,
            special_constraints: constraints,
            api_key: apiKey || null
        };

        try {
            const res = await fetch(`${API_BASE_URL}/generate-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error(`Server returned HTTP ${res.status}`);
            }

            const data = await res.json();
            terminal.textContent = data.master_prompt;
            tokenBadge.textContent = `~${data.tokens_estimated} tokens`;
            engineBadge.textContent = data.engine_used;

        } catch (err) {
            console.warn('Backend API request failed, executing client-side deterministic synthesis:', err);
            
            // Client-side fallback generation
            const fallbackPrompt = generateClientSidePrompt(payload);
            terminal.textContent = fallbackPrompt;
            tokenBadge.textContent = `~${Math.round(fallbackPrompt.length / 4)} tokens`;
            engineBadge.textContent = 'Deterministic Client Synthesizer (Backend Offline)';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '⚡ Generate Master Prompt';
            document.getElementById('output-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

/**
 * Client-side deterministic prompt synthesizer fallback
 */
function generateClientSidePrompt(p) {
    const compStr = p.components.length > 0 ? p.components.join(', ') : 'Standard GPIO & Sensors';
    const pinStr = p.pin_mapping || 'Assign optimal, conflict-free hardware GPIO pins';
    const protoStr = p.communication_protocol || 'Local event loop / GPIO';
    const constrStr = p.special_constraints || 'Strictly non-blocking via millis() / FreeRTOS. Zero delay().';

    return `### 🎯 EMBEDDED C++ MASTER PROMPT FOR LLM

**ROLE & TARGET:**
Act as a Principal Embedded Systems Engineer. Write clean, memory-safe, and production-grade C++ firmware for **${p.microcontroller}** using **${p.framework}**.

**PROJECT OVERVIEW:**
- **Project Title:** ${p.project_title}
- **Microcontroller:** ${p.microcontroller}
- **Target Framework:** ${p.framework}
- **Hardware Peripherals:** ${compStr}
- **Pin / GPIO Mapping:** ${pinStr}
- **Communication Stack:** ${protoStr}

**OPERATIONAL LOGIC & REQUIREMENTS:**
${p.functional_requirements}

**STRICT EMBEDDED C++ CONSTRAINTS:**
1. **Concurrency:** ${constrStr}
2. **Memory Safety:** Strictly avoid dynamic heap allocation (\`String\` objects). Use fixed-size buffers (\`snprintf\`), \`const char*\`, and stack variables to prevent heap fragmentation.
3. **Fault Tolerance:** Add sensor initialization sanity checks, communication reconnect routines with exponential backoff, and watchdog support if applicable.
4. **State Machine:** Implement explicit states via \`enum class SystemState\` and keep drivers modular.
5. **Pin Constants:** Declare pins with \`constexpr uint8_t\` and inline hardware documentation.

**REQUIRED OUTPUT FROM TARGET LLM:**
Provide the complete, compilable Embedded C++ code (.ino / .cpp) with all necessary library \`#include\` directives, hardware constants, setup initialization, and main event loop.`;
}

/**
 * Copy to clipboard with visual feedback
 */
function setupCopyButton() {
    const copyBtn = document.getElementById('btn-copy-prompt');
    const terminal = document.getElementById('prompt-terminal');

    if (!copyBtn || !terminal) return;

    copyBtn.addEventListener('click', async () => {
        const text = terminal.textContent;
        if (!text || terminal.classList.contains('empty-state')) {
            alert('Please generate a master prompt first!');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            const originalText = copyBtn.innerHTML;
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '✓ Copied to Clipboard!';
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = originalText;
            }, 2500);
        } catch (err) {
            console.error('Failed to copy: ', err);
            // Fallback selection
            const range = document.createRange();
            range.selectNodeContents(terminal);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('copy');
            alert('Master Prompt copied to clipboard!');
        }
    });
}
