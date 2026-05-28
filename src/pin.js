// ============================================================
// JACKDAW - Pin Window (referinta flotanta cu zoom)
// La zoom 1: drag = muta fereastra (prin IPC, nu app-region, ca scroll-ul sa mearga)
// La zoom > 1: drag = pan in imagine
// ============================================================
const frame = document.getElementById('frame');
const img = document.getElementById('img');
const closeBtn = document.getElementById('close');
const zoomBadge = document.getElementById('zoom-badge');

let zoom = 1;
let panX = 0, panY = 0;
let dragging = false;       // mutam fereastra
let panning = false;        // pan in imagine
let lastX = 0, lastY = 0;   // pentru mutarea ferestrei (delta)
let startX = 0, startY = 0; // pentru pan

window.jackdaw.onPinImage((dataUrl) => { img.src = dataUrl; });

function applyTransform() {
  img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  frame.classList.toggle('zoomed', zoom > 1);
}

function showZoomBadge() {
  zoomBadge.textContent = Math.round(zoom * 100) + '%';
  zoomBadge.classList.add('show');
  clearTimeout(showZoomBadge._t);
  showZoomBadge._t = setTimeout(() => zoomBadge.classList.remove('show'), 900);
}

// SCROLL = zoom (pe window, fara app-region care l-ar fura)
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.2 : 1 / 1.2;
  const prev = zoom;
  zoom = Math.min(Math.max(zoom * delta, 1), 10);
  const ratio = zoom / prev;
  panX *= ratio;
  panY *= ratio;
  if (zoom === 1) { panX = 0; panY = 0; }
  applyTransform();
  showZoomBadge();
}, { passive: false });

// MOUSEDOWN: decide daca mutam fereastra (zoom 1) sau facem pan (zoom > 1)
frame.addEventListener('mousedown', (e) => {
  if (e.target === closeBtn || e.target.classList.contains('resize-edge')) return;
  if (zoom > 1) {
    panning = true;
    frame.classList.add('grabbing');
    startX = e.clientX - panX;
    startY = e.clientY - panY;
  } else {
    dragging = true;
    frame.classList.add('grabbing');
    lastX = e.screenX;
    lastY = e.screenY;
  }
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (panning) {
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  } else if (dragging) {
    // Mutam fereastra cu delta-ul miscarii mouse-ului (coordonate ecran)
    const dx = e.screenX - lastX;
    const dy = e.screenY - lastY;
    lastX = e.screenX;
    lastY = e.screenY;
    window.jackdaw.movePinWindow({ dx, dy });
  }
});

window.addEventListener('mouseup', () => {
  panning = false;
  dragging = false;
  frame.classList.remove('grabbing');
});

// Dublu-click = reset zoom
frame.addEventListener('dblclick', (e) => {
  if (e.target === closeBtn) return;
  zoom = 1; panX = 0; panY = 0;
  applyTransform();
  showZoomBadge();
});

closeBtn.addEventListener('click', () => window.jackdaw.closePinWindow());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.jackdaw.closePinWindow();
});
