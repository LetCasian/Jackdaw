// ============================================================
// JACKDAW - Renderer
// ============================================================

let state = {
  collections: [],
  activeId: null,
  columns: 3,
  searchQuery: ''
};

const GRADIENTS = [
  { from: '#2d2438', to: '#1e1828' },
  { from: '#1f3a4d', to: '#15293a' },
  { from: '#3a1f4d', to: '#29153a' },
  { from: '#1f4d3a', to: '#15392a' },
  { from: '#4d3a1f', to: '#392a15' },
  { from: '#4d1f3a', to: '#39152a' },
  { from: '#1f4d4d', to: '#153939' }
];

const groupsContainer = document.getElementById('groups-container');
const emptyState = document.getElementById('empty-state');
const dropOverlay = document.getElementById('drop-overlay');
const toast = document.getElementById('toast');
const previewOverlay = document.getElementById('preview-overlay');
const previewImage = document.getElementById('preview-image');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const aboutOverlay = document.getElementById('about-overlay');

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function showToast(message, duration = 2000) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
}

let saveTimer = null;
function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 800);
}

async function saveState() {
  try {
    const cleanState = {
      collections: state.collections.map(c => ({
        id: c.id,
        name: c.name,
        gradient: c.gradient,
        collapsed: c.collapsed,
        hidden: c.hidden,
        items: c.items.map(item => ({
          id: item.id,
          type: item.type,
          src: item.src,
          name: item.name,
          text: item.text,
          rotation: item.rotation || 0,
          flipH: item.flipH || false,
          flipV: item.flipV || false
        }))
      })),
      activeId: state.activeId,
      columns: state.columns
    };
    await window.jackdaw.saveData(cleanState);
  } catch (e) { console.error('Save error:', e); showToast('Save failed'); }
}

async function loadState() {
  try {
    const data = await window.jackdaw.loadData();
    if (data) {
      const items = data.collections || data.groups || [];
      state.collections = items.map(c => ({
        ...c,
        items: (c.items || []).map(i => ({
          rotation: 0, flipH: false, flipV: false, ...i
        }))
      }));
      state.activeId = data.activeId || data.activeGroupId || (state.collections[0]?.id || null);
      state.columns = data.columns || 3;
    }
  } catch (e) { console.error('Load error:', e); }
}

// ------------------------------------------------------------
// Aplica transformari (rotire/flip) pe o imagine si returneaza
// un dataURL nou. Folosit pentru drag-out spre Photoshop, ca
// imaginea trasa sa includa transformarile vizibile.
// ------------------------------------------------------------
function getTransformedDataUrl(item) {
  return new Promise((resolve) => {
    const rotation = item.rotation || 0;
    const flipH = item.flipH || false;
    const flipV = item.flipV || false;
    // Daca nu exista transformari, returnam originalul direct
    if (rotation === 0 && !flipH && !flipV) {
      resolve(item.src);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rad = (rotation % 360) * Math.PI / 180;
      const is90 = (rotation % 180) !== 0;
      canvas.width = is90 ? img.height : img.width;
      canvas.height = is90 ? img.width : img.height;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(item.src);
    img.src = item.src;
  });
}

function transformStyle(item) {
  const parts = [];
  if (item.rotation) parts.push(`rotate(${item.rotation}deg)`);
  if (item.flipH) parts.push('scaleX(-1)');
  if (item.flipV) parts.push('scaleY(-1)');
  return parts.join(' ');
}

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------
function render() {
  groupsContainer.innerHTML = '';

  const query = state.searchQuery.toLowerCase().trim();
  const filtered = query
    ? state.collections.filter(c => c.name.toLowerCase().includes(query) ||
        c.items.some(i => i.type === 'note' && (i.text || '').toLowerCase().includes(query)))
    : state.collections;

  emptyState.classList.toggle('hidden', state.collections.length !== 0);

  filtered.forEach(collection => {
    if (collection.hidden) return;
    groupsContainer.appendChild(renderCollection(collection));
  });
}

function renderCollection(collection) {
  const el = document.createElement('div');
  el.className = 'group';
  el.dataset.groupId = collection.id;

  const header = document.createElement('div');
  header.className = 'group-header';
  if (collection.id === state.activeId) header.classList.add('active');
  header.style.setProperty('--gradient-from', collection.gradient.from);
  header.style.setProperty('--gradient-to', collection.gradient.to);

  const headerLeft = document.createElement('div');
  headerLeft.className = 'group-header-left';

  const eyeBtn = document.createElement('button');
  eyeBtn.className = 'group-action';
  eyeBtn.title = collection.hidden ? 'Show collection' : 'Hide collection';
  eyeBtn.innerHTML = collection.hidden ? svgEyeOff() : svgEye();
  eyeBtn.onclick = (e) => {
    e.stopPropagation();
    collection.hidden = !collection.hidden;
    scheduleAutoSave();
    render();
  };
  headerLeft.appendChild(eyeBtn);

  const countBadge = document.createElement('span');
  countBadge.className = 'group-count';
  countBadge.textContent = collection.items.length;
  headerLeft.appendChild(countBadge);

  const title = document.createElement('div');
  title.className = 'group-title';
  title.textContent = collection.name;
  title.title = 'Double-click to rename';
  title.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    title.contentEditable = 'true';
    title.focus();
    document.execCommand('selectAll', false, null);
  });
  title.addEventListener('blur', () => {
    title.contentEditable = 'false';
    collection.name = (title.textContent.trim() || 'COLLECTION').toUpperCase();
    title.textContent = collection.name;
    scheduleAutoSave();
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
    if (e.key === 'Escape') { title.textContent = collection.name; title.blur(); }
  });

  const headerRight = document.createElement('div');
  headerRight.className = 'group-header-right';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'group-action';
  deleteBtn.title = 'Delete collection';
  deleteBtn.innerHTML = svgTrash();
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (collection.items.length > 0) {
      if (!confirm(`Delete "${collection.name}" with ${collection.items.length} item(s)?`)) return;
    }
    state.collections = state.collections.filter(c => c.id !== collection.id);
    if (state.activeId === collection.id) state.activeId = state.collections[0]?.id || null;
    scheduleAutoSave();
    render();
  };
  headerRight.appendChild(deleteBtn);

  const chevronBtn = document.createElement('button');
  chevronBtn.className = 'group-action';
  chevronBtn.title = collection.collapsed ? 'Expand' : 'Collapse';
  chevronBtn.innerHTML = collection.collapsed ? svgChevronRight() : svgChevronDown();
  chevronBtn.onclick = (e) => {
    e.stopPropagation();
    collection.collapsed = !collection.collapsed;
    scheduleAutoSave();
    render();
  };
  headerRight.appendChild(chevronBtn);

  header.appendChild(headerLeft);
  header.appendChild(title);
  header.appendChild(headerRight);

  header.addEventListener('click', (e) => {
    if (e.target.closest('.group-action') || e.target === title) return;
    state.activeId = collection.id;
    collection.collapsed = !collection.collapsed;
    scheduleAutoSave();
    render();
  });

  el.appendChild(header);

  if (!collection.collapsed && collection.items.length > 0) {
    const grid = document.createElement('div');
    grid.className = 'group-images';
    grid.style.setProperty('--cols', state.columns);
    collection.items.forEach(item => {
      if (item.type === 'image') grid.appendChild(renderImageCard(collection, item));
      else if (item.type === 'note') grid.appendChild(renderNoteCard(collection, item));
    });
    el.appendChild(grid);
  }

  return el;
}

function renderImageCard(collection, item) {
  const card = document.createElement('div');
  card.className = 'img-card';
  card.dataset.itemId = item.id;
  card.dataset.groupId = collection.id;

  // Wrapper pentru transformari (rotire/flip aplicate vizual)
  const imgWrap = document.createElement('div');
  imgWrap.className = 'img-wrap';

  const img = document.createElement('img');
  img.src = item.src;
  img.alt = item.name || '';
  img.loading = 'lazy';
  img.style.transform = transformStyle(item);
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  // --- Toolbar de editare (apare pe hover) ---
  const editBar = document.createElement('div');
  editBar.className = 'img-edit-bar';

  const btnRotL = document.createElement('button');
  btnRotL.className = 'img-edit-btn';
  btnRotL.title = 'Rotate left';
  btnRotL.innerHTML = svgRotateLeft();
  btnRotL.onclick = (e) => {
    e.stopPropagation();
    item.rotation = ((item.rotation || 0) - 90 + 360) % 360;
    img.style.transform = transformStyle(item);
    scheduleAutoSave();
  };

  const btnRotR = document.createElement('button');
  btnRotR.className = 'img-edit-btn';
  btnRotR.title = 'Rotate right';
  btnRotR.innerHTML = svgRotateRight();
  btnRotR.onclick = (e) => {
    e.stopPropagation();
    item.rotation = ((item.rotation || 0) + 90) % 360;
    img.style.transform = transformStyle(item);
    scheduleAutoSave();
  };

  const btnFlipH = document.createElement('button');
  btnFlipH.className = 'img-edit-btn';
  btnFlipH.title = 'Flip horizontal';
  btnFlipH.innerHTML = svgFlipH();
  btnFlipH.onclick = (e) => {
    e.stopPropagation();
    item.flipH = !item.flipH;
    img.style.transform = transformStyle(item);
    btnFlipH.classList.toggle('active', item.flipH);
    scheduleAutoSave();
  };
  if (item.flipH) btnFlipH.classList.add('active');

  const btnFlipV = document.createElement('button');
  btnFlipV.className = 'img-edit-btn';
  btnFlipV.title = 'Flip vertical';
  btnFlipV.innerHTML = svgFlipV();
  btnFlipV.onclick = (e) => {
    e.stopPropagation();
    item.flipV = !item.flipV;
    img.style.transform = transformStyle(item);
    btnFlipV.classList.toggle('active', item.flipV);
    scheduleAutoSave();
  };
  if (item.flipV) btnFlipV.classList.add('active');

  editBar.append(btnRotL, btnRotR, btnFlipH, btnFlipV);
  card.appendChild(editBar);

  // --- Actiuni: sterge ---
  const actions = document.createElement('div');
  actions.className = 'img-actions';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'img-action-btn danger';
  deleteBtn.title = 'Remove';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    collection.items = collection.items.filter(i => i.id !== item.id);
    scheduleAutoSave();
    render();
  };
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  // Buton dedicat de drag-out spre Photoshop (apare pe hover, sus-stanga)
  const dragHandle = document.createElement('button');
  dragHandle.className = 'img-drag-handle';
  dragHandle.title = 'Drag to Photoshop (or click to copy)';
  dragHandle.innerHTML = svgDragOut();
  // Click pe handle = copiaza imaginea in clipboard (plasa de siguranta)
  dragHandle.onclick = async (e) => {
    e.stopPropagation();
    try {
      const transformedUrl = await getTransformedDataUrl(item);
      const blob = await (await fetch(transformedUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('Copied — paste into Photoshop (Ctrl+V)');
    } catch (err) {
      console.error(err);
      showToast('Could not copy');
    }
  };
  card.appendChild(dragHandle);

  // Dublu-click -> preview cu zoom
  card.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    openPreview(item);
  });

  // --- DRAG NATIV spre Photoshop / aplicatii externe ---
  // startDrag-ul Electron porneste un drag de FISIER pe care Photoshop il accepta.
  // Il declansam din dragstart, fara preventDefault (asta era bug-ul vechi).
  card.draggable = true;
  card.addEventListener('dragstart', async (e) => {
    if (e.target.closest('.img-edit-btn, .img-action-btn, .img-drag-handle')) {
      e.preventDefault();
      return;
    }
    // Date pentru mutarea interna intre colectii (drop in interiorul app-ului)
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'move', fromGroup: collection.id, itemId: item.id
    }));
    e.dataTransfer.effectAllowed = 'copyMove';

    // Pentru drag spre EXTERIOR (Photoshop): pregatim fisierul si pornim
    // drag-ul nativ Electron. Acesta preia controlul de la HTML5 drag.
    const transformedUrl = await getTransformedDataUrl(item);
    window.jackdaw.startDrag({ dataUrl: transformedUrl, id: item.id });
  });

  card.addEventListener('dragend', () => { card.style.opacity = '1'; });

  return card;
}

function renderNoteCard(collection, item) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.dataset.itemId = item.id;

  const textarea = document.createElement('textarea');
  textarea.value = item.text || '';
  textarea.placeholder = 'A note for later...';
  textarea.addEventListener('input', (e) => {
    item.text = e.target.value;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    scheduleAutoSave();
  });
  setTimeout(() => { textarea.style.height = textarea.scrollHeight + 'px'; }, 0);
  card.appendChild(textarea);

  const actions = document.createElement('div');
  actions.className = 'img-actions';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'img-action-btn danger';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    collection.items = collection.items.filter(i => i.id !== item.id);
    scheduleAutoSave();
    render();
  };
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  return card;
}

// ------------------------------------------------------------
// ACTIONS
// ------------------------------------------------------------
function addCollection(name) {
  const number = state.collections.length + 1;
  const newCol = {
    id: uid(),
    name: (name || `COLLECTION ${number}`).toUpperCase(),
    gradient: GRADIENTS[state.collections.length % GRADIENTS.length],
    collapsed: false,
    hidden: false,
    items: []
  };
  state.collections.push(newCol);
  state.activeId = newCol.id;
  scheduleAutoSave();
  render();
  setTimeout(() => {
    const titleEl = groupsContainer.querySelector(`[data-group-id="${newCol.id}"] .group-title`);
    if (titleEl) {
      titleEl.contentEditable = 'true';
      titleEl.focus();
      document.execCommand('selectAll', false, null);
    }
  }, 50);
}

function getActiveCollection() {
  if (!state.activeId && state.collections.length > 0) state.activeId = state.collections[0].id;
  if (!state.activeId) addCollection('COLLECTED');
  return state.collections.find(c => c.id === state.activeId);
}

function addImagesToActive(images) {
  const collection = getActiveCollection();
  if (!collection) return;
  images.forEach(img => {
    collection.items.push({
      id: uid(), type: 'image', src: img.dataUrl || img.src, name: img.name || '',
      rotation: 0, flipH: false, flipV: false
    });
  });
  collection.collapsed = false;
  collection.hidden = false;
  scheduleAutoSave();
  render();
  showToast(`${images.length} added to "${collection.name}"`);
}

function addNoteToActive() {
  const collection = getActiveCollection();
  if (!collection) return;
  collection.items.push({ id: uid(), type: 'note', text: '' });
  collection.collapsed = false;
  scheduleAutoSave();
  render();
  setTimeout(() => {
    const cards = groupsContainer.querySelectorAll(`[data-group-id="${collection.id}"] .note-card textarea`);
    const lastCard = cards[cards.length - 1];
    if (lastCard) lastCard.focus();
  }, 50);
}

// ------------------------------------------------------------
// TOOLBAR
// ------------------------------------------------------------
document.getElementById('tool-add-image').onclick = async () => {
  try {
    const images = await window.jackdaw.selectImages();
    if (images.length > 0) addImagesToActive(images);
  } catch (e) { console.error(e); showToast('Could not select images'); }
};
document.getElementById('tool-add-group').onclick = () => addCollection();
document.getElementById('tool-add-note').onclick = () => {
  if (state.collections.length === 0) addCollection('NOTES');
  addNoteToActive();
};
document.getElementById('tool-show-all').onclick = () => {
  state.collections.forEach(c => { c.hidden = false; c.collapsed = false; });
  scheduleAutoSave(); render(); showToast('All collections visible');
};
document.getElementById('tool-hide-all').onclick = () => {
  state.collections.forEach(c => { c.collapsed = true; });
  scheduleAutoSave(); render(); showToast('All collections collapsed');
};
document.getElementById('tool-columns').onclick = () => {
  state.columns = state.columns >= 5 ? 2 : state.columns + 1;
  scheduleAutoSave(); render(); showToast(`${state.columns} columns`);
};
document.getElementById('tool-search').onclick = () => {
  searchBar.classList.toggle('visible');
  if (searchBar.classList.contains('visible')) searchInput.focus();
  else { searchInput.value = ''; state.searchQuery = ''; render(); }
};
document.getElementById('tool-about').onclick = () => aboutOverlay.classList.add('visible');
document.getElementById('about-close').onclick = () => aboutOverlay.classList.remove('visible');
aboutOverlay.addEventListener('click', (e) => { if (e.target === aboutOverlay) aboutOverlay.classList.remove('visible'); });

searchInput.addEventListener('input', (e) => { state.searchQuery = e.target.value; render(); });
document.getElementById('search-close').onclick = () => {
  searchBar.classList.remove('visible'); searchInput.value = ''; state.searchQuery = ''; render();
};

document.getElementById('btn-minimize').onclick = () => window.jackdaw.minimizeWindow();
document.getElementById('btn-maximize').onclick = () => window.jackdaw.maximizeWindow();
document.getElementById('btn-close').onclick = () => window.jackdaw.closeWindow();

const pinBtn = document.getElementById('btn-pin');
pinBtn.onclick = async () => {
  const isOnTop = await window.jackdaw.toggleAlwaysOnTop();
  pinBtn.classList.toggle('active', isOnTop);
  showToast(isOnTop ? 'Pinned on top' : 'Released');
};
window.jackdaw.getAlwaysOnTop().then(isOnTop => pinBtn.classList.toggle('active', isOnTop));

const opacityBtn = document.getElementById('btn-opacity');
const opacitySlider = document.getElementById('opacity-slider');
opacityBtn.onclick = () => opacitySlider.classList.toggle('visible');
opacitySlider.addEventListener('input', (e) => window.jackdaw.setOpacity(e.target.value / 100));

// ------------------------------------------------------------
// PREVIEW cu ZOOM (scroll) si PAN (drag)
// ------------------------------------------------------------
let pvZoom = 1, pvX = 0, pvY = 0;
let pvBaseTransform = '';
let pvPanning = false, pvStartX = 0, pvStartY = 0;
const zoomHint = document.getElementById('preview-zoom-hint');

function applyPreviewTransform() {
  previewImage.style.transform =
    `translate(${pvX}px, ${pvY}px) scale(${pvZoom}) ${pvBaseTransform}`;
}

function openPreview(item) {
  previewImage.src = item.src;
  // Pastram rotirea/flip-ul imaginii ca baza, peste care aplicam zoom/pan
  pvBaseTransform = transformStyle(item);
  pvZoom = 1; pvX = 0; pvY = 0;
  applyPreviewTransform();
  previewOverlay.classList.add('visible');
  zoomHint.style.opacity = '1';
}

function closePreview() {
  previewOverlay.classList.remove('visible');
}

document.getElementById('preview-close').onclick = closePreview;

// Click pe fundal (nu pe imagine) inchide preview-ul
previewOverlay.addEventListener('click', (e) => {
  if (e.target === previewOverlay) closePreview();
});

// SCROLL = zoom (centrat, fiabil)
previewOverlay.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomHint.style.opacity = '0';
  const delta = e.deltaY < 0 ? 1.2 : 1 / 1.2;
  const prevZoom = pvZoom;
  pvZoom = Math.min(Math.max(pvZoom * delta, 1), 8);
  // Ajustam pan-ul proportional ca zoom-ul sa para centrat pe ce vedeai
  const ratio = pvZoom / prevZoom;
  pvX *= ratio;
  pvY *= ratio;
  if (pvZoom === 1) { pvX = 0; pvY = 0; }
  applyPreviewTransform();
}, { passive: false });

// DRAG = pan (cand e zoom-at)
previewImage.addEventListener('mousedown', (e) => {
  if (pvZoom <= 1) return;
  pvPanning = true;
  pvStartX = e.clientX - pvX;
  pvStartY = e.clientY - pvY;
  previewImage.classList.add('grabbing');
  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!pvPanning) return;
  pvX = e.clientX - pvStartX;
  pvY = e.clientY - pvStartY;
  applyPreviewTransform();
});
window.addEventListener('mouseup', () => {
  pvPanning = false;
  previewImage.classList.remove('grabbing');
});

// Dublu-click pe imagine = reset zoom
previewImage.addEventListener('dblclick', (e) => {
  e.stopPropagation();
  pvZoom = 1; pvX = 0; pvY = 0;
  applyPreviewTransform();
  zoomHint.style.opacity = '1';
});


// ------------------------------------------------------------
// DRAG & DROP IN (din Photoshop / File Explorer / browser / Pinterest)
// ------------------------------------------------------------
let dragCounter = 0;
function isImageDrag(e) {
  const t = e.dataTransfer.types;
  return t.includes('Files') || t.includes('text/uri-list') || t.includes('text/html') || t.includes('text/plain');
}
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if (isImageDrag(e)) { dragCounter++; dropOverlay.classList.add('visible'); }
});
document.addEventListener('dragleave', (e) => {
  if (isImageDrag(e)) {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.remove('visible'); }
  }
});
document.addEventListener('dragover', (e) => { e.preventDefault(); });
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('visible');

  // 1) Mutare interna intre colectii
  const plain = e.dataTransfer.getData('text/plain');
  if (plain) {
    try {
      const dragInfo = JSON.parse(plain);
      if (dragInfo.type === 'move') { handleInternalDrop(e, dragInfo); return; }
    } catch {}
  }

  // 2) Fisiere (File Explorer, Photoshop export, desktop)
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length > 0) {
    const images = await Promise.all(files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve({ name: file.name, src: ev.target.result, dataUrl: ev.target.result });
      reader.readAsDataURL(file);
    })));
    addImagesToActive(images);
    return;
  }

  // 3) Drag de pe web (Pinterest, Google Images, browser)
  // Browserul trimite URL-ul imaginii prin uri-list / html / plain
  const url = extractImageUrl(e.dataTransfer);
  if (url) {
    showToast('Fetching image...');
    const dataUrl = await fetchImageAsDataUrl(url);
    if (dataUrl) {
      addImagesToActive([{ name: 'web-image', src: dataUrl, dataUrl }]);
    } else {
      showToast('Could not fetch that image');
    }
  }
});

// Extrage un URL de imagine din datele de drag ale browserului
function extractImageUrl(dt) {
  // uri-list e cel mai curat
  const uriList = dt.getData('text/uri-list');
  if (uriList) {
    const first = uriList.split('\n').find(l => l && !l.startsWith('#'));
    if (first) return first.trim();
  }
  // HTML contine de obicei <img src="...">
  const html = dt.getData('text/html');
  if (html) {
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) return m[1];
  }
  // plain text ca ultim resort, daca arata a URL de imagine
  const txt = dt.getData('text/plain');
  if (txt && /^https?:\/\//i.test(txt.trim())) return txt.trim();
  return null;
}

// Descarca imaginea de la URL si o transforma in dataURL
async function fetchImageAsDataUrl(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not an image');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('fetchImage error:', e);
    return null;
  }
}

function handleInternalDrop(e, dragInfo) {
  const targetGroupEl = e.target.closest('.group');
  if (!targetGroupEl) return;
  const targetId = targetGroupEl.dataset.groupId;
  if (targetId === dragInfo.fromGroup) return;
  const sourceCol = state.collections.find(c => c.id === dragInfo.fromGroup);
  const targetCol = state.collections.find(c => c.id === targetId);
  if (!sourceCol || !targetCol) return;
  const item = sourceCol.items.find(i => i.id === dragInfo.itemId);
  if (!item) return;
  sourceCol.items = sourceCol.items.filter(i => i.id !== dragInfo.itemId);
  targetCol.items.push(item);
  targetCol.collapsed = false;
  scheduleAutoSave();
  render();
  showToast(`Moved to "${targetCol.name}"`);
}

document.addEventListener('paste', (e) => {
  if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
  const items = Array.from(e.clipboardData.items).filter(i => i.type.startsWith('image/'));
  if (items.length === 0) return;
  items.forEach(item => {
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => addImagesToActive([{ name: 'clipboard.png', src: ev.target.result, dataUrl: ev.target.result }]);
    reader.readAsDataURL(file);
  });
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, [contenteditable="true"]')) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key === 'i') { e.preventDefault(); document.getElementById('tool-add-image').click(); }
  else if (ctrl && e.key === 'g') { e.preventDefault(); addCollection(); }
  else if (ctrl && e.key === 'f') { e.preventDefault(); document.getElementById('tool-search').click(); }
  else if (e.key === 'Escape') {
    if (previewOverlay.classList.contains('visible')) previewOverlay.classList.remove('visible');
    else if (aboutOverlay.classList.contains('visible')) aboutOverlay.classList.remove('visible');
    else if (searchBar.classList.contains('visible')) document.getElementById('search-close').click();
  }
});

// ------------------------------------------------------------
// SVG ICONS
// ------------------------------------------------------------
function svgEye() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'; }
function svgEyeOff() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'; }
function svgChevronDown() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'; }
function svgChevronRight() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'; }
function svgTrash() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'; }
function svgRotateLeft() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>'; }
function svgRotateRight() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'; }
function svgFlipH() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M16 7l4 5-4 5"/><path d="M8 7l-4 5 4 5"/></svg>'; }
function svgFlipV() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/><path d="M7 8l5-4 5 4"/><path d="M7 16l5 4 5-4"/></svg>'; }
function svgDragOut() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9V5a2 2 0 0 1 2-2h4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/><path d="M21 3l-8 8"/><path d="M15 3h6v6"/></svg>'; }

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
(async function init() {
  await loadState();
  render();
  console.log('Jackdaw ready. Collections:', state.collections.length);
})();
