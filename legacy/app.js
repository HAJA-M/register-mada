/* Fanisana — suivi de terrain des tokatrano
   Dénombrement RSU, AE EQ_TANN_0267, Commune Ambohitrabiby */

const STORE_KEY = 'fanisana.suivi.v1';
const PREF_KEY  = 'fanisana.prefs.v1';
const TILE_CACHE = 'fanisana-tiles-v1';

const SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const STATUSES = [
  { key:'todo',    label:'À faire',  color:'#F5B320' },
  { key:'encours', label:'En cours', color:'#4FA3E3' },
  { key:'fait',    label:'Terminé',  color:'#38C48C' },
  { key:'refus',   label:'Refus',    color:'#E05A4E' },
  { key:'absent',  label:'Absent',   color:'#7F8B97' },
];
const colorOf = k => (STATUSES.find(s => s.key === k) || STATUSES[0]).color;
const labelOf = k => (STATUSES.find(s => s.key === k) || STATUSES[0]).label;
const isOpen  = k => k === 'todo' || k === 'encours';

let MENAGES = [];
let suivi = load(STORE_KEY, {});
let prefs = load(PREF_KEY, { segment:'', base:'sat', sort:'num', sun:false, hideDone:false });
let markers = new Map();
let selectedId = null;
let me = null;                 // { lat, lon, acc }
let undoSnapshot = null;
let map, satLayer, osmLayer, meMarker, meCircle, watchId = null;

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function load(key, fallback){
  try { const v = localStorage.getItem(key); return v ? Object.assign(fallback, JSON.parse(v)) : fallback; }
  catch { return fallback; }
}
function save(){
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(suivi));
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch { toast("Mémoire pleine. Exportez puis videz le cache carte."); }
}
const entry = id => suivi[id] || { statut:'todo', date:'', note:'' };
function setEntry(id, patch){
  suivi[id] = Object.assign(entry(id), patch, { maj:new Date().toISOString() });
  save();
}

/* ---------------------------------------------------------- notices */

let toastTimer;
function toast(msg, undo){
  const t = $('#toast');
  $('#toastText').textContent = msg;
  const btn = $('#toastUndo');
  btn.hidden = !undo;
  btn.onclick = () => { if (undo) undo(); t.hidden = true; };
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 5200 : 2500);
}
function buzz(ms){ if (navigator.vibrate) navigator.vibrate(ms); }

/* ------------------------------------------------------- géométrie */

function distance(aLat, aLon, bLat, bLon){
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fmtDist = d => d == null ? '' : d < 950 ? Math.round(d / 5) * 5 + ' m' : (d / 1000).toFixed(1) + ' km';
const distTo = m => (me && m.lat != null) ? distance(me.lat, me.lon, m.lat, m.lon) : null;

/* ------------------------------------------------------------ carte */

function initMap(){
  map = L.map('map', { zoomControl:false, maxZoom:19 }).setView([-18.7905, 47.5985], 14);
  satLayer = L.tileLayer(SAT_URL, { maxZoom:19, crossOrigin:true, attribution:'Esri, Maxar, Earthstar Geographics' });
  osmLayer = L.tileLayer(OSM_URL, { maxZoom:19, crossOrigin:true, attribution:'OpenStreetMap' });
  L.control.scale({ imperial:false, position:'bottomleft' }).addTo(map);
}

function setBase(which){
  prefs.base = which; save();
  map.removeLayer(which === 'osm' ? satLayer : osmLayer);
  (which === 'osm' ? osmLayer : satLayer).addTo(map);
  $$('#baseSwitch button').forEach(b => b.classList.toggle('on', b.dataset.base === which));
}

function iconFor(m, selected){
  const st = entry(m.id).statut;
  if (st === 'fait' && !selected){
    return L.divIcon({ className:'', html:'<div class="dot-done"></div>', iconSize:[13,13], iconAnchor:[7,7] });
  }
  return L.divIcon({
    className:'', iconSize:[30,30], iconAnchor:[15,28],
    html:`<div class="pin${selected ? ' sel' : ''}" style="background:${colorOf(st)}"><b>${m.no}</b></div>`
  });
}

function drawMarkers(){
  markers.forEach(mk => map.removeLayer(mk));
  markers.clear();
  visible().forEach(m => {
    if (m.lat == null) return;
    if (prefs.hideDone && entry(m.id).statut === 'fait' && m.id !== selectedId) return;
    const mk = L.marker([m.lat, m.lon], { icon:iconFor(m, m.id === selectedId), title:m.chef, riseOnHover:true })
                .addTo(map).on('click', () => openDetail(m.id));
    markers.set(m.id, mk);
  });
}

function refreshMarker(id){
  const m = MENAGES.find(x => x.id === id);
  const mk = markers.get(id);
  if (!m) return;
  if (!mk) { drawMarkers(); return; }
  if (prefs.hideDone && entry(id).statut === 'fait' && id !== selectedId) { drawMarkers(); return; }
  mk.setIcon(iconFor(m, id === selectedId));
}

/* ----------------------------------------------------- sélections */

const visible = () =>
  MENAGES.filter(m => !prefs.segment || (m.grappe + '|' + m.segment) === prefs.segment);

function listed(){
  const q = $('#search').value.trim().toLowerCase();
  const f = $('#statusFilter').value;
  let rows = visible().filter(m => {
    const st = entry(m.id).statut;
    if (f === 'reste' ? !isOpen(st) : (f && st !== f)) return false;
    if (!q) return true;
    return (m.chef + ' ' + m.surnom + ' ' + m.adresse + ' ' + m.marika + ' ' + m.id).toLowerCase().includes(q);
  });
  if (prefs.sort === 'dist' && me){
    rows = rows.slice().sort((a, b) => (distTo(a) ?? 1e9) - (distTo(b) ?? 1e9));
  }
  return rows;
}

function nearestOpen(){
  const open = visible().filter(m => isOpen(entry(m.id).statut) && m.lat != null);
  if (!open.length) return null;
  if (!me) return open[0];
  return open.reduce((best, m) => (distTo(m) < distTo(best) ? m : best), open[0]);
}

/* ------------------------------------------------------------ vues */

function buildChips(){
  const keys = [];
  MENAGES.forEach(m => {
    const k = m.grappe + '|' + m.segment;
    if (!keys.some(x => x.k === k)) keys.push({ k, label:m.grappe.split('/').pop() + '/' + m.segment, fok:m.fokontany });
  });
  const box = $('#segmentChips');
  box.innerHTML = '';
  const add = (k, label, set) => {
    const reste = set.filter(m => isOpen(entry(m.id).statut)).length;
    const b = document.createElement('button');
    b.className = 'chip' + (prefs.segment === k ? ' on' : '') + (reste === 0 ? ' done' : '');
    b.innerHTML = `<i class="dot"></i>${label}<em>${reste === 0 ? 'fini' : reste + ' à faire'}</em>`;
    b.onclick = () => {
      prefs.segment = k; save();
      buildChips(); drawMarkers(); render(); fitToData();
    };
    box.appendChild(b);
  };
  add('', 'Tous', MENAGES);
  keys.forEach(x => add(x.k, x.label, MENAGES.filter(m => m.grappe + '|' + m.segment === x.k)));

  const first = visible()[0];
  if (prefs.segment && !first) { prefs.segment = ''; save(); return buildChips(); }
  if (prefs.segment){
    const nom = first.fokontany.split('_')[0].toLowerCase();
    $('#scopeLabel').textContent = nom.charAt(0).toUpperCase() + nom.slice(1) + ' · segment ' + first.segment;
  } else {
    $('#scopeLabel').textContent = 'Commune Ambohitrabiby';
  }
}

function updateChipCounts(){
  const groups = [null].concat(Array.from(new Set(MENAGES.map(m => m.grappe + '|' + m.segment))));
  $$('#segmentChips .chip').forEach((chip, i) => {
    const key = groups[i];
    const set = key === null ? MENAGES : MENAGES.filter(m => m.grappe + '|' + m.segment === key);
    const reste = set.filter(m => isOpen(entry(m.id).statut)).length;
    chip.classList.toggle('done', reste === 0);
    const em = chip.querySelector('em');
    if (em) em.textContent = reste === 0 ? 'fini' : reste + ' à faire';
  });
}

function fitToData(){
  const pts = visible().filter(m => m.lat != null && (m.precision == null || m.precision < 40)).map(m => [m.lat, m.lon]);
  if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.16), { animate:false });
}

function render(){
  const v = visible();
  const count = k => v.filter(m => entry(m.id).statut === k).length;
  const reste = v.filter(m => isOpen(entry(m.id).statut)).length;

  $('#progRemain').textContent = reste;
  $('#progRemainLabel').textContent = reste === 0
    ? `tokatrano à faire, les ${v.length} sont traités`
    : `tokatrano à faire sur ${v.length}`;

  // ruban de pointage
  const tally = $('#tally');
  tally.innerHTML = '';
  v.forEach(m => {
    const st = entry(m.id).statut;
    const b = document.createElement('button');
    b.className = 'tick' + (m.id === selectedId ? ' sel' : '');
    b.dataset.s = st;
    b.title = `${m.no} · ${m.chef || '—'} · ${labelOf(st)}`;
    b.setAttribute('aria-label', b.title);
    b.onclick = () => openDetail(m.id);
    tally.appendChild(b);
  });

  $('#counts').innerHTML = STATUSES
    .filter(s => count(s.key) > 0)
    .map(s => `<span><i style="background:${s.color}"></i>${s.label} <b>${count(s.key)}</b></span>`)
    .join('');

  updateChipCounts();

  const next = nearestOpen();
  $('#btnNext').disabled = !next;
  $('#nextDist').textContent = next ? (me ? fmtDist(distTo(next)) : 'n° ' + next.no) : 'terminé';

  renderList();
}

function renderList(){
  const ul = $('#list');
  const rows = listed();
  ul.innerHTML = '';
  if (!rows.length){
    ul.innerHTML = '<li class="empty">Aucun tokatrano ne correspond.</li>';
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach(m => {
    const e = entry(m.id);
    const d = distTo(m);
    const li = document.createElement('li');
    li.className = 'row' + (e.statut === 'fait' ? ' is-done' : '');
    li.innerHTML = `
      <span class="row-num" style="background:${colorOf(e.statut)}">${m.no}</span>
      <span class="row-main">
        <span class="row-name">${esc(m.chef || m.surnom || 'Sans nom')}</span>
        <span class="row-meta">${d != null ? `<b class="row-dist">${fmtDist(d)}</b> · ` : ''}${esc(m.adresse || '—')} · ${m.membres || '?'} pers.</span>
      </span>
      <button class="row-check${e.statut === 'fait' ? ' done' : ''}" aria-label="Marquer terminé">
        <svg viewBox="0 0 24 24"><path d="M5 13l4.5 4.5L19 7"/></svg>
      </button>`;
    li.onclick = ev => {
      if (ev.target.closest('.row-check')) return toggleDone(m.id);
      openDetail(m.id);
    };
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);

/* -------------------------------------------------- changer un statut */

function applyStatus(id, statut, quiet){
  undoSnapshot = { id, before: suivi[id] ? JSON.parse(JSON.stringify(suivi[id])) : null };
  setEntry(id, { statut, date: statut === 'todo' ? entry(id).date : (entry(id).date || today()) });
  refreshMarker(id); render();
  if (selectedId === id) fillDetail(id);
  if (!quiet){
    buzz(18);
    toast(labelOf(statut), () => {
      if (undoSnapshot.before) suivi[undoSnapshot.id] = undoSnapshot.before;
      else delete suivi[undoSnapshot.id];
      save(); refreshMarker(id); render();
      if (selectedId === id) fillDetail(id);
    });
  }
}
function toggleDone(id){
  applyStatus(id, entry(id).statut === 'fait' ? 'todo' : 'fait');
}

/* ------------------------------------------------------------ fiche */

function openDetail(id){
  selectedId = id;
  fillDetail(id);
  $('#scrim').hidden = false;
  $('#detail').hidden = false;
  drawMarkers();
  const m = MENAGES.find(x => x.id === id);
  if (m && m.lat != null) map.panTo([m.lat, m.lon]);
}

function closePanels(){
  $('#detail').hidden = $('#menu').hidden = $('#scrim').hidden = true;
  selectedId = null;
  drawMarkers(); render();
}

function fillDetail(id){
  const m = MENAGES.find(x => x.id === id);
  const e = entry(id);

  $('#dCode').textContent = m.id;
  $('#dName').textContent = m.chef || m.surnom || 'Fiche sans nom';
  $('#dSub').textContent  = [m.surnom && '« ' + m.surnom + ' »', m.adresse].filter(Boolean).join(' · ');

  $('#dStatus').innerHTML = STATUSES.map(s => `
    <button data-k="${s.key}" class="${e.statut === s.key ? 'on' : ''}"
            style="${e.statut === s.key ? `background:${s.color}` : ''}">
      <i style="background:${s.color}"></i>${s.label}
    </button>`).join('');
  $$('#dStatus button').forEach(b => b.onclick = () => applyStatus(id, b.dataset.k));

  const facts = [
    ['Segment',   `${m.grappe} · ${m.segment}`],
    ['Fokontany', m.fokontany.replace('_', ' · ')],
    ['Logement',  `n° ${m.logement}, ménage ${m.noDansLogement} sur ${m.nbMenagesLogement}`],
    ['Membres',   m.membres],
    ['Repère',    m.marika],
    ['Recensement', m.tratra ? (m.tratra.startsWith('Tratra') ? 'Trouvé sur place' : 'Non trouvé') : ''],
    ['GPS',       m.lat != null ? `${m.lat.toFixed(6)}, ${m.lon.toFixed(6)} (±${(m.precision ?? 0).toFixed(0)} m)` : 'Aucune coordonnée'],
  ];
  if (m.remarques) facts.push(['Remarque', m.remarques]);
  $('#dFacts').innerHTML = facts.filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');

  $('#dDate').value = e.date || '';
  $('#dNote').value = e.note || '';
  const d = distTo(m);
  $('#dDist').textContent = d != null ? fmtDist(d) : (me ? '—' : 'position inconnue');
  $('#dRoute').disabled = m.lat == null;
}

/* -------------------------------------------------------- position */

function toggleLocate(){
  if (watchId != null){
    navigator.geolocation.clearWatch(watchId);
    watchId = null; me = null;
    if (meMarker){ map.removeLayer(meMarker); map.removeLayer(meCircle); meMarker = null; }
    $('#btnLocate').classList.remove('on');
    if (prefs.sort === 'dist') setSort('num');
    render();
    return;
  }
  if (!navigator.geolocation) return toast("Ce téléphone ne donne pas la position.");
  $('#btnLocate').classList.add('on');
  let first = true;
  watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude:lat, longitude:lon, accuracy:acc } = pos.coords;
    me = { lat, lon, acc };
    if (!meMarker){
      meMarker = L.marker([lat, lon], { icon:L.divIcon({ className:'', html:'<div class="me"></div>', iconSize:[16,16] }), zIndexOffset:1000 }).addTo(map);
      meCircle = L.circle([lat, lon], { radius:acc, color:'#4FA3E3', weight:1, fillOpacity:.1 }).addTo(map);
    } else {
      meMarker.setLatLng([lat, lon]);
      meCircle.setLatLng([lat, lon]).setRadius(acc);
    }
    if (first){ map.setView([lat, lon], Math.max(map.getZoom(), 17)); setSort('dist'); first = false; }
    renderThrottled();
  }, err => {
    toast(err.code === 1 ? "Autorisez la position dans le navigateur." : "Position introuvable.");
    $('#btnLocate').classList.remove('on');
    watchId = null;
  }, { enableHighAccuracy:true, maximumAge:4000, timeout:20000 });
}

let lastRender = 0, lastPos = null;
function renderThrottled(){
  const now = Date.now();
  const moved = !lastPos || distance(lastPos.lat, lastPos.lon, me.lat, me.lon) > 8;
  if (!moved && now - lastRender < 6000) return;
  lastRender = now; lastPos = { lat:me.lat, lon:me.lon };
  render();
  if (selectedId) $('#dDist').textContent = fmtDist(distTo(MENAGES.find(m => m.id === selectedId)));
}

function setSort(mode){
  prefs.sort = mode; save();
  $('#sortLabel').textContent = mode === 'dist' ? 'Proche' : 'N°';
  renderList();
}

function goNext(){
  const m = nearestOpen();
  if (!m) return;
  $('#sheet').classList.remove('open');
  map.setView([m.lat, m.lon], Math.max(map.getZoom(), 18));
  openDetail(m.id);
}

/* --------------------------------------------- tuiles hors ligne */

function dataBounds(pad){
  const pts = MENAGES.filter(m => m.lat != null && (m.precision == null || m.precision < 40));
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
  return { s:Math.min(...lats) - pad, n:Math.max(...lats) + pad, w:Math.min(...lons) - pad, e:Math.max(...lons) + pad };
}
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z);
};

function tileList(zMin, zMax){
  const b = dataBounds(0.004);
  const tpl = prefs.base === 'osm' ? OSM_URL : SAT_URL;
  const urls = [];
  for (let z = zMin; z <= zMax; z++)
    for (let x = lon2x(b.w, z); x <= lon2x(b.e, z); x++)
      for (let y = lat2y(b.n, z); y <= lat2y(b.s, z); y++)
        urls.push(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y));
  return urls;
}

async function downloadArea(){
  if (!navigator.onLine) return toast("Connectez-vous à internet pour télécharger.");
  const urls = tileList(14, 18);
  const bar = $('#dlBar'), txt = $('#dlText');
  $('#dlProgress').hidden = false;
  bar.style.width = '0%';
  txt.textContent = `0 sur ${urls.length} images`;
  $('#btnDownload').disabled = true;

  const cache = await caches.open(TILE_CACHE);
  let done = 0, failed = 0, i = 0;
  const worker = async () => {
    while (i < urls.length){
      const url = urls[i++];
      try {
        if (!await cache.match(url)){
          const res = await fetch(url, { mode:'cors' });
          if (res.ok) await cache.put(url, res.clone()); else failed++;
        }
      } catch { failed++; }
      if (++done % 5 === 0 || done === urls.length){
        bar.style.width = (done / urls.length * 100) + '%';
        txt.textContent = `${done} sur ${urls.length} images`;
      }
    }
  };
  await Promise.all(Array.from({ length:6 }, worker));

  $('#btnDownload').disabled = false;
  txt.textContent = failed
    ? `${urls.length - failed} images enregistrées, ${failed} manquantes. Relancez pour compléter.`
    : `${urls.length} images enregistrées. La carte fonctionne hors ligne.`;
  toast(failed ? 'Téléchargement incomplet' : 'Zone disponible hors ligne');
}

async function clearTiles(){
  await caches.delete(TILE_CACHE);
  $('#dlProgress').hidden = true;
  toast('Cache carte vidé');
}

/* ------------------------------------------------------ sauvegarde */

function download(name, text, type){
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

const exportJson = () => download(`fanisana-progression-${stamp()}.json`,
  JSON.stringify({ app:'fanisana', version:1, exporte:new Date().toISOString(), suivi }, null, 1),
  'application/json');

function exportCsv(){
  const head = ['Kaody_tokatrano','Grappe','Segment','Fokontany','N_tokatrano','Chef_de_menage','Surnom',
                'Membres','Adresse','Latitude','Longitude','Statut','Date_visite','Note'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.join(';')];
  MENAGES.forEach(m => {
    const e = entry(m.id);
    lines.push([m.id, m.grappe, m.segment, m.fokontany, m.no, m.chef, m.surnom, m.membres,
                m.adresse, m.lat ?? '', m.lon ?? '', labelOf(e.statut), e.date || '', e.note || ''].map(q).join(';'));
  });
  download(`fanisana-suivi-${stamp()}.csv`, '\uFEFF' + lines.join('\r\n'), 'text/csv');
}

function importJson(file){
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const data = JSON.parse(fr.result);
      const incoming = data.suivi || data;
      let n = 0;
      Object.entries(incoming).forEach(([id, e]) => {
        if (!e || typeof e !== 'object') return;
        const cur = suivi[id];
        if (!cur || !cur.maj || (e.maj && e.maj > cur.maj)){ suivi[id] = e; n++; }
      });
      save(); drawMarkers(); buildChips(); render();
      toast(`${n} fiche${n > 1 ? 's' : ''} mise${n > 1 ? 's' : ''} à jour`);
    } catch { toast("Fichier illisible."); }
  };
  fr.readAsText(file);
}

/* ------------------------------------------------------------ init */

function wire(){
  $('#sheetGrip').onclick = () => $('#sheet').classList.toggle('open');
  $('#search').oninput = renderList;
  $('#statusFilter').onchange = renderList;
  $('#btnSort').onclick = () => {
    if (prefs.sort === 'num' && !me) return toast("Activez la position pour trier par distance.");
    setSort(prefs.sort === 'num' ? 'dist' : 'num');
  };
  $('#btnNext').onclick = goNext;

  $('#btnLocate').onclick = toggleLocate;
  $('#btnMenu').onclick = () => { $('#scrim').hidden = false; $('#menu').hidden = false; };
  $('#mClose').onclick = $('#dClose').onclick = $('#scrim').onclick = closePanels;

  $('#dDate').onchange = () => selectedId && setEntry(selectedId, { date:$('#dDate').value });
  $('#dNote').onchange = () => selectedId && setEntry(selectedId, { note:$('#dNote').value });
  $('#dCenter').onclick = () => {
    const m = MENAGES.find(x => x.id === selectedId);
    if (m && m.lat != null){ const ll = [m.lat, m.lon]; closePanels(); map.setView(ll, 18); }
  };
  $('#dRoute').onclick = () => {
    const m = MENAGES.find(x => x.id === selectedId);
    if (m && m.lat != null) window.open(`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}`, '_blank');
  };

  $$('#baseSwitch button').forEach(b => b.onclick = () => setBase(b.dataset.base));
  $('#sunMode').onchange = e => { prefs.sun = e.target.checked; save(); document.body.classList.toggle('sun', prefs.sun); };
  $('#hideDone').onchange = e => { prefs.hideDone = e.target.checked; save(); drawMarkers(); };

  $('#btnDownload').onclick = downloadArea;
  $('#btnClearTiles').onclick = clearTiles;
  $('#btnExportJson').onclick = exportJson;
  $('#btnExportCsv').onclick = exportCsv;
  $('#btnImport').onclick = () => $('#fileImport').click();
  $('#fileImport').onchange = e => e.target.files[0] && importJson(e.target.files[0]);
  $('#btnReset').onclick = () => {
    if (confirm("Effacer tous les statuts, dates et notes ? C'est définitif.")){
      suivi = {}; save(); drawMarkers(); buildChips(); render(); closePanels();
      toast('Progression effacée');
    }
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });
  const net = () => { $('#offlinePill').hidden = navigator.onLine; };
  addEventListener('online', net); addEventListener('offline', net); net();
}

async function start(){
  initMap();
  wire();
  setBase(prefs.base);
  document.body.classList.toggle('sun', !!prefs.sun);
  $('#sunMode').checked = !!prefs.sun;
  $('#hideDone').checked = !!prefs.hideDone;
  $('#sortLabel').textContent = prefs.sort === 'dist' ? 'Proche' : 'N°';

  try {
    const res = await fetch('data.json');
    MENAGES = (await res.json()).tokatrano.filter(m => m.chef || m.lat != null);
  } catch {
    return toast("Données introuvables. Rechargez l'application.");
  }

  buildChips();
  drawMarkers();
  render();
  fitToData();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
