/**
 * IoT Saathi - Conversational AI Master Prompt Engine Client
 * Interactive ChatGPT/Gemini style conversational flow for Embedded C++ Master Prompt Generation.
 */

// API Base URL resolution: localhost for local dev, Render backend for production
const API_BASE_URL = (() => {
    if (window.IOT_SAATHI_API_URL) return window.IOT_SAATHI_API_URL;
    if (localStorage.getItem('iot_saathi_api_url')) return localStorage.getItem('iot_saathi_api_url');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://127.0.0.1:8000/api';
    }
    return 'https://iot-saathi-api.onrender.com/api';
})();

// Application State
let conversationState = {
    project_title: '',
    microcontroller: '',
    framework: 'Arduino C++ (PlatformIO / Arduino IDE)',
    components: [],
    pin_mapping: '',
    communication_protocol: '',
    functional_requirements: '',
    special_constraints: ''
};

let chatHistory = [];
let questionsAnsweredCount = 0;
let isBackendAvailable = false;
let availableTemplates = [];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupInputListeners();
    setupQuickStarters();
    setupDrawerAndActions();
    await checkBackendHealth();
    await fetchTemplates();
}

/**
 * Health check for backend connectivity and Gemini status
 */
async function checkBackendHealth() {
    const statusText = document.getElementById('engine-status-text');
    const statusDot = document.getElementById('engine-status-dot');

    try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) {
            const data = await res.json();
            isBackendAvailable = true;
            if (statusText && statusDot) {
                statusText.textContent = data.gemini_api_configured 
                    ? `IoT Saathi Engine • ${data.mode}` 
                    : `IoT Saathi Engine • Deterministic Synthesis`;
                statusDot.style.backgroundColor = 'var(--color-success)';
            }
        }
    } catch (err) {
        console.warn('Backend server offline or starting up. Standalone client synthesis active.', err);
        isBackendAvailable = false;
        if (statusText && statusDot) {
            statusText.textContent = 'Backend Offline (Using Standalone Client AI Synthesizer)';
            statusDot.style.backgroundColor = 'var(--color-accent)';
        }
    }
}

/**
 * Fetch blueprints templates
 */
async function fetchTemplates() {
    try {
        const res = await fetch(`${API_BASE_URL}/templates`);
        if (res.ok) {
            availableTemplates = await res.json();
        }
    } catch (err) {
        // Default blueprint templates fallback
        availableTemplates = [
            {
                id: 'esp32-mqtt-weather',
                title: 'ESP32 MQTT Weather Station',
                microcontroller: 'ESP32 Dev Module',
                components: ['DHT22 (Temp & Humidity)', 'BMP280 (Pressure)', 'SSD1306 OLED'],
                functional_requirements: 'Read sensors every 15s, display metrics on OLED, publish JSON telemetry to MQTT.'
            },
            {
                id: 'smart-irrigation-soil',
                title: 'Smart Irrigation with Soil Moisture & Rain Sensor',
                microcontroller: 'Arduino Nano',
                components: ['Soil Moisture Sensor', 'Rain Sensor', '5V Relay Pump', '16x2 I2C LCD'],
                functional_requirements: 'Sample soil moisture every 5s. If moisture < 35% and no rain, energize pump relay.'
            },
            {
                id: 'esp8266-smart-home',
                title: 'ESP8266 4-Channel Home Automation Web Server',
                microcontroller: 'ESP8266 (NodeMCU)',
                components: ['4-Channel Relay Module', 'DHT11 Sensor', '4x Push Buttons'],
                functional_requirements: 'Host responsive HTML dashboard with relay toggles and manual push button overrides.'
            },
            {
                id: 'arduino-obstacle-rover',
                title: 'Obstacle Avoidance Robot with Ultrasonic Radar',
                microcontroller: 'Arduino Uno',
                components: ['HC-SR04 Ultrasonic', 'SG90 Servo', 'L298N Motor Driver', 'Buzzer'],
                functional_requirements: 'Drive forward continuously. If obstacle < 25cm, stop, sweep servo left/right, turn and resume.'
            }
        ];
    }
}

/**
 * Setup Textarea resizing, Enter send key handlers, Mic button
 */
function setupInputListeners() {
    const textarea = document.getElementById('ai-project-input');
    const sendBtn = document.getElementById('btn-send-msg');
    const micBtn = document.getElementById('btn-mic-input');

    if (textarea) {
        // Auto-expand textarea
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        });

        // Enter key = Send, Shift+Enter = Newline
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitUserMessage();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', submitUserMessage);
    }

    // Speech Recognition feature for Mic button
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('Speech recognition is not supported in this browser. Please type your message.');
                return;
            }
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            micBtn.style.color = '#ef4444';
            micBtn.title = 'Listening... Speak now';
            
            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                textarea.value = (textarea.value ? textarea.value + ' ' : '') + text;
                textarea.dispatchEvent(new Event('input'));
                micBtn.style.color = '';
                micBtn.title = 'Voice Input';
            };

            recognition.onerror = () => {
                micBtn.style.color = '';
                micBtn.title = 'Voice Input';
            };

            recognition.onend = () => {
                micBtn.style.color = '';
                micBtn.title = 'Voice Input';
            };

            recognition.start();
        });
    }
}

/**
 * Quick Starter Chips Setup
 */
function setupQuickStarters() {
    const chips = document.querySelectorAll('.chip-item');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const templateId = chip.dataset.template;
            const template = availableTemplates.find(t => t.id === templateId);
            const promptText = template 
                ? `I want to build a ${template.title} using ${template.microcontroller} with ${template.components.join(', ')}.`
                : `I want to build an ${chip.textContent.trim()} project.`;
            
            const textarea = document.getElementById('ai-project-input');
            if (textarea) {
                textarea.value = promptText;
                textarea.dispatchEvent(new Event('input'));
                submitUserMessage();
            }
        });
    });
}

/**
 * Handle Sending User Message
 */
async function submitUserMessage() {
    const textarea = document.getElementById('ai-project-input');
    const sendBtn = document.getElementById('btn-send-msg');
    const userText = textarea ? textarea.value.trim() : '';

    if (!userText) return;

    // Clear input
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    // Append User message to UI
    const currentTime = getCurrentTimeString();
    appendMessageBubble('user', userText, currentTime);
    chatHistory.push({ role: 'user', content: userText });

    // Show Typing Indicator
    showTypingIndicator();

    try {
        let aiResponseData;

        if (isBackendAvailable) {
            const res = await fetch(`${API_BASE_URL}/chat-followup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: chatHistory,
                    current_state: conversationState
                })
            });

            if (res.ok) {
                aiResponseData = await res.json();
            } else {
                throw new Error('Backend failed');
            }
        } else {
            // Client-side fallback extraction
            await new Promise(r => setTimeout(r, 600)); // Simulate thinking
            aiResponseData = processClientSideFollowup(userText);
        }

        removeTypingIndicator();

        // Update state
        if (aiResponseData.project_state) {
            conversationState = { ...conversationState, ...aiResponseData.project_state };
            updateDetailsDrawerUI();
        }

        // Increment questions answered count
        questionsAnsweredCount++;
        updateProgressBar(questionsAnsweredCount);

        // Handle question vs completion
        if (aiResponseData.ready_for_prompt || questionsAnsweredCount >= 4 || !aiResponseData.next_question) {
            // AI completion response
            const finalMsg = aiResponseData.summary 
                ? `Awesome! Here is your project summary. Whenever you're ready, click **Generate Master Prompt** to build your embedded firmware prompt!`
                : `Great! I've gathered enough specifications for your ${conversationState.project_title || 'IoT Project'}. Click below to generate your Master Prompt.`;
            
            appendMessageBubble('assistant', finalMsg, getCurrentTimeString());
            chatHistory.push({ role: 'assistant', content: finalMsg });
            renderProjectSummaryCard();
        } else {
            // Ask next single question
            const nextQ = aiResponseData.next_question;
            appendMessageBubble('assistant', nextQ, getCurrentTimeString());
            chatHistory.push({ role: 'assistant', content: nextQ });
        }

    } catch (err) {
        console.warn('Chat followup error:', err);
        removeTypingIndicator();
        
        // Fallback response
        const fallbackRes = processClientSideFollowup(userText);
        conversationState = { ...conversationState, ...fallbackRes.project_state };
        updateDetailsDrawerUI();
        questionsAnsweredCount++;
        updateProgressBar(questionsAnsweredCount);

        if (fallbackRes.ready_for_prompt || questionsAnsweredCount >= 4) {
            appendMessageBubble('assistant', 'Got all the details! Click below to synthesize your C++ Master Prompt.', getCurrentTimeString());
            renderProjectSummaryCard();
        } else {
            appendMessageBubble('assistant', fallbackRes.next_question, getCurrentTimeString());
        }
    } finally {
        sendBtn.disabled = false;
        scrollToBottom();
    }
}

/**
 * Client-Side Smart Fallback Extractor
 */
function processClientSideFollowup(userText) {
    const textLower = userText.toLowerCase();
    const fullText = chatHistory.map(m => m.content).join(' ').toLowerCase();

    // Title
    if (!conversationState.project_title && userText) {
        conversationState.project_title = userText;
    }

    // Microcontroller
    if (!conversationState.microcontroller) {
        if (fullText.includes('esp32')) conversationState.microcontroller = 'ESP32 Dev Module (WROOM-32 / S3)';
        else if (fullText.includes('esp8266') || fullText.includes('nodemcu')) conversationState.microcontroller = 'ESP8266 (NodeMCU v3 / D1 Mini)';
        else if (fullText.includes('uno')) conversationState.microcontroller = 'Arduino Uno (ATmega328P)';
        else if (fullText.includes('nano')) conversationState.microcontroller = 'Arduino Nano (ATmega328P)';
        else if (fullText.includes('stm32')) conversationState.microcontroller = 'STM32 Blue Pill (STM32F103C8T6)';
        else if (fullText.includes('pico')) conversationState.microcontroller = 'Raspberry Pi Pico (RP2040)';
    }

    // Components
    const comps = new Set(conversationState.components || []);
    if (fullText.includes('soil') || fullText.includes('moisture')) comps.add('Soil Moisture Sensor');
    if (fullText.includes('dht22') || fullText.includes('dht11') || fullText.includes('temp')) comps.add('DHT22 Temp & Humidity Sensor');
    if (fullText.includes('relay') || fullText.includes('pump')) comps.add('5V Relay / Water Pump');
    if (fullText.includes('oled')) comps.add('SSD1306 OLED Display');
    if (fullText.includes('lcd')) comps.add('16x2 I2C LCD Display');
    if (fullText.includes('servo')) comps.add('SG90 Servo Motor');
    if (fullText.includes('ultrasonic')) comps.add('HC-SR04 Ultrasonic Sensor');
    conversationState.components = Array.from(comps);

    // Communication
    if (!conversationState.communication_protocol) {
        if (fullText.includes('mqtt')) conversationState.communication_protocol = 'WiFi + MQTT (PubSubClient)';
        else if (fullText.includes('wifi') || fullText.includes('web')) conversationState.communication_protocol = 'WiFi Web Server / HTTP REST';
        else if (fullText.includes('ble') || fullText.includes('bluetooth')) conversationState.communication_protocol = 'Bluetooth LE (BLE)';
    }

    // Functional logic
    conversationState.functional_requirements = chatHistory.map(m => m.content).join(' • ');

    // Questions sequence
    if (!conversationState.microcontroller) {
        return {
            ready_for_prompt: false,
            next_question: 'Which microcontroller board will you be using (e.g. ESP32, Arduino Uno, ESP8266, or STM32)?',
            project_state: conversationState
        };
    }

    if (conversationState.components.length === 0) {
        return {
            ready_for_prompt: false,
            next_question: 'Which specific sensors or modules will be connected to your board (e.g. Soil Moisture Sensor, Relay Pump, OLED Display)?',
            project_state: conversationState
        };
    }

    if (!fullText.includes('pump') && !fullText.includes('automatically') && !fullText.includes('control') && questionsAnsweredCount < 2) {
        return {
            ready_for_prompt: false,
            next_question: 'Great! Should the system automatically control an output (like a relay or pump) based on sensor thresholds?',
            project_state: conversationState
        };
    }

    if (!conversationState.communication_protocol && questionsAnsweredCount < 3) {
        return {
            ready_for_prompt: false,
            next_question: 'Will this project send data over WiFi / MQTT to a cloud dashboard, or run standalone locally?',
            project_state: conversationState
        };
    }

    return {
        ready_for_prompt: true,
        next_question: null,
        summary: `Project setup for ${conversationState.project_title}`,
        project_state: conversationState
    };
}

/**
 * UI Renderers
 */
function appendMessageBubble(role, text, timeStr) {
    const messagesArea = document.getElementById('chat-messages-area');
    if (!messagesArea) return;

    const row = document.createElement('div');
    row.className = `chat-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

    if (role === 'assistant') {
        row.innerHTML = `
            <div class="avatar-badge ai-avatar" title="IoT Saathi AI">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><line x1="9" y1="1" x2="9" y2="5"/><line x1="15" y1="1" x2="15" y2="5"/><line x1="9" y1="19" x2="9" y2="23"/><line x1="15" y1="1" x2="15" y2="23"/><line x1="1" y1="9" x2="5" y2="9"/><line x1="1" y1="15" x2="5" y2="15"/><line x1="19" y1="9" x2="23" y2="9"/><line x1="19" y1="15" x2="23" y2="15"/></svg>
            </div>
            <div class="bubble-content-wrap">
                <div class="chat-bubble ai-bubble">${escapeHtml(text)}</div>
                <div class="chat-time">${timeStr}</div>
            </div>
        `;
    } else {
        row.innerHTML = `
            <div class="avatar-badge user-avatar" title="You">B</div>
            <div class="bubble-content-wrap">
                <div class="chat-bubble user-bubble">${escapeHtml(text)}</div>
                <div class="chat-time">${timeStr}</div>
            </div>
        `;
    }

    messagesArea.appendChild(row);
    scrollToBottom();
}

function showTypingIndicator() {
    const messagesArea = document.getElementById('chat-messages-area');
    if (!messagesArea) return;

    removeTypingIndicator(); // Ensure no duplicates

    const typingRow = document.createElement('div');
    typingRow.id = 'active-typing-row';
    typingRow.className = 'chat-row ai-row';
    typingRow.innerHTML = `
        <div class="avatar-badge ai-avatar" title="IoT Saathi AI">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="2"/><line x1="9" y1="1" x2="9" y2="5"/><line x1="15" y1="1" x2="15" y2="5"/><line x1="9" y1="19" x2="9" y2="23"/><line x1="15" y1="1" x2="15" y2="23"/><line x1="1" y1="9" x2="5" y2="9"/><line x1="1" y1="15" x2="5" y2="15"/><line x1="19" y1="9" x2="23" y2="9"/><line x1="19" y1="15" x2="23" y2="15"/></svg>
        </div>
        <div class="bubble-content-wrap">
            <div class="chat-bubble ai-bubble">
                <div class="typing-dots">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        </div>
    `;
    messagesArea.appendChild(typingRow);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typingRow = document.getElementById('active-typing-row');
    if (typingRow) typingRow.remove();
}

function updateProgressBar(count) {
    const fill = document.getElementById('progress-bar-fill');
    const label = document.getElementById('progress-label');

    const maxQuestions = 4;
    const percentage = Math.min(100, Math.round((count / maxQuestions) * 100));

    if (fill) fill.style.width = `${percentage}%`;
    if (label) label.textContent = `${count} question${count === 1 ? '' : 's'} answered`;
}

function updateDetailsDrawerUI() {
    const elTitle = document.getElementById('state-title');
    const elMcu = document.getElementById('state-mcu');
    const elFramework = document.getElementById('state-framework');
    const elComps = document.getElementById('state-components');
    const elProto = document.getElementById('state-protocol');
    const elPins = document.getElementById('state-pins');
    const elReqs = document.getElementById('state-requirements');

    if (elTitle) elTitle.textContent = conversationState.project_title || 'Not specified';
    if (elMcu) elMcu.textContent = conversationState.microcontroller || 'ESP32 / Arduino';
    if (elFramework) elFramework.textContent = conversationState.framework || 'Arduino C++';
    if (elComps) elComps.textContent = conversationState.components.length > 0 ? conversationState.components.join(', ') : 'None specified';
    if (elProto) elProto.textContent = conversationState.communication_protocol || 'Local event loop';
    if (elPins) elPins.textContent = conversationState.pin_mapping || 'Auto-designated GPIOs';
    if (elReqs) elReqs.textContent = conversationState.functional_requirements || 'Pending...';
}

function renderProjectSummaryCard() {
    const messagesArea = document.getElementById('chat-messages-area');
    if (!messagesArea || document.getElementById('project-summary-card')) return;

    const summaryCard = document.createElement('div');
    summaryCard.id = 'project-summary-card';
    summaryCard.className = 'project-summary-card';
    summaryCard.innerHTML = `
        <div class="summary-title">📋 Project Architecture Summary</div>
        <div class="summary-list">
            <strong>• Objective:</strong> ${escapeHtml(conversationState.project_title || 'IoT Embedded Project')}<br>
            <strong>• Target Board:</strong> ${escapeHtml(conversationState.microcontroller || 'ESP32 Dev Module')}<br>
            <strong>• Components:</strong> ${escapeHtml(conversationState.components.join(', ') || 'Sensors & Actuators')}<br>
            <strong>• Communication:</strong> ${escapeHtml(conversationState.communication_protocol || 'Local / WiFi')}
        </div>
        <button type="button" class="btn-generate-master" id="btn-trigger-master-gen">
            ⚡ Generate Master Prompt
        </button>
    `;

    messagesArea.appendChild(summaryCard);
    scrollToBottom();

    document.getElementById('btn-trigger-master-gen')?.addEventListener('click', generateFinalMasterPrompt);
}

/**
 * Generate Master Prompt API trigger
 */
async function generateFinalMasterPrompt() {
    const btn = document.getElementById('btn-trigger-master-gen');
    const outputSection = document.getElementById('master-prompt-output-section');
    const terminal = document.getElementById('prompt-code-terminal');
    const tokenBadge = document.getElementById('output-token-badge');
    const engineNameBadge = document.getElementById('output-engine-name');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⚡ Synthesizing Embedded C++ Master Prompt...';
    }

    if (outputSection) outputSection.classList.remove('hidden');
    if (terminal) terminal.textContent = 'Synthesizing dense, token-optimized Master Prompt for Embedded C++ firmware...';

    const payload = {
        project_title: conversationState.project_title || 'IoT Smart Controller',
        microcontroller: conversationState.microcontroller || 'ESP32 Dev Module',
        framework: conversationState.framework || 'Arduino C++ (PlatformIO / Arduino IDE)',
        components: conversationState.components.length > 0 ? conversationState.components : ['Sensors & Actuators'],
        pin_mapping: conversationState.pin_mapping || null,
        communication_protocol: conversationState.communication_protocol || null,
        functional_requirements: conversationState.functional_requirements || 'Read sensors and trigger actuators non-blockingly.',
        special_constraints: conversationState.special_constraints || 'Strictly non-blocking millis() / FreeRTOS, memory safe, no dynamic String.'
    };

    try {
        if (isBackendAvailable) {
            const res = await fetch(`${API_BASE_URL}/generate-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                if (terminal) terminal.textContent = data.master_prompt;
                if (tokenBadge) tokenBadge.textContent = `~${data.tokens_estimated} tokens`;
                if (engineNameBadge) engineNameBadge.textContent = data.engine_used;
            } else {
                throw new Error('API request failed');
            }
        } else {
            // Client side synthesis fallback
            const prompt = generateClientSidePrompt(payload);
            if (terminal) terminal.textContent = prompt;
            if (tokenBadge) tokenBadge.textContent = `~${Math.round(prompt.length / 4)} tokens`;
            if (engineNameBadge) engineNameBadge.textContent = 'Deterministic Client Synthesizer';
        }
    } catch (err) {
        console.warn('Master prompt generation error, using fallback:', err);
        const prompt = generateClientSidePrompt(payload);
        if (terminal) terminal.textContent = prompt;
        if (tokenBadge) tokenBadge.textContent = `~${Math.round(prompt.length / 4)} tokens`;
        if (engineNameBadge) engineNameBadge.textContent = 'Deterministic Client Synthesizer';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '✓ Master Prompt Generated Below!';
        }
        outputSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Client-Side Deterministic Prompt Synthesizer
 */
function generateClientSidePrompt(p) {
    const compStr = p.components.length > 0 ? p.components.join(', ') : 'Standard GPIO & Peripherals';
    const pinStr = p.pin_mapping || 'Assign optimal constexpr uint8_t pin constants';
    const protoStr = p.communication_protocol || 'Local event loop / GPIO';
    const constrStr = p.special_constraints || 'Strictly non-blocking logic using millis() timers or FreeRTOS. Zero delay().';

    return `### 🎯 EMBEDDED C++ MASTER PROMPT FOR LLM

**ROLE & TARGET:**
Act as a Senior Embedded Systems Engineer. Write clean, memory-safe, production-grade C++ firmware for **${p.microcontroller}** using **${p.framework}**.

**PROJECT SPECIFICATION:**
- **Title:** ${p.project_title}
- **Target Microcontroller:** ${p.microcontroller}
- **Framework / SDK:** ${p.framework}
- **Peripherals & Sensors:** ${compStr}
- **Pin Assignments:** ${pinStr}
- **Communication Protocol:** ${protoStr}

**FUNCTIONAL LOGIC & OPERATIONAL FLOW:**
${p.functional_requirements}

**STRICT EMBEDDED C++ ARCHITECTURAL CONSTRAINTS:**
1. **Concurrency & Non-Blocking:** ${constrStr}
2. **Memory Safety:** Strictly avoid dynamic heap allocations (\`String\` objects). Use fixed-size buffers (\`snprintf\`), \`const char*\`, and stack variables to prevent heap fragmentation.
3. **Fault Tolerance:** Implement hardware initialization checks, communication reconnect logic with exponential backoff, and watchdog support.
4. **State Machine:** Encapsulate states using \`enum class SystemState\` and keep peripheral drivers modular.
5. **Pin Definitions:** Declare GPIO pins using \`constexpr uint8_t\` with inline documentation.

**REQUIRED OUTPUT FROM TARGET LLM:**
Provide fully compilable, production-ready C++ firmware (.ino / .cpp) including all library \`#include\` directives, configuration constants, setup initialization, and main event loop.`;
}

/**
 * Setup Drawer & Action Buttons
 */
function setupDrawerAndActions() {
    const btnToggle = document.getElementById('btn-toggle-details');
    const btnClose = document.getElementById('btn-close-drawer');
    const drawer = document.getElementById('project-details-drawer');
    const btnCopy = document.getElementById('btn-copy-prompt');
    const btnRegenerate = document.getElementById('btn-regenerate-prompt');
    const btnEdit = document.getElementById('btn-edit-project');

    btnToggle?.addEventListener('click', () => {
        drawer?.classList.toggle('hidden');
    });

    btnClose?.addEventListener('click', () => {
        drawer?.classList.add('hidden');
    });

    btnCopy?.addEventListener('click', async () => {
        const terminal = document.getElementById('prompt-code-terminal');
        const text = terminal ? terminal.textContent : '';
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            const orig = btnCopy.innerHTML;
            btnCopy.innerHTML = '✓ Copied to Clipboard!';
            setTimeout(() => { btnCopy.innerHTML = orig; }, 2500);
        } catch (err) {
            console.error('Copy failed', err);
            alert('Prompt copied!');
        }
    });

    btnRegenerate?.addEventListener('click', () => {
        generateFinalMasterPrompt();
    });

    btnEdit?.addEventListener('click', () => {
        drawer?.classList.remove('hidden');
        drawer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

/**
 * Utilities
 */
function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const area = document.getElementById('chat-messages-area');
    if (area) area.scrollTop = area.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
