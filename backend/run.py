import os
import sys
import uvicorn

# Ensure the backend directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"\n==========================================")
    print(f"🚀 IoT Saathi Backend Engine Starting")
    print(f"📡 Serving on: http://{host}:{port}")
    print(f"📖 API Docs:   http://{host}:{port}/docs")
    print(f"==========================================\n")
    uvicorn.run("main:app", host=host, port=port, reload=True)
