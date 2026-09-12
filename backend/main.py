import os
import sys
import logging
from typing import List
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

# Ensure backend directory is in sys.path for direct or module execution
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from models.prompt_schema import (
    PromptGenerationRequest,
    PromptGenerationResponse,
    ProjectTemplate
)
from services.gemini_service import generate_master_prompt_with_gemini
from data.templates import TEMPLATES

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backend")

app = FastAPI(
    title="IoT Saathi - Embedded C++ Master Prompt Engine",
    description="Backend API for IoT Saathi providing token-optimized Master Prompt generation for embedded microcontrollers (ESP32, ESP8266, Arduino, STM32) and starter blueprints.",
    version="1.0.0"
)

# Enable CORS for frontend development and production hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    """Health status check and API key detection."""
    has_api_key = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "healthy",
        "service": "IoT Saathi Backend API",
        "version": "1.0.0",
        "gemini_api_configured": has_api_key,
        "mode": "Gemini Live Synthesis" if has_api_key else "Deterministic Engine Mode"
    }

@app.get("/api/templates", response_model=List[ProjectTemplate])
def get_templates():
    """Returns curated starter templates for quick IoT project prompt generation."""
    return TEMPLATES

@app.post("/api/generate-prompt", response_model=PromptGenerationResponse)
def generate_prompt(req: PromptGenerationRequest):
    """
    Transforms user's IoT hardware components, logic flow, and constraints into a dense,
    token-minimized Embedded C++ Master Prompt ready for input to frontier LLMs.
    """
    try:
        master_prompt, token_count, engine_name = generate_master_prompt_with_gemini(req)
        
        summary = f"{req.microcontroller} running {req.framework} with {len(req.components)} components"
        
        return PromptGenerationResponse(
            success=True,
            master_prompt=master_prompt,
            tokens_estimated=token_count,
            engine_used=engine_name,
            target_board=req.microcontroller,
            framework=req.framework,
            system_architecture_summary=summary
        )
    except Exception as e:
        logger.error(f"Error in generate_prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate master prompt: {str(e)}")

if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
