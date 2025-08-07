(() => {
  const scene = document.getElementById('scene');
  const bugsLayer = document.querySelector('.layer.bugs');
  const bugsSvg = document.getElementById('bugs-svg');
  const head = bugsSvg ? bugsSvg.getElementById('head') : null;
  const eyeL = bugsSvg ? bugsSvg.getElementById('eyeL') : null;
  const eyeR = bugsSvg ? bugsSvg.getElementById('eyeR') : null;
  const pupilL = bugsSvg ? bugsSvg.getElementById('pupilL') : null;
  const pupilR = bugsSvg ? bugsSvg.getElementById('pupilR') : null;
  const hands = bugsSvg ? bugsSvg.getElementById('hands') : null;

  if (!scene || !bugsLayer || !bugsSvg || !head || !eyeL || !eyeR || !pupilL || !pupilR) {
    // Elements not ready; bail gracefully.
    return;
  }

  // Utility to get element's center in viewport coords
  function getElementCenter(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  // We'll animate head rotation and pupil offsets with easing
  let targetAngle = 0;
  let currentAngle = 0;

  // Pupil target offsets (relative to each eye center)
  const pupilTarget = { x: 0, y: 0 };
  const pupilCurrent = { x: 0, y: 0 };

  // Limitations for natural look
  const MAX_HEAD_DEG = 18; // degrees
  const MAX_PUPIL_OFFSET_X = 4.5;
  const MAX_PUPIL_OFFSET_Y = 4.0;

  // For subtle idle bobbing
  let startTime = performance.now();

  // Timid peek animation state
  let timidPhase = 0; // 0..1..0 loop
  let timidDir = 1;
  const TIMID_SPEED = 0.006; // smaller = slower
  const TIMID_MIN = -8; // px below baseline (hidden)
  const TIMID_MAX = 18; // px above baseline (peeking)

  // Mouse tracking
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  // Touch support - approximate with last touch point
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }, { passive: true });

  // Compute look direction each frame
  function updateTargets() {
    const headCenter = getElementCenter(bugsLayer);
    // Map to where the head roughly is inside the SVG (slightly above layer center)
    const headOrigin = {
      x: headCenter.x,
      y: headCenter.y - 30
    };

    const dx = mouse.x - headOrigin.x;
    const dy = mouse.y - headOrigin.y;

    const angleRad = Math.atan2(dy, dx);
    const angleDeg = angleRad * 180 / Math.PI;

    // Clamp head rotation around a neutral slight tilt
    targetAngle = clamp(angleDeg / 4, -MAX_HEAD_DEG, MAX_HEAD_DEG);

    // Pupils: project into per-eye local offsets
    // Normalized direction
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    pupilTarget.x = clamp(nx * MAX_PUPIL_OFFSET_X, -MAX_PUPIL_OFFSET_X, MAX_PUPIL_OFFSET_X);
    pupilTarget.y = clamp(ny * MAX_PUPIL_OFFSET_Y, -MAX_PUPIL_OFFSET_Y, MAX_PUPIL_OFFSET_Y);
  }

  // Easing / interpolation
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Apply transforms to SVG nodes
  function applyTransforms(time) {
    // Idle bobbing factor
    const bob = Math.sin((time - startTime) / 900) * 1.2;

    // Smooth head rotation
    currentAngle = lerp(currentAngle, targetAngle, 0.12);

    // Timid peek progress (y offset)
    if (bugsLayer.classList.contains('timid')) {
      timidPhase += timidDir * TIMID_SPEED * Math.max(0.5, 1.5 - Math.abs(pupilTarget.x)); // peek slower if looking sideways
      if (timidPhase > 1) { timidPhase = 1; timidDir = -1; }
      if (timidPhase < 0) { timidPhase = 0; timidDir = 1; }
    } else {
      timidPhase = 1; // fully visible if not timid
    }
    // Ease in-out
    const t = 0.5 - 0.5 * Math.cos(Math.PI * timidPhase);
    const timidY = TIMID_MIN + (TIMID_MAX - TIMID_MIN) * t;

    // Head transform (peeking with bob)
    const headTransform = `translate(110,${130 + bob - timidY}) rotate(${currentAngle})`;
    head.setAttribute('transform', headTransform);

    // Hands follow similar timid Y
    if (hands) {
      hands.setAttribute('transform', `translate(110,${210 - timidY})`);
    }

    // Smooth pupils
    pupilCurrent.x = lerp(pupilCurrent.x, pupilTarget.x, 0.18);
    pupilCurrent.y = lerp(pupilCurrent.y, pupilTarget.y, 0.18);

    // Move each pupil relative to its eye center
    const eyeL_cx = parseFloat(eyeL.getAttribute('cx'));
    const eyeL_cy = parseFloat(eyeL.getAttribute('cy'));
    const eyeR_cx = parseFloat(eyeR.getAttribute('cx'));
    const eyeR_cy = parseFloat(eyeR.getAttribute('cy'));

    pupilL.setAttribute('cx', (eyeL_cx + pupilCurrent.x).toFixed(2));
    pupilL.setAttribute('cy', (eyeL_cy + pupilCurrent.y).toFixed(2));
    pupilR.setAttribute('cx', (eyeR_cx + pupilCurrent.x).toFixed(2));
    pupilR.setAttribute('cy', (eyeR_cy + pupilCurrent.y).toFixed(2));
  }

  // Subtle parallax for layers with data-depth
  const depthLayers = Array.from(document.querySelectorAll('[data-depth]'));
  function applyParallax() {
    const cx = window.innerWidth / 2;
    const dx = (mouse.x - cx) / cx; // -1..1
    depthLayers.forEach((el) => {
      const depth = parseFloat(el.getAttribute('data-depth') || '0');
      // translateX a small amount based on depth
      const maxShift = 20; // px
      const shift = -dx * depth * maxShift;
      el.style.transform = `translateX(${shift}px)`;
    });
  }

  // Resize handler to keep things centered
  function onResize() {
    // No explicit action needed; layout is responsive.
  }
  window.addEventListener('resize', onResize);

  // Animation loop
  function tick(time) {
    updateTargets();
    applyTransforms(time);
    applyParallax();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
