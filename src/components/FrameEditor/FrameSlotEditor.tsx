'use client';

import React, { useState, useRef } from 'react';
import { FrameTemplate, FrameCategory, PhotoFilter, SlotAdjustment } from '@/types/photobooth';
import { FRAME_TEMPLATES } from '@/lib/constants';
import { Sparkles, ZoomIn, ZoomOut, Move, Check, Palette, Layout, RotateCcw } from 'lucide-react';

interface FrameSlotEditorProps {
  capturedPhotos: string[];
  selectedTemplate: FrameTemplate;
  onSelectTemplate: (template: FrameTemplate) => void;
  slotAdjustments: Record<string, SlotAdjustment>;
  onUpdateSlotAdjustment: (slotId: string, adjustment: Partial<SlotAdjustment>) => void;
  onConfirm: () => void;
}

export const FrameSlotEditor: React.FC<FrameSlotEditorProps> = ({
  capturedPhotos,
  selectedTemplate,
  onSelectTemplate,
  slotAdjustments,
  onUpdateSlotAdjustment,
  onConfirm,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FrameCategory>('strip');
  const [activeSlotId, setActiveSlotId] = useState<string>(selectedTemplate.slots[0]?.id || 's1');
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);

  // Filters available
  const filters: { id: PhotoFilter; label: string }[] = [
    { id: 'none', label: 'Normal' },
    { id: 'bw', label: 'B&W Classic' },
    { id: 'vintage', label: '90s Vintage' },
    { id: 'warm', label: 'Warm Glow' },
    { id: 'sepia', label: 'Retro Sepia' },
    { id: 'cyberpunk', label: 'Cyberpunk' },
  ];

  const filteredTemplates = FRAME_TEMPLATES.filter((t) => t.category === selectedCategory);

  const activeSlot = selectedTemplate.slots.find((s) => s.id === activeSlotId) || selectedTemplate.slots[0];
  const currentAdj = slotAdjustments[activeSlotId] || {
    slotId: activeSlotId,
    photoIndex: 0,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    filter: 'none',
  };

  // Drag and Drop handlers
  const handleDragStart = (idx: number) => {
    setDraggedPhotoIndex(idx);
  };

  const handleDropOnSlot = (slotId: string) => {
    if (draggedPhotoIndex !== null) {
      onUpdateSlotAdjustment(slotId, { photoIndex: draggedPhotoIndex });
      setActiveSlotId(slotId);
      setDraggedPhotoIndex(null);
    }
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.min(3.0, Math.max(1.0, newZoom));
    onUpdateSlotAdjustment(activeSlotId, { zoom: clamped });
  };

  const handleFilterChange = (filter: PhotoFilter) => {
    onUpdateSlotAdjustment(activeSlotId, { filter });
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 p-4 md:p-6 bg-zinc-950 text-white select-none">
      
      {/* Left Column: Template Categories & Frame Layout Viewport */}
      <div className="flex-1 flex flex-col items-center">
        
        {/* Category Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl mb-4">
          {[
            { id: 'strip' as FrameCategory, label: '2x6 Strips' },
            { id: '4r' as FrameCategory, label: '4R Classic' },
            { id: 'a4' as FrameCategory, label: 'A4 Poster' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                const firstInCat = FRAME_TEMPLATES.find((t) => t.category === cat.id);
                if (firstInCat) onSelectTemplate(firstInCat);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                selectedCategory === cat.id
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/25'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template Selector Carousel */}
        <div className="flex items-center gap-3 overflow-x-auto max-w-full pb-3 mb-4">
          {filteredTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTemplate(t)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center gap-2 ${
                selectedTemplate.id === t.id
                  ? 'border-pink-500 bg-pink-500/15 text-pink-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              {t.name}
            </button>
          ))}
        </div>

        {/* Interactive Frame Canvas Preview */}
        <div
          className="relative w-72 md:w-80 shadow-2xl rounded-2xl overflow-hidden border-4 transition-all duration-300"
          style={{
            backgroundColor: selectedTemplate.backgroundColor,
            borderColor: selectedTemplate.accentColor,
            aspectRatio: selectedTemplate.category === 'strip' ? '1/3' : '2/3',
          }}
        >
          {/* Slots */}
          {selectedTemplate.slots.map((slot, idx) => {
            const adj = slotAdjustments[slot.id] || { photoIndex: idx % capturedPhotos.length, zoom: 1.0, panX: 0, panY: 0, filter: 'none' };
            const photoUrl = capturedPhotos[adj.photoIndex] || capturedPhotos[0];
            const isSelected = activeSlotId === slot.id;

            return (
              <div
                key={slot.id}
                onClick={() => setActiveSlotId(slot.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnSlot(slot.id)}
                className={`absolute cursor-pointer overflow-hidden rounded-lg transition-all ${
                  isSelected ? 'ring-4 ring-pink-500 z-20 scale-[1.02]' : 'ring-1 ring-zinc-400/40 z-10'
                }`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                }}
              >
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt={`Slot ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-100"
                    style={{
                      transform: `scale(${adj.zoom}) translate(${adj.panX}px, ${adj.panY}px)`,
                      filter:
                        adj.filter === 'bw'
                          ? 'grayscale(100%) contrast(120%)'
                          : adj.filter === 'vintage'
                          ? 'sepia(50%) contrast(90%)'
                          : adj.filter === 'warm'
                          ? 'sepia(30%) saturate(140%)'
                          : adj.filter === 'sepia'
                          ? 'sepia(85%)'
                          : adj.filter === 'cyberpunk'
                          ? 'contrast(130%) saturate(160%)'
                          : 'none',
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-500 font-bold">
                    Drop Photo #{idx + 1}
                  </div>
                )}

                {/* Slot Tag Indicator */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white uppercase backdrop-blur-xs">
                  Slot #{idx + 1}
                </div>
              </div>
            );
          })}

          {/* Footer Branding Text */}
          <div
            className="absolute bottom-2 inset-x-0 text-center font-bold text-[10px] tracking-wider uppercase opacity-80"
            style={{ color: selectedTemplate.textColor }}
          >
            ⚡ QUICKPIC PHOTOBOOTH
          </div>
        </div>
      </div>

      {/* Right Column: Photo Drawer & Pinch/Zoom + Filter Controls */}
      <div className="w-full lg:w-96 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between shadow-2xl">
        
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 text-pink-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" /> Position & Pinch Zoom
            </div>
            <h3 className="text-xl font-bold text-white">Adjust Selected Slot</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Drag any shot below to replace, then pinch or slide to frame your face.
            </p>
          </div>

          {/* Captured Photos Drawer (Draggable) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Your Captured Shots (Drag into slot)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {capturedPhotos.map((photo, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onClick={() => onUpdateSlotAdjustment(activeSlotId, { photoIndex: idx })}
                  className={`relative cursor-grab active:cursor-grabbing rounded-xl overflow-hidden aspect-4/3 border-2 transition ${
                    currentAdj.photoIndex === idx ? 'border-pink-500 ring-2 ring-pink-500/30' : 'border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`Pose ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 right-1 bg-black/70 px-1 rounded text-[9px] font-bold">
                    #{idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pinch & Zoom Controls */}
          <div className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-pink-400" /> Zoom / Face Framing
              </span>
              <span className="text-xs font-mono text-pink-400">{Math.round(currentAdj.zoom * 100)}%</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleZoomChange(currentAdj.zoom - 0.15)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.05"
                value={currentAdj.zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-full accent-pink-500 cursor-pointer"
              />
              <button
                onClick={() => handleZoomChange(currentAdj.zoom + 0.15)}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Position Pan Direction Buttons */}
            <div className="pt-2 flex items-center justify-between text-xs text-zinc-400">
              <span>Reposition Face:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateSlotAdjustment(activeSlotId, { panY: currentAdj.panY - 10 })}
                  className="px-2 py-1 bg-zinc-800 rounded hover:bg-zinc-700 text-[10px]"
                >
                  &uarr; Up
                </button>
                <button
                  onClick={() => onUpdateSlotAdjustment(activeSlotId, { panY: currentAdj.panY + 10 })}
                  className="px-2 py-1 bg-zinc-800 rounded hover:bg-zinc-700 text-[10px]"
                >
                  &darr; Down
                </button>
                <button
                  onClick={() => onUpdateSlotAdjustment(activeSlotId, { zoom: 1.0, panX: 0, panY: 0 })}
                  title="Reset Position"
                  className="p-1 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400 ml-1"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Slot Filter Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-pink-400" /> Slot Filter
            </label>
            <div className="grid grid-cols-3 gap-2">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFilterChange(f.id)}
                  className={`py-2 px-2.5 rounded-xl border text-[11px] font-medium transition ${
                    currentAdj.filter === f.id
                      ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Confirm Button */}
        <div className="pt-6 border-t border-zinc-800">
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold text-base rounded-2xl transition shadow-lg shadow-pink-500/25 active:scale-95"
          >
            <Check className="w-5 h-5" />
            Proceed to Print & Consent
          </button>
        </div>

      </div>

    </div>
  );
};
