import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Keyboard,
  Image as ImageIcon,
  Sparkles,
  Smartphone,
  ShieldCheck,
  SwitchCamera
} from 'lucide-react';

export default function QRCodeScanner({ onScanSuccess, autoStopOnScan = true, title = "Scan Asset QR Tag" }) {
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isSecure, setIsSecure] = useState(true);

  const fileInputRef = useRef(null);
  const nativeCameraInputRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    // Check if running in a secure context (HTTPS or localhost)
    if (typeof window !== 'undefined') {
      const isSec = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      setIsSecure(isSec);
    }
  }, []);

  const handleScanSuccess = (decodedText) => {
    let cleanText = decodedText;
    try {
      const parsed = JSON.parse(decodedText);
      if (parsed.asset_tag) cleanText = parsed.asset_tag;
    } catch (e) {
      // raw text
    }

    if (autoStopOnScan) {
      stopScanning();
    }
    if (onScanSuccess) {
      onScanSuccess(cleanText);
    }
  };

  const startScanning = async (overrideCameraConfig = null) => {
    setErrorMsg('');
    setShowManualInput(false);

    try {
      // Ensure any existing instance is stopped
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {}
      }

      const html5QrCode = new Html5Qrcode('qr-reader-container');
      html5QrCodeRef.current = html5QrCode;

      // Query cameras if not already queried
      let cameras = availableCameras;
      if (!cameras || cameras.length === 0) {
        try {
          cameras = await Html5Qrcode.getCameras();
          setAvailableCameras(cameras || []);
        } catch (e) {
          // getCameras might throw on mobile if permission not granted yet
          cameras = [];
        }
      }

      // Camera config: prioritize mobile rear camera { facingMode: "environment" }
      const cameraConfig = overrideCameraConfig || (
        cameras && cameras.length > 0
          ? cameras[currentCameraIndex % cameras.length].id
          : { facingMode: "environment" }
      );

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.max(200, Math.floor(minEdge * 0.72)),
              height: Math.max(200, Math.floor(minEdge * 0.72)),
            };
          },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        () => {}
      );

      setScanning(true);
    } catch (err) {
      console.warn('Primary camera initialization failed, attempting fallback:', err);
      // Fallback: try generic video constraint
      try {
        if (html5QrCodeRef.current) {
          await html5QrCodeRef.current.start(
            { facingMode: "user" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            handleScanSuccess,
            () => {}
          );
          setScanning(true);
          return;
        }
      } catch (fallbackErr) {
        console.error('All camera attempts failed:', fallbackErr);
      }

      setErrorMsg(
        !isSecure
          ? 'Mobile cameras require HTTPS. Please access using your ngrok HTTPS URL.'
          : 'Camera access denied or unsupported. Tap "Mobile Camera (Native)" or enter tag manually.'
      );
      setShowManualInput(true);
      setScanning(false);
    }
  };

  const switchCamera = async () => {
    if (!availableCameras || availableCameras.length < 2) return;
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIndex);
    await stopScanning();
    await startScanning(availableCameras[nextIndex].id);
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {}
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  // Decode QR from file or native mobile camera capture
  const handleFileScan = async (file) => {
    if (!file) return;

    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode('qr-reader-container');
        html5QrCodeRef.current = scanner;
      }
      const decodedText = await scanner.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      setErrorMsg('Could not detect a valid QR tag in the captured photo. Please ensure good lighting and focus.');
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
          html5QrCodeRef.current = null;
        });
      }
    };
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim() && onScanSuccess) {
      onScanSuccess(manualCode.trim().toUpperCase());
      setManualCode('');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xs border border-zinc-200/80 overflow-hidden">
      <div className="bg-zinc-950 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Camera className="w-4 h-4 text-zinc-300" />
          <h3 className="font-semibold text-xs tracking-wide">{title}</h3>
        </div>
        <div className="flex items-center space-x-1.5">
          {availableCameras.length > 1 && scanning && (
            <button
              onClick={switchCamera}
              className="p-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              title="Switch camera"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-mono">
            HTML5 Native
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 flex flex-col items-center">
        {/* Insecure Context Warning for ngrok */}
        {!isSecure && (
          <div className="mb-3 w-full max-w-sm flex items-start space-x-2 text-amber-900 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] leading-tight">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">Notice for Mobile Devices:</span> Mobile browsers require HTTPS to open live camera streams. Make sure you are using your secure <strong>https://xxxx.ngrok-free.app</strong> link!
            </div>
          </div>
        )}

        {/* Scanner Viewport */}
        <div className="w-full max-w-sm relative rounded-xl overflow-hidden bg-zinc-950 min-h-[240px] flex items-center justify-center border border-zinc-800">
          <div id="qr-reader-container" className="w-full"></div>

          {!scanning && (
            <div className="text-center p-6 text-zinc-400">
              <Camera className="w-10 h-10 mx-auto mb-2 text-zinc-600 animate-soft-pulse" />
              <p className="text-xs font-semibold text-zinc-300">Camera Viewfinder Inactive</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Start live camera or tap Mobile Camera below
              </p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 w-full max-w-sm flex items-start space-x-2 text-rose-800 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Action Controls */}
        <div className="mt-3.5 flex flex-wrap gap-2 justify-center w-full max-w-sm">
          {!scanning ? (
            <button
              onClick={() => startScanning()}
              className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer active:scale-[0.98]"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Start Live Camera</span>
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Stop Camera</span>
            </button>
          )}

          {/* Native Mobile Camera Button: Opens iPhone/Android camera directly */}
          <button
            onClick={() => nativeCameraInputRef.current?.click()}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Opens native camera app directly on mobile device"
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>Mobile Camera</span>
          </button>
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileScan(e.target.files[0]);
              e.target.value = '';
            }}
          />

          {/* Upload QR Image file from gallery */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold py-2.5 px-2.5 rounded-xl flex items-center space-x-1 transition-colors cursor-pointer"
            title="Upload QR Code from image file"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileScan(e.target.files[0]);
              e.target.value = '';
            }}
          />

          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold py-2.5 px-2.5 rounded-xl flex items-center space-x-1 transition-colors cursor-pointer"
            title="Manual tag input"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Manual Asset Code Input */}
        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="mt-3 w-full max-w-sm flex gap-2">
            <input
              type="text"
              placeholder="e.g. EQP-LAP-001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 border border-zinc-300 rounded-xl px-3 py-2 text-xs uppercase tracking-wider font-mono focus:ring-2 focus:ring-zinc-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50 cursor-pointer"
            >
              Lookup
            </button>
          </form>
        )}

       
      </div>
    </div>
  );
}
