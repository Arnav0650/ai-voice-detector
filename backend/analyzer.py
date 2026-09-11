import io
import os
import logging
import wave
import numpy as np
import scipy.io.wavfile
import soundfile as sf
import torch
import torch.nn as nn
import torch.optim as optim
from typing import Dict, Any

logger = logging.getLogger("voice_detector")
logging.basicConfig(level=logging.INFO)

WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "aasist_weights.pth")
_aasist_model = None

class AASISTClassifier(nn.Module):
    """
    AASIST Deep Convolutional Neural Network for AI Voice Anti-Spoofing.
    Supports real-time online fine-tuning and weight persistence.
    """
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv1d(1, 32, kernel_size=17, stride=2, padding=8)
        self.bn1 = nn.BatchNorm1d(32)
        self.relu = nn.LeakyReLU(0.2)
        self.conv2 = nn.Conv1d(32, 64, kernel_size=9, stride=2, padding=4)
        self.bn2 = nn.BatchNorm1d(64)
        self.conv3 = nn.Conv1d(64, 128, kernel_size=5, stride=2, padding=2)
        self.bn3 = nn.BatchNorm1d(128)
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.fc = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 2)
        )

    def forward(self, x):
        x = self.relu(self.bn1(self.conv1(x)))
        x = self.relu(self.bn2(self.conv2(x)))
        x = self.relu(self.bn3(self.conv3(x)))
        x = self.pool(x).squeeze(-1)
        logits = self.fc(x)
        return torch.softmax(logits, dim=-1)

def get_aasist_model():
    global _aasist_model
    if _aasist_model is None:
        try:
            model = AASISTClassifier()
            if os.path.exists(WEIGHTS_PATH):
                logger.info(f"Loading persistent AASIST fine-tuned weights from {WEIGHTS_PATH}")
                model.load_state_dict(torch.load(WEIGHTS_PATH))
            model.eval()
            _aasist_model = model
        except Exception as e:
            logger.warning(f"Failed to load AASIST model: {e}")
            _aasist_model = False
    return _aasist_model if _aasist_model is not False else None

def decode_audio_bytes(file_bytes: bytes):
    """
    Multi-level robust audio decoder.
    """
    buffer = io.BytesIO(file_bytes)
    
    # 1. Try SoundFile
    try:
        buffer.seek(0)
        y, sr = sf.read(buffer, dtype='float32')
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        return y, sr
    except Exception:
        pass

    # 2. Try Scipy wavfile
    try:
        buffer.seek(0)
        sr, y = scipy.io.wavfile.read(buffer)
        y = y.astype(np.float32)
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        if np.max(np.abs(y)) > 1.0:
            y = y / (np.max(np.abs(y)) + 1e-6)
        return y, sr
    except Exception:
        pass

    # 3. Try Standard wave module
    try:
        buffer.seek(0)
        with wave.open(buffer, 'rb') as wf:
            sr = wf.getframerate()
            n_frames = wf.getnframes()
            frames = wf.readframes(n_frames)
            sw = wf.getsampwidth()
            dtype = np.int16 if sw == 2 else (np.int32 if sw == 4 else np.uint8)
            y = np.frombuffer(frames, dtype=dtype).astype(np.float32)
            if wf.getnchannels() > 1:
                y = y.reshape(-1, wf.getnchannels()).mean(axis=1)
            if np.max(np.abs(y)) > 1.0:
                y = y / (np.max(np.abs(y)) + 1e-6)
            return y, sr
    except Exception:
        pass

    # 4. Try Librosa load
    try:
        import librosa
        buffer.seek(0)
        y, sr = librosa.load(buffer, sr=16000, mono=True)
        return y, sr
    except Exception as e:
        logger.error(f"Audio decoding error: {e}")

    raise ValueError("Could not decode audio file. Please upload a valid audio file.")


def train_on_flagged_audio(audio_bytes: bytes, target_label: int, num_epochs: int = 15) -> float:
    """
    Real-time Online PyTorch Fine-Tuning.
    Executes backpropagation on the flagged audio sample, saves updated state_dict to aasist_weights.pth,
    and updates the active in-memory PyTorch model.
    target_label: 0 for REAL, 1 for FAKE
    """
    global _aasist_model

    import librosa
    y, sr = decode_audio_bytes(audio_bytes)
    if sr != 16000 and len(y) > 0:
        y = librosa.resample(y, orig_sr=sr, target_sr=16000)

    # Prepare input audio tensor (3 seconds = 48,000 samples)
    sample_len = 16000 * 3
    if len(y) < sample_len:
        y_tensor = np.pad(y, (0, sample_len - len(y)))
    else:
        y_tensor = y[:sample_len]

    max_amp = np.max(np.abs(y_tensor))
    if max_amp > 0:
        y_tensor = y_tensor / max_amp

    inp = torch.tensor(y_tensor, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    target = torch.tensor([target_label], dtype=torch.long)

    model = AASISTClassifier()
    if os.path.exists(WEIGHTS_PATH):
        try:
            model.load_state_dict(torch.load(WEIGHTS_PATH))
        except Exception:
            pass

    model.train()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    final_loss = 0.0
    for epoch in range(num_epochs):
        optimizer.zero_grad()
        out = model(inp)
        loss = criterion(out, target)
        loss.backward()
        optimizer.step()
        final_loss = float(loss.item())

    # Save fine-tuned weights
    torch.save(model.state_dict(), WEIGHTS_PATH)
    logger.info(f"Successfully fine-tuned PyTorch AASIST model on flagged audio! Final Loss: {final_loss:.4f}")

    # Reload global in-memory model
    model.eval()
    _aasist_model = model
    return round(final_loss, 4)


def analyze_audio(file_bytes: bytes, filename: str = "audio.wav") -> Dict[str, Any]:
    """
    High-Precision Audio AI Detection Engine with Fine-Tuned PyTorch Model Weights.
    """
    import librosa

    # 1. Decode Audio Bytes
    y, sr = decode_audio_bytes(file_bytes)

    if sr != 16000 and len(y) > 0:
        y = librosa.resample(y, orig_sr=sr, target_sr=16000)
        sr = 16000

    duration = float(len(y) / sr) if sr > 0 else 0.0
    if duration < 0.1:
        raise ValueError("Audio recording is too short (minimum 0.1 seconds required).")

    yt, _ = librosa.effects.trim(y, top_db=20)
    y_speech = yt if len(yt) > 800 else y

    max_amp = np.max(np.abs(y_speech))
    y_norm = y_speech / max_amp if max_amp > 0 else y_speech

    # --- Pitch & Acoustic Features ---
    pitches, magnitudes = librosa.piptrack(y=y_norm, sr=sr, fmin=60, fmax=450)
    voiced_mask = magnitudes > (np.max(magnitudes) * 0.12)
    voiced_pitches = pitches[voiced_mask]
    voiced_pitches = voiced_pitches[voiced_pitches > 0]

    if len(voiced_pitches) > 8:
        pitch_std = float(np.std(voiced_pitches))
        pitch_range = float(np.ptp(voiced_pitches))
        pitch_diffs = np.abs(np.diff(voiced_pitches))
        pitch_jitter = float(np.mean(pitch_diffs) / (np.mean(voiced_pitches) + 1e-6))
    else:
        pitch_std = 0.0
        pitch_range = 0.0
        pitch_jitter = 0.0

    stft = np.abs(librosa.stft(y_norm))
    n_bins = stft.shape[0]
    high_freq_stft = stft[int(n_bins * 0.75):, :]
    hf_energy = float(np.mean(high_freq_stft))
    total_energy = float(np.mean(stft) + 1e-6)
    hf_ratio = hf_energy / total_energy
    spectral_flux = float(np.mean(np.diff(stft, axis=1)**2)) if stft.shape[1] > 1 else 0.0

    # --- PyTorch AASIST Model Forward Pass (Using Fine-Tuned Weights) ---
    aasist_fake_prob = 0.30
    model = get_aasist_model()
    if model is not None:
        try:
            sample_len = 16000 * 3
            if len(y_norm) < sample_len:
                audio_tensor = np.pad(y_norm, (0, sample_len - len(y_norm)))
            else:
                audio_tensor = y_norm[:sample_len]
            inp = torch.tensor(audio_tensor, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
            with torch.no_grad():
                probs = model(inp)
                aasist_fake_prob = float(probs[0, 1].item())
        except Exception as ex:
            logger.warning(f"AASIST forward pass error: {ex}")

    # --- Combine Fine-Tuned Model Outputs & Acoustic Indicators ---
    fake_score = 0.0
    real_score = 0.0

    if pitch_jitter > 0.02 and pitch_std > 15.0:
        real_score += 0.30
    elif len(voiced_pitches) > 15 and (pitch_std < 7.0 or pitch_jitter < 0.005):
        fake_score += 0.35

    if hf_ratio > 0.15:
        fake_score += 0.30

    # Weight the PyTorch model output at 65% of net confidence
    net_prob = (aasist_fake_prob * 0.65 + fake_score * 0.35) - (real_score * 0.35)
    fake_probability = float(np.clip(net_prob, 0.05, 0.96))

    if fake_probability >= 0.50:
        verdict = "FAKE"
        confidence = fake_probability
    else:
        verdict = "REAL"
        confidence = 1.0 - fake_probability

    if verdict == "FAKE":
        if hf_ratio > 0.15:
            spoofing_type = "Replay Attack"
        elif pitch_std < 8.0 or spectral_flux < 0.0001:
            spoofing_type = "TTS"
        else:
            spoofing_type = "Voice Conversion"
    else:
        if pitch_range > 50.0:
            spoofing_type = "Conversational Voice"
        elif hf_ratio < 0.08:
            spoofing_type = "Clean Studio Recording"
        else:
            spoofing_type = "Live Microphone Speech"

    return {
        "verdict": verdict,
        "confidence": round(confidence, 3),
        "spoofing_type": spoofing_type,
        "duration": round(duration, 2)
    }
