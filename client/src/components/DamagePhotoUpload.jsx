import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, AlertTriangle, Image as ImageIcon, Sparkles, Smartphone } from 'lucide-react';
import { useToast } from './Toast';

export default function DamagePhotoUpload({
  photos = [],
  onPhotosChange,
  isReturnInspection = false,
  checkoutPhotos = [],
  damageState = { hasDamage: false, severity: 'NONE', notes: '' },
  onDamageStateChange,
}) {
  const toast = useToast();
  const [useLiveCam, setUseLiveCam] = useState(false);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const nativeCameraInputRef = useRef(null);

  // Start live webcam stream
  const startCamera = async () => {
    try {
      let stream;
      try {
        // Try rear mobile camera first
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (err1) {
        // Fallback to any camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setUseLiveCam(true);
    } catch (err) {
      toast.info('Live video stream unavailable. Tap "Mobile Camera" to take photo with phone camera.');
      setUseLiveCam(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setUseLiveCam(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const newPhoto = {
      id: Date.now(),
      previewUrl: dataUrl,
      base64: dataUrl,
      caption: isReturnInspection ? 'Return condition verification' : 'Pre-checkout inspection baseline',
    };

    onPhotosChange([...photos, newPhoto]);
    toast.success('Inspection photo recorded');
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newPhotos = files.map((file) => ({
      id: Date.now() + Math.random(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: isReturnInspection ? `Return: ${file.name}` : `Baseline: ${file.name}`,
    }));

    onPhotosChange([...photos, ...newPhotos]);
    toast.success(`${files.length} photo(s) attached`);
    e.target.value = '';
  };

  // Sample photo simulation for panel presentation
  const handleLoadSamplePhoto = (isDamageSample = false) => {
    const sampleUrl = isDamageSample
      ? 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80'
      : 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80';

    const newPhoto = {
      id: Date.now(),
      previewUrl: sampleUrl,
      caption: isDamageSample ? 'Sample return inspection: Scratched lens casing' : 'Sample pre-checkout baseline: Operational condition',
    };

    onPhotosChange([...photos, newPhoto]);
    toast.info('Sample inspection photo loaded for demo');
  };

  const removePhoto = (idToRemove) => {
    onPhotosChange(photos.filter((p) => p.id !== idToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Pre-checkout baseline photos for side-by-side verification during check-in */}
      {isReturnInspection && checkoutPhotos && checkoutPhotos.length > 0 && (
        <div className="bg-zinc-50 border border-zinc-200/90 rounded-2xl p-4">
          <div className="flex items-center space-x-2 text-zinc-900 font-semibold text-xs mb-1.5">
            <ImageIcon className="w-4 h-4 text-zinc-600" />
            <span>Pre-Checkout Inspection Baseline (For Comparison Proof)</span>
          </div>
          <p className="text-[11px] text-zinc-500 mb-3">
            Compare the physical equipment now against baseline photos taken prior to handoff to verify liability:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {checkoutPhotos.map((photo, index) => (
              <div key={photo.id || index} className="relative group rounded-xl overflow-hidden border border-zinc-200 bg-white shadow-2xs">
                <img
                  src={photo.image_url}
                  alt={photo.caption || 'Checkout baseline'}
                  className="w-full h-24 sm:h-28 object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="p-1.5 bg-zinc-950/80 text-white text-[10px] font-medium truncate">
                  {photo.caption || 'Pre-checkout condition'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Camera Viewport */}
      {useLiveCam && (
        <div className="border border-zinc-800 rounded-2xl bg-zinc-950 p-4 text-white flex flex-col items-center animate-in fade-in duration-200">
          <div className="w-full max-w-md aspect-video bg-black rounded-xl overflow-hidden mb-3 relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={capturePhoto}
              className="bg-white hover:bg-zinc-100 text-zinc-950 px-4 py-2 rounded-xl font-semibold flex items-center space-x-1.5 text-xs shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Photo Frame</span>
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl font-semibold text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons: Live Camera, Native Mobile Camera, Gallery Upload, Demo Simulator */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startCamera}
          className="bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200/90 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5 text-zinc-600" />
          <span>Live Camera View</span>
        </button>

        {/* Native Mobile Camera Button: Opens iPhone/Android camera directly */}
        <button
          type="button"
          onClick={() => nativeCameraInputRef.current?.click()}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          title="Directly opens the phone's camera on mobile devices"
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
          onChange={handleFileUpload}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border border-zinc-200/90 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-zinc-600" />
          <span>Upload File</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Demo Simulator button */}
        <button
          type="button"
          onClick={() => handleLoadSamplePhoto(isReturnInspection && damageState.hasDamage)}
          className="bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200/80 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
          title="For Defense Presentation: Inserts a sample inspection photo immediately"
        >
          <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
          <span>Load Demo Snapshot</span>
        </button>
      </div>

      {/* Captured / Uploaded Photos Preview List */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {photos.map((photo) => (
            <div key={photo.id} className="relative rounded-xl overflow-hidden border border-zinc-200 group bg-zinc-50 shadow-2xs">
              <img
                src={photo.previewUrl}
                alt="Condition inspection preview"
                className="w-full h-24 object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-1.5 right-1.5 bg-zinc-950/80 hover:bg-rose-600 text-white p-1 rounded-full shadow-xs transition-colors cursor-pointer"
                title="Remove photo"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <div className="p-1.5 bg-white text-[10px] text-zinc-600 truncate border-t border-zinc-100 font-medium">
                {photo.caption || 'Inspection photo'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Return Damage Verification Panel */}
      {isReturnInspection && onDamageStateChange && (
        <div className="mt-4 pt-4 border-t border-zinc-200">
          <label className="flex items-center space-x-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={damageState.hasDamage}
              onChange={(e) => onDamageStateChange({ ...damageState, hasDamage: e.target.checked })}
              className="w-4 h-4 text-rose-600 rounded border-zinc-300 focus:ring-rose-500 cursor-pointer"
            />
            <span className="font-semibold text-xs text-zinc-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Flag Equipment Damage or Hardware Fault
            </span>
          </label>

          {damageState.hasDamage && (
            <div className="mt-3 p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-2xl space-y-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] font-semibold text-rose-950 mb-1.5">
                  Damage Severity Classification:
                </label>
                <div className="flex gap-2">
                  {['MINOR', 'MODERATE', 'SEVERE'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onDamageStateChange({ ...damageState, severity: level })}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        damageState.severity === level
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {level} DAMAGE
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-950 mb-1">
                  Damage Notes (Body scratches, broken connector, screen crack):
                </label>
                <textarea
                  rows={2}
                  value={damageState.notes}
                  onChange={(e) => onDamageStateChange({ ...damageState, notes: e.target.value })}
                  placeholder="e.g. Scratched front lens coating; power brick cord torn near adapter..."
                  className="w-full text-xs p-2.5 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
                />
              </div>

              <div className="flex items-center text-[11px] text-rose-900 bg-rose-100/60 p-2.5 rounded-xl">
                <AlertTriangle className="w-3.5 h-3.5 mr-2 text-rose-600 shrink-0" />
                <span>
                  Confirming return with damage will update this asset to <strong>Under Repair (Red)</strong> and lock photo proof in the audit record.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
