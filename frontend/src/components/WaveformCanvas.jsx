import React, { useEffect, useRef } from 'react';

/**
 * WaveformCanvas Component
 * Renders real-time audio waveform from an AnalyserNode or Audio Element on HTML5 Canvas.
 */
export default function WaveformCanvas({ analyserNode, isPlaying, isRecording, color = "#06B6D4" }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set internal resolution
    const width = canvas.parentElement.clientWidth || 600;
    const height = 140;
    canvas.width = width;
    canvas.height = height;

    if (!analyserNode || (!isPlaying && !isRecording)) {
      // Draw idle line / static pulse waveform
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      
      const numPoints = 80;
      for (let i = 0; i < numPoints; i++) {
        const x = (i / (numPoints - 1)) * width;
        const y = height / 2 + Math.sin(i * 0.15) * 3;
        ctx.lineTo(x, y);
      }
      
      ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }

    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserNode.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, width, height);
      
      // Draw background ambient glow line
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;

      const sliceWidth = width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserNode, isPlaying, isRecording, color]);

  return (
    <div className="w-full relative overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800/80 p-3 shadow-inner">
      <div className="flex items-center justify-between mb-2 px-1 text-xs font-mono text-slate-400">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPlaying || isRecording ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`}></span>
          {isRecording ? "MIC RECORDING STREAM" : isPlaying ? "AUDIO PLAYBACK STREAM" : "WAVEFORM VISUALIZER (IDLE)"}
        </span>
        <span>16kHz Audio Context</span>
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-full h-[140px] block rounded"
      />
    </div>
  );
}
