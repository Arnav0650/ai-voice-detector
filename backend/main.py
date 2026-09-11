import os
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import init_db, save_detection, get_history, flag_detection, get_detection_audio
from analyzer import analyze_audio, train_on_flagged_audio

logger = logging.getLogger("voice_detector_api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="AI Voice Detector API",
    description="FastAPI service detecting AI-generated (cloned) voices using AASIST & Librosa with Real-time Online Fine-Tuning",
    version="1.0.0"
)

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

class FlagRequest(BaseModel):
    id: int
    user_feedback: str

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database with full schema auto-migration...")
    init_db()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "AI Voice Detector API with Active Learning"}

@app.get("/api/history")
def read_history(limit: int = 50):
    try:
        records = get_history(limit=limit)
        return records
    except Exception as e:
        logger.error(f"Error reading history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
async def analyze_endpoint(
    file: UploadFile = File(...)
):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    filename = file.filename or "recording.wav"
    try:
        contents = await file.read()
        if not contents or len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        analysis_result = analyze_audio(contents, filename=filename)
        
        saved_record = save_detection(
            filename=filename,
            verdict=analysis_result["verdict"],
            confidence=analysis_result["confidence"],
            spoofing_type=analysis_result["spoofing_type"],
            duration=analysis_result.get("duration", 0.0),
            audio_bytes=contents
        )

        return saved_record

    except ValueError as ve:
        logger.warning(f"Validation error analyzing {filename}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error processing audio analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failure: {str(e)}")

@app.post("/api/flag")
def flag_endpoint(req: FlagRequest):
    try:
        updated_record = flag_detection(record_id=req.id, user_feedback=req.user_feedback)
        
        # Trigger Real-Time PyTorch Model Training / Fine-Tuning
        audio_bytes = get_detection_audio(req.id)
        loss_score = None
        if audio_bytes:
            target_label = 1 if req.user_feedback == "SHOULD_BE_FAKE" else 0
            logger.info(f"Triggering active learning online fine-tuning for record #{req.id} with target label {target_label}...")
            loss_score = train_on_flagged_audio(audio_bytes, target_label=target_label, num_epochs=15)

        return {
            "status": "success",
            "record": updated_record,
            "trained": True if loss_score is not None else False,
            "final_loss": loss_score
        }
    except Exception as e:
        logger.error(f"Error flagging and training detection #{req.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AI Voice Detector API is running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
