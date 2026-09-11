import sqlite3
import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger("voice_detector_db")
DB_PATH = os.path.join(os.path.join(os.path.dirname(__file__)), "detections.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            filename TEXT NOT NULL,
            verdict TEXT NOT NULL,
            confidence REAL NOT NULL,
            spoofing_type TEXT NOT NULL,
            duration REAL DEFAULT 0.0,
            flagged INTEGER DEFAULT 0,
            user_feedback TEXT DEFAULT NULL,
            audio_bytes BLOB DEFAULT NULL
        )
    """)
    conn.commit()

    # Dynamic Schema Migration: Ensure all newer columns exist on pre-existing database tables
    cursor.execute("PRAGMA table_info(detections)")
    columns = [col[1] for col in cursor.fetchall()]

    migrations = [
        ("duration", "ALTER TABLE detections ADD COLUMN duration REAL DEFAULT 0.0"),
        ("flagged", "ALTER TABLE detections ADD COLUMN flagged INTEGER DEFAULT 0"),
        ("user_feedback", "ALTER TABLE detections ADD COLUMN user_feedback TEXT DEFAULT NULL"),
        ("audio_bytes", "ALTER TABLE detections ADD COLUMN audio_bytes BLOB DEFAULT NULL")
    ]

    for col_name, alter_sql in migrations:
        if col_name not in columns:
            logger.info(f"Migrating SQLite schema: Adding missing '{col_name}' column to detections table...")
            try:
                cursor.execute(alter_sql)
                conn.commit()
            except Exception as e:
                logger.warning(f"Column migration warning for {col_name}: {e}")

    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")

def save_detection(filename: str, verdict: str, confidence: float, spoofing_type: str, duration: float = 0.0, audio_bytes: bytes = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO detections (filename, verdict, confidence, spoofing_type, duration, audio_bytes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (filename, verdict, confidence, spoofing_type, duration, audio_bytes))
    record_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT id, timestamp, filename, verdict, confidence, spoofing_type, duration, flagged, user_feedback FROM detections WHERE id = ?", (record_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {}

def flag_detection(record_id: int, user_feedback: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE detections
        SET flagged = 1, user_feedback = ?
        WHERE id = ?
    """, (user_feedback, record_id))
    conn.commit()
    
    cursor.execute("SELECT id, timestamp, filename, verdict, confidence, spoofing_type, duration, flagged, user_feedback FROM detections WHERE id = ?", (record_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {}

def get_detection_audio(record_id: int) -> bytes:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT audio_bytes FROM detections WHERE id = ?", (record_id,))
    row = cursor.fetchone()
    conn.close()
    return row["audio_bytes"] if row and row["audio_bytes"] else None

def get_flagged_samples() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, user_feedback, audio_bytes FROM detections
        WHERE flagged = 1 AND audio_bytes IS NOT NULL
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_history(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, timestamp, filename, verdict, confidence, spoofing_type, duration, flagged, user_feedback FROM detections
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
