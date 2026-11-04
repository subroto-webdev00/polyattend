'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const clamp = (v) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

const BTN = {
  width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(15,23,42,0.75)', color: '#fff', fontSize: 20, lineHeight: 1,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

// Full-screen image viewer: zoom (buttons, mouse wheel, double-click, pinch),
// drag to pan while zoomed, download, Esc / backdrop click to close.
export default function ImageViewer({ src, alt = '', onClose }) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map());
  const pinchStart = useRef(null); // { dist, scale }

  useEffect(() => { setMounted(true); }, []);

  // Esc closes; page behind stops scrolling while the viewer is open.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === '+' || e.key === '=') zoomBy(1.4);
      if (e.key === '-') zoomBy(1 / 1.4);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setScaleSafe = (next) => {
    const s = clamp(next);
    setScale(s);
    if (s === 1) setPos({ x: 0, y: 0 });
  };
  const zoomBy = (f) => setScale(cur => {
    const s = clamp(cur * f);
    if (s === 1) setPos({ x: 0, y: 0 });
    return s;
  });
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
    if (scale > 1) setDragging(true);
  };
  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setScaleSafe(pinchStart.current.scale * (dist / pinchStart.current.dist));
    } else if (pointers.current.size === 1 && scale > 1) {
      setPos(p => ({ x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) setDragging(false);
  };

  const download = async () => {
    const name = decodeURIComponent((src || '').split('?')[0].split('/').pop() || '') || 'notice-image';
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error('bad response');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      window.open(src, '_blank', 'noopener');
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(2,6,23,0.92)', display: 'flex', flexDirection: 'column' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      {/* toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: 12 }}>
        <span style={{ color: '#cbd5e1', fontSize: 12, marginRight: 'auto', paddingLeft: 4 }}>{Math.round(scale * 100)}%</span>
        <button type="button" style={BTN} onClick={() => zoomBy(1 / 1.4)} disabled={scale <= MIN_SCALE} title="Zoom out (-)" aria-label="Zoom out">−</button>
        <button type="button" style={BTN} onClick={() => zoomBy(1.4)} disabled={scale >= MAX_SCALE} title="Zoom in (+)" aria-label="Zoom in">+</button>
        <button type="button" style={{ ...BTN, fontSize: 12 }} onClick={reset} title="Reset" aria-label="Reset zoom">1:1</button>
        <button type="button" style={BTN} onClick={download} title="Download" aria-label="Download image">⬇</button>
        <button type="button" style={BTN} onClick={onClose} title="Close (Esc)" aria-label="Close">✕</button>
      </div>

      {/* image stage */}
      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' }}
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onDoubleClick={() => (scale > 1 ? reset() : setScaleSafe(2.5))}
          style={{
            maxWidth: '96%', maxHeight: '96%', objectFit: 'contain', userSelect: 'none',
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.12s ease-out',
            cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
        />
      </div>
    </div>,
    document.body
  );
}
