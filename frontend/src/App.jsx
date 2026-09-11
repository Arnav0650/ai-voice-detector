import React, { useState, useEffect, useRef } from 'react';
import { Upload, Mic, Square, Play, Pause, Volume2, Shield, Activity, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import WaveformCanvas from './components/WaveformCanvas';
import VerdictDisplay from './components/VerdictDisplay';
import HistoryTable from './components/HistoryTable';

export default function App() {
  // State management
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  // Web Audio API refs
  const audioContextRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioElementRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch detection history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  // Helper to initialize Web Audio API Context & Analyser
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      audioContextRef.current = ctx;
      analyserNodeRef.current = analyser;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return { ctx: audioContextRef.current, analyser: analyserNodeRef.current };
  };

  // Handle File Upload Select
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setIsPlaying(false);
    
    // Auto submit to analyze
    analyzeAudioFile(file);
  };

  // Start Mic Recording
  const startRecording = async () => {
    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { ctx, analyser } = initAudioContext();
      
      // Connect live mic stream to canvas analyser
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const recordedFile = new File([audioBlob], `mic_recording_${Date.now()}.wav`, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        
        setSelectedFile(recordedFile);
        setAudioUrl(url);
        
        // Stop track streams
        stream.getTracks().forEach(track => track.stop());

        // Analyze recorded audio
        analyzeAudioFile(recordedFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access error:", err);
      setErrorMsg("Microphone access denied or unsupported by browser.");
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  // Send audio file to POST /api/analyze
  const analyzeAudioFile = async (fileToAnalyze) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', fileToAnalyze);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: 'Analysis failed' }));
        throw new Error(errJson.detail || 'Server error during audio analysis');
      }

      const resultData = await res.json();
      setAnalysisResult(resultData);
      
      // Refresh SQLite history log table
      fetchHistory();
    } catch (err) {
      console.error("Analysis API Error:", err);
      setErrorMsg(err.message || "Failed to analyze audio.");
    } finally {
      setIsLoading(false);
    }
  };

  // Audio Playback with Web Audio API Analyser
  const togglePlayback = () => {
    if (!audioElementRef.current || !audioUrl) return;

    const audio = audioElementRef.current;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const { ctx, analyser } = initAudioContext();
      
      // Connect audio element source node to analyser if not already done
      if (!audio._sourceNode) {
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audio._sourceNode = source;
      }

      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Playback error:", err);
      });
    }
  };

  return (
    <div className="min-h-screen pb-16 pt-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <header className="glass-panel rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 max-w-2xl z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 text-xs font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> AASIST Deep Learning + Resemblyzer Engine
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-200 to-cyan-300">
            AI Voice Detector
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Detect synthetic, AI-generated, and cloned voice audio in real-time using deep spectro-temporal feature models.
          </p>
        </div>

        <div className="flex items-center gap-3 glass-panel px-4 py-3 rounded-2xl border-slate-700/60 z-10">
          <Shield className="w-8 h-8 text-cyan-400" />
          <div className="text-left">
            <div className="text-xs text-slate-400 font-mono">System Status</div>
            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ready & Online
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upload / Record Controls & Waveform */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-cyan-400" /> Input Audio Source
              </h2>
              <span className="text-xs font-mono text-slate-400">WAV, MP3, OGG, WEBM</span>
            </div>

            {/* Action Buttons: 1. Upload File & 2. Record Mic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Button 1: Upload Audio File */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="audio/*" 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRecording || isLoading}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/80 bg-slate-900/60 hover:bg-slate-800/80 transition-all group text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-950/80 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200 text-sm">Upload Audio File</div>
                  <div className="text-xs text-slate-500 mt-0.5">Click to browse or drop file</div>
                </div>
              </button>

              {/* Button 2: Record from Mic */}
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isLoading}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-rose-500/80 bg-slate-900/60 hover:bg-slate-800/80 transition-all group text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-rose-950/80 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Mic className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 text-sm">Record from Mic</div>
                    <div className="text-xs text-slate-500 mt-0.5">Live audio stream</div>
                  </div>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-rose-500 bg-rose-950/40 hover:bg-rose-900/60 transition-all text-center animate-pulse"
                >
                  <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                    <Square className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <div className="font-bold text-rose-300 text-sm">Stop Recording</div>
                    <div className="text-xs text-rose-400 font-mono mt-0.5">
                      Recording: {recordingTime}s
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Hidden HTML5 Audio Element for playback */}
            {audioUrl && (
              <audio
                ref={audioElementRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            )}

            {/* Audio Playback Bar */}
            {selectedFile && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <div className="flex items-center gap-3 truncate max-w-[70%]">
                  <button
                    onClick={togglePlayback}
                    className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center transition-colors font-bold shrink-0"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="truncate">
                    <div className="text-sm font-medium text-slate-200 truncate">{selectedFile.name}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => analyzeAudioFile(selectedFile)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-semibold rounded-lg border border-cyan-800/60 transition-colors"
                >
                  {isLoading ? 'Analyzing...' : 'Re-Analyze'}
                </button>
              </div>
            )}

            {/* Canvas Real-time Waveform */}
            <WaveformCanvas 
              analyserNode={analyserNodeRef.current} 
              isPlaying={isPlaying} 
              isRecording={isRecording}
              color={analysisResult?.verdict === "FAKE" ? "#EF4444" : "#06B6D4"}
            />
          </div>
        </div>

        {/* Right Column: Verdict Output Display */}
        <div className="lg:col-span-5">
          <VerdictDisplay result={analysisResult} isLoading={isLoading} />
        </div>
      </div>

      {/* Bottom Section: SQLite History Table */}
      <HistoryTable history={history} onRefresh={fetchHistory} isLoading={isLoading} />
    </div>
  );
}
