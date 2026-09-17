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

  // Preloaded image storage for all 300 frames
  const frameImages = new Array(TOTAL_FRAMES);
  let loadedFrames = 0;

  // Animation & scroll state
  let currentFrame = 0;
  let targetFrame = 0;
  let lastRenderedFrame = -1;
  let isReady = false;

  // Path generator for exact zero-padded filename
  function getFramePath(index) {
    const padded = String(index).padStart(6, '0');
    return `${FRAME_DIR}/${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  // Preload all 300 frames sequentially without skipping any frame
  function preloadAllFrames() {
    return new Promise((resolve) => {
      // First frame for instant render
      const firstImg = new Image();
      firstImg.src = getFramePath(0);
      firstImg.onload = () => {
        frameImages[0] = firstImg;
        loadedFrames++;
        renderFrame(0);
        updateProgress();

        let remaining = TOTAL_FRAMES - 1;
        for (let i = 1; i < TOTAL_FRAMES; i++) {
          const img = new Image();
          img.src = getFramePath(i);

          const onFinish = () => {
            loadedFrames++;
            updateProgress();
            remaining--;
            if (remaining === 0) {
              resolve();
            }
          };

          img.onload = () => {
            frameImages[i] = img;
            onFinish();
          };

          img.onerror = () => {
            console.error(`Could not load frame ${i}`);
            onFinish();
          };
        }
      };

      firstImg.onerror = () => {
        console.error('Could not load initial frame 0');
        resolve();
      };
    });
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
    const img = frameImages[clampedIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    if (clampedIndex === lastRenderedFrame) return;
    lastRenderedFrame = clampedIndex;

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
      hudFrame.textContent = `Frame: ${String(clampedIndex + 1).padStart(3, '0')} / ${TOTAL_FRAMES}`;
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

  // Single-profile portfolio: Devesh Singh
  function setupProfileToggle() {
    // Profile toggle removed by design; Devesh is the only profile.
  }

  // Initialize
  window.addEventListener('DOMContentLoaded', async () => {
    setupProfileToggle();
    resizeCanvas();
    updateScroll();
    requestAnimationFrame(animationLoop);

    await preloadAllFrames();

    isReady = true;
    updateScroll();
    currentFrame = targetFrame;
    renderFrame(Math.round(currentFrame));

    setTimeout(() => {
      loader.classList.add('loaded');
    }, 200);
  });
})();
