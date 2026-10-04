/* Performance-tuned 300-frame controller — same visual system, lighter initial load. */
(() => {
  const TOTAL_FRAMES = 300;
  const FRAME_DIR = 'video_frames';
  const FRAME_PREFIX = 'frame_';
  const FRAME_EXT = '.png';

  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderStatus = document.getElementById('loader-status');
  const hudFrame = document.getElementById('hud-frame');
  const scrollProgressBar = document.getElementById('scroll-progress');

  // Frame cache: only nearby frames are loaded initially; the rest stream in on demand.
  const frameImages = new Array(TOTAL_FRAMES);
  const loadingFrames = new Set();
  let loadedFrames = 0;
  let initialReady = false;

  // Animation & scroll state
  let currentFrame = 0;
  let targetFrame = 0;
  let lastRenderedFrame = -1;
  let isReady = false;

  // Path generator for exact zero-padded filename (frame_000000.png to frame_000299.png)
  function getFramePath(index) {
    const padded = String(index).padStart(6, '0');
    return `${FRAME_DIR}/${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  function loadFrame(index) {
    if (index < 0 || index >= TOTAL_FRAMES || frameImages[index] || loadingFrames.has(index)) return;
    loadingFrames.add(index);

    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = getFramePath(index);

    img.onload = async () => {
      try { await img.decode(); } catch (_) {}
      frameImages[index] = img;
      loadedFrames++;
      loadingFrames.delete(index);
      updateProgress();
      if (!initialReady && index <= 7) renderFrame(index);
    };
    img.onerror = () => {
      loadingFrames.delete(index);
      updateProgress();
    };
  }

  function preloadInitialFrames() {
    // First 8 frames give an immediate hero; remaining frames are requested after paint.
    for (let i = 0; i < 8; i++) loadFrame(i);
    setTimeout(scheduleNearbyFrames, 0);
  }

  let lastScheduledCenter = -999;
  function scheduleNearbyFrames() {
    const center = Math.round(targetFrame);
    if (Math.abs(center - lastScheduledCenter) < 6) return;
    lastScheduledCenter = center;
    const center = Math.round(targetFrame);
    for (let offset = -12; offset <= 12; offset++) loadFrame(center + offset);

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        for (let i = 0; i < TOTAL_FRAMES; i += 1) loadFrame(i);
      }, { timeout: 1800 });
    } else {
      setTimeout(() => {
        for (let i = 0; i < TOTAL_FRAMES; i += 1) loadFrame(i);
      }, 900);
    }
  }

  function getBestAvailableFrame(index) {
    if (frameImages[index]) return index;
    for (let d = 1; d < TOTAL_FRAMES; d++) {
      if (frameImages[index - d]) return index - d;
      if (frameImages[index + d]) return index + d;
    }
    return -1;
  }

  function updateProgress() {
    const progress = Math.floor((loadedFrames / TOTAL_FRAMES) * 100);
    loaderBar.style.width = `${progress}%`;
    loaderStatus.textContent = `${loadedFrames} / ${TOTAL_FRAMES} frames (${progress}%)`;
  }

  // Responsive High-DPI Canvas Resizing
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    lastRenderedFrame = -1;
    renderFrame(Math.round(currentFrame));
  }

  // Draw image with aspect-ratio preserving cover mode
  function renderFrame(index) {
    const clampedIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, index));
    const availableIndex = getBestAvailableFrame(clampedIndex);
    if (availableIndex < 0) return;
    const img = frameImages[availableIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    if (availableIndex === lastRenderedFrame) return;
    lastRenderedFrame = availableIndex;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;

    const imgAspect = iw / ih;
    const canvasAspect = cw / ch;

    let drawW, drawH, drawX, drawY;

    if (canvasAspect > imgAspect) {
      drawW = cw;
      drawH = cw / imgAspect;
      drawX = 0;
      drawY = (ch - drawH) / 2;
    } else {
      drawH = ch;
      drawW = ch * imgAspect;
      drawX = (cw - drawW) / 2;
      drawY = 0;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Live HUD Frame Counter
    if (hudFrame) {
      hudFrame.textContent = `Frame: ${String(availableIndex + 1).padStart(3, '0')} / ${TOTAL_FRAMES}`;
    }
  }

  // Calculate target frame from total page scroll
  function updateScroll() {
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) {
      targetFrame = 0;
      return;
    }

    const scrollFraction = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    targetFrame = scrollFraction * (TOTAL_FRAMES - 1);
    scheduleNearbyFrames();

    // Top progress bar update
    if (scrollProgressBar) {
      scrollProgressBar.style.width = `${(scrollFraction * 100).toFixed(1)}%`;
    }
  }

  // Main animation loop with sub-pixel LERP smoothing
  function animationLoop() {
    if (isReady) {
      const diff = targetFrame - currentFrame;
      if (Math.abs(diff) > 0.005) {
        currentFrame += diff * 0.12; // Buttery fluid damping
      } else {
        currentFrame = targetFrame;
      }
      renderFrame(Math.round(currentFrame));
    }

    requestAnimationFrame(animationLoop);
  }

  // Arrow Key navigation
  window.addEventListener('keydown', (e) => {
    if (!isReady) return;
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    const scrollPerFrame = maxScroll / (TOTAL_FRAMES - 1);

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      window.scrollBy({ top: scrollPerFrame, behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      window.scrollBy({ top: -scrollPerFrame, behavior: 'smooth' });
    }
  });

  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', resizeCanvas);

  // Initialize
  window.addEventListener('DOMContentLoaded', async () => {
    resizeCanvas();
    updateScroll();
    requestAnimationFrame(animationLoop);

    preloadInitialFrames();

    // Don't block the portfolio behind all 300 requests.
    setTimeout(() => {
      isReady = true;
      initialReady = true;
      updateScroll();
      currentFrame = targetFrame;
      renderFrame(Math.round(currentFrame));
      loader.classList.add('loaded');
    }, 120);
  });
})();
