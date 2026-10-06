// ==================== FIREBASE ====================
// Remplace les valeurs ci-dessous par celles de TON projet Firebase
// (Console Firebase > icône ⚙️ > Paramètres du projet > tes applications > SDK setup).
const firebaseConfig = {
  apiKey: "AIzaSyC-Q5iivpBfV4Q3SRvYZU84Z_HTwk9Ocg4",
  authDomain: "ma-liste-de-course-747c0.firebaseapp.com",
  databaseURL: "https://ma-liste-de-course-747c0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ma-liste-de-course-747c0",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==================== DATA ====================
const UNITS_ACHAT = ['Carton', 'Demi', '1-4'];           // on n'achète pas à l'unité
const UNITS_VENTE = ['Carton', 'Demi', '1-4', 'unité'];  // mais on peut vendre à l'unité
const ALL_UNITS = ['Carton', 'Demi', '1-4', 'unité'];

// "1-4" est la clé interne (Firebase interdit "/" dans les clés) ; on affiche "1/4" à l'écran.
function unitLabel(u) { return u === '1-4' ? '1/4' : u; }

let catalog = [];
let shopList = [];
let selectedUnit = 'Carton';
let selectedArticle = null;
let selectedShopUnit = null;
let ddIndex = -1;
let ddItems = [];

// Migration : anciens articles { price, sellPrice, unit } -> { achat:{unit:prix}, vente:{unit:prix} }
function migrateCatalog() {
  catalog.forEach(c => {
    ['achat', 'vente'].forEach(t => {
      if (c[t] && c[t]['1/4'] != null) {
        c[t]['1-4'] = c[t]['1/4'];
        delete c[t]['1/4'];
      }
    });
    if (c.unit === '1/4') c.unit = '1-4';
    if (!c.achat || !c.vente) {
      const achat = c.achat || {};
      const vente = c.vente || {};
      if (c.price != null && c.unit) achat[c.unit] = c.price;
      if (c.sellPrice != null && c.unit) vente[c.unit] = c.sellPrice;
      c.achat = achat;
      c.vente = vente;
      delete c.price;
      delete c.sellPrice;
      delete c.unit;
    }
  });
}

function save() {
  db.ref('catalog').set(catalog);
  db.ref('shopList').set(shopList);
}

// ==================== TABS ====================
const TAB_ORDER = ['catalogue', 'courses', 'commercant'];
function switchTab(tab) {
  const idx = TAB_ORDER.indexOf(tab);
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', idx===i));
  document.getElementById('panel-catalogue').classList.toggle('active', tab==='catalogue');
  document.getElementById('panel-courses').classList.toggle('active', tab==='courses');
  document.getElementById('panel-commercant').classList.toggle('active', tab==='commercant');
  if (tab==='courses') renderShopList();
  if (tab==='commercant') renderSaleList();
}

// ==================== CATALOGUE ====================
let catPriceType = 'achat';
let catDraft = { achat: {}, vente: {} };

function selCatType(btn, type) {
  commitCatDraft();                 // garde la valeur en cours avant de changer
  catPriceType = type;
  document.querySelectorAll('#cat-type-toggle .type-btn').forEach(b => {
    const on = b === btn;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-checked', on);
  });
  document.getElementById('cat-unit-toggle-achat').style.display = type === 'achat' ? 'flex' : 'none';
  document.getElementById('cat-unit-toggle-vente').style.display = type === 'vente' ? 'flex' : 'none';
  const activeToggle = document.getElementById(type === 'achat' ? 'cat-unit-toggle-achat' : 'cat-unit-toggle-vente');
  activeToggle.querySelectorAll('.unit-btn').forEach((b,i) => b.classList.toggle('sel', i===0));
  selectedUnit = 'Carton';
  loadCatDraftValue();
  document.getElementById('cat-price').focus();
}


function selUnit(btn, unit) {
  commitCatDraft();
  btn.closest('.unit-toggle').querySelectorAll('.unit-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  selectedUnit = unit;
  loadCatDraftValue();
  document.getElementById('cat-price').focus();
}

function commitCatDraft() {
  const raw = document.getElementById('cat-price').value;
  const v = parseFloat(raw);
  if (raw !== '' && !isNaN(v) && v >= 0) {
    catDraft[catPriceType][selectedUnit] = v;
  }
}

function loadCatDraftValue() {
  const v = catDraft[catPriceType][selectedUnit];
  document.getElementById('cat-price').value = v != null ? v : '';
}

function addCatItem() {
  const name = document.getElementById('cat-name').value.trim();
  commitCatDraft();   // récupère aussi le prix affiché au moment du clic
  if (!name) return shake('cat-name');
  if (!Object.keys(catDraft.achat).length && !Object.keys(catDraft.vente).length) {
    return shake('cat-price');
  }
  let item = catalog.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!item) {
    item = { id: Date.now(), name, achat: {}, vente: {} };
    catalog.push(item);
  }
  Object.assign(item.achat, catDraft.achat);
  Object.assign(item.vente, catDraft.vente);
  save();
  catDraft = { achat: {}, vente: {} };
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-price').value = '';
  renderCatalog();
}

function delCatItem(id) {
  catalog = catalog.filter(c => c.id !== id);
  save();
  renderCatalog();
}

// ==================== EDIT MODAL ====================
let editingId = null;

function openEdit(id) {
  const item = catalog.find(c => c.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('edit-name').value = item.name;
  const grid = document.getElementById('edit-price-grid');
  grid.innerHTML = `
    <div class="price-grid-header"><span>Emballage</span><span>Achat</span><span>Vente</span></div>
    ${ALL_UNITS.map(u => `
      <div class="price-grid-row">
        <label>${unitLabel(u)}</label>
        ${UNITS_ACHAT.includes(u)
          ? `<input type="number" min="0" step="1" id="edit-achat-${u}" value="${item.achat[u] ?? ''}" placeholder="—" />`
          : `<span class="price-grid-na">—</span>`}
        <input type="number" min="0" step="1" id="edit-vente-${u}" value="${item.vente[u] ?? ''}" placeholder="—" />
      </div>
    `).join('')}
  `;
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('edit-name').focus(), 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}

function saveEdit() {
  const name = document.getElementById('edit-name').value.trim();
  if (!name) return shake('edit-name');
  const dup = catalog.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingId);
  if (dup) { alert('Un autre article porte déjà ce nom.'); return; }
  const item = catalog.find(c => c.id === editingId);
  if (!item) return;

  const achat = {}, vente = {};
  let hasAny = false;
  UNITS_ACHAT.forEach(u => {
    const raw = document.getElementById(`edit-achat-${u}`).value;
    const v = parseFloat(raw);
    if (raw !== '' && !isNaN(v) && v >= 0) { achat[u] = v; hasAny = true; }
  });
  UNITS_VENTE.forEach(u => {
    const raw = document.getElementById(`edit-vente-${u}`).value;
    const v = parseFloat(raw);
    if (raw !== '' && !isNaN(v) && v >= 0) { vente[u] = v; hasAny = true; }
  });
  if (!hasAny) { alert('Renseigne au moins un prix.'); return; }

  item.name = name;
  item.achat = achat;
  item.vente = vente;
  save();
  closeModal();
  renderCatalog();
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function priceLine(prices) {
  const units = ALL_UNITS.filter(u => prices[u] != null);
  if (!units.length) return '';
  return units.map(u => `${unitLabel(u)} ${fmt(prices[u])}`).join(' · ');
}

function renderCatalog() {
  const list = document.getElementById('cat-list');
  document.getElementById('cat-count').textContent = catalog.length + ' article' + (catalog.length!==1?'s':'');
  if (!catalog.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>Ton catalogue est vide.<br>Ajoute tes articles habituels ici.</div>';
    return;
  }
  const sorted = [...catalog].sort((a,b) => a.name.localeCompare(b.name));
  list.innerHTML = sorted.map(c => {
    const achatLine = priceLine(c.achat);
    const venteLine = priceLine(c.vente);
    return `
    <div class="cat-item">
      <div class="cat-item-left">
        <div class="cat-item-name">${esc(c.name)}</div>
        <div class="cat-item-price">
          ${achatLine ? `Achat : ${achatLine} CFA` : '<span style="color:var(--muted)">Aucun prix d\u2019achat</span>'}<br>
          ${venteLine ? `Vente : ${venteLine} CFA` : '<span style="color:var(--muted)">Aucun prix de vente</span>'}
        </div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <button class="btn-edit" onclick="openEdit(${c.id})"> Modifier</button>
        <button class="btn-del" onclick="delCatItem(${c.id})">✕</button>
      </div>
    </div>
  `;
  }).join('');
}

// ==================== SHOPPING (ACHAT) ====================
function onSearch() {
  const q = document.getElementById('shop-search').value.trim().toLowerCase();
  const dd = document.getElementById('dropdown');
  ddIndex = -1;
  if (!q) { dd.style.display='none'; selectedArticle=null; selectedShopUnit=null; renderShopUnitPicker(); updatePreview(); return; }
  ddItems = catalog.filter(c => c.name.toLowerCase().includes(q) && Object.keys(c.achat).length > 0);
  if (!ddItems.length) { dd.style.display='none'; return; }
  dd.innerHTML = ddItems.map((c,i) => `
    <div class="dropdown-item" onmousedown="selectArticle(${i})">
      <span class="dd-name">${highlight(c.name, q)}</span>
      <span class="dd-price">${priceLine(c.achat)} CFA</span>
    </div>
  `).join('');
  dd.style.display = 'block';
}

function highlight(name, q) {
  const idx = name.toLowerCase().indexOf(q);
  if (idx < 0) return esc(name);
  return esc(name.slice(0,idx)) + '<b style="color:var(--accent)">' + esc(name.slice(idx,idx+q.length)) + '</b>' + esc(name.slice(idx+q.length));
}

function onSearchKey(e) {
  const dd = document.getElementById('dropdown');
  const items = dd.querySelectorAll('.dropdown-item');
  if (e.key === 'ArrowDown') { ddIndex = Math.min(ddIndex+1, items.length-1); highlightDD(items); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { ddIndex = Math.max(ddIndex-1, 0); highlightDD(items); e.preventDefault(); }
  else if (e.key === 'Enter') { if (ddIndex>=0) selectArticle(ddIndex); else if(items.length===1) selectArticle(0); }
  else if (e.key === 'Escape') { dd.style.display='none'; }
}

function highlightDD(items) {
  items.forEach((it,i) => it.style.background = i===ddIndex ? 'var(--card)' : '');
}

function selectArticle(i) {
  selectedArticle = ddItems[i];
  selectedShopUnit = ALL_UNITS.find(u => selectedArticle.achat[u] != null) || null;
  document.getElementById('shop-search').value = selectedArticle.name;
  document.getElementById('dropdown').style.display = 'none';
  renderShopUnitPicker();
  updatePreview();
  document.getElementById('shop-qty').focus();
}

function renderShopUnitPicker() {
  const el = document.getElementById('shop-unit-picker');
  if (!selectedArticle) { el.innerHTML = ''; el.style.display = 'none'; return; }
  const units = ALL_UNITS.filter(u => selectedArticle.achat[u] != null);
  if (units.length <= 1) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = units.map(u => `<button type="button" class="unit-btn ${u===selectedShopUnit?'sel':''}" onclick="pickShopUnit('${u}')">${unitLabel(u)}</button>`).join('');
}

function pickShopUnit(u) {
  selectedShopUnit = u;
  renderShopUnitPicker();
  updatePreview();
}

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    document.getElementById('dropdown').style.display='none';
    document.getElementById('merch-dropdown').style.display='none';
  }
});

document.getElementById('shop-qty').addEventListener('input', updatePreview);
document.getElementById('merch-qty').addEventListener('input', updateMerchPreview);

function updatePreview() {
  const qty = parseFloat(document.getElementById('shop-qty').value) || 0;
  const el = document.getElementById('preview');
  if (!selectedArticle || !selectedShopUnit) { el.innerHTML = '← Choisis un article'; return; }
  const total = selectedArticle.achat[selectedShopUnit] * qty;
  el.innerHTML = `<b>${esc(selectedArticle.name)}</b> × ${qty} ${unitLabel(selectedShopUnit)}<br><span class="prix-calc">${fmt(total)} CFA</span>`;
}

function addToList() {
  if (!selectedArticle || !selectedShopUnit) return;
  const qty = parseFloat(document.getElementById('shop-qty').value);
  if (!qty || qty <= 0) return shake('shop-qty');
  shopList.push({
    id: Date.now(),
    name: selectedArticle.name,
    price: selectedArticle.achat[selectedShopUnit],
    unit: selectedShopUnit,
    qty,
    done: false
  });
  save();
  document.getElementById('shop-search').value = '';
  document.getElementById('shop-qty').value = '1';
  selectedArticle = null;
  selectedShopUnit = null;
  renderShopUnitPicker();
  updatePreview();
  renderShopList();
}

function toggleDone(id) {
  const it = shopList.find(s => s.id===id);
  if (it) { it.done = !it.done; save(); renderShopList(); }
}

function removeShopItem(id) {
  shopList = shopList.filter(s => s.id!==id);
  save(); renderShopList();
}

function changeQty(id, delta) {
  const it = shopList.find(s => s.id === id);
  if (!it) return;
  const newQty = Math.round((it.qty + delta) * 100) / 100;
  if (newQty <= 0) {
    if (confirm(`Retirer "${it.name}" de la liste ?`)) {
      shopList = shopList.filter(s => s.id !== id);
    }
  } else {
    it.qty = newQty;
  }
  save();
  renderShopList();
}

function clearList() {
  if (!shopList.length) return;
  if (confirm('Vider toute la liste ?')) { shopList = []; save(); renderShopList(); }
}

function renderShopList() {
  const list = document.getElementById('shop-list');
  const undone = shopList.filter(s => !s.done);
  const done = shopList.filter(s => s.done);
  const ordered = [...undone, ...done];

  if (!shopList.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🛍️</div>Ta liste est vide.<br>Recherche un article ci-dessus.</div>';
    document.getElementById('total-amount').textContent = '0 CFA';
    document.getElementById('total-count').textContent = '0 article';
    return;
  }

  list.innerHTML = ordered.map(s => `
    <div class="shop-item ${s.done?'checked':''}">
      <div class="shop-item-check ${s.done?'done':''}" onclick="toggleDone(${s.id})">${s.done?'✓':''}</div>
      <div class="shop-info">
        <div class="shop-name">${esc(s.name)}</div>
        <div class="shop-sub">${fmt(s.price)} CFA / ${unitLabel(s.unit)}</div>
      </div>
      <div class="qty-ctrl">
        <button onclick="changeQty(${s.id}, -1)">−</button>
        <span>${s.qty} ${unitLabel(s.unit)}</span>
        <button onclick="changeQty(${s.id}, +1)">+</button>
      </div>
      <div class="shop-price">${fmt(s.price * s.qty)} CFA</div>
      <button class="btn-rm" onclick="removeShopItem(${s.id})">✕</button>
    </div>
  `).join('');

  const total = shopList.reduce((acc,s) => acc + s.price*s.qty, 0);
  const n = shopList.length;
  document.getElementById('total-amount').textContent = fmt(total) + ' CFA';
  document.getElementById('total-count').textContent = n + ' article' + (n!==1?'s':'');
}

// ==================== COMMERÇANT (VENTE) ====================
let saleList = [];
let invoices = [];
let selectedMerchArticle = null;
let selectedMerchUnit = null;
let merchDdIndex = -1;
let merchDdItems = [];

function saveSale() {
  db.ref('saleList').set(saleList);
  db.ref('invoices').set(invoices);
}

// ---- recherche (même logique que l'onglet Ma Liste, sur le même catalogue) ----
function onMerchSearch() {
  const q = document.getElementById('merch-search').value.trim().toLowerCase();
  const dd = document.getElementById('merch-dropdown');
  merchDdIndex = -1;
  if (!q) { dd.style.display='none'; selectedMerchArticle=null; selectedMerchUnit=null; renderMerchUnitPicker(); updateMerchPreview(); return; }
  merchDdItems = catalog.filter(c => c.name.toLowerCase().includes(q) && Object.keys(c.vente).length > 0);
  if (!merchDdItems.length) { dd.style.display='none'; return; }
  dd.innerHTML = merchDdItems.map((c,i) => `
    <div class="dropdown-item" onmousedown="selectMerchArticle(${i})">
      <span class="dd-name">${highlight(c.name, q)}</span>
      <span class="dd-price">${priceLine(c.vente)} CFA</span>
    </div>
  `).join('');
  dd.style.display = 'block';
}

function onMerchSearchKey(e) {
  const dd = document.getElementById('merch-dropdown');
  const items = dd.querySelectorAll('.dropdown-item');
  if (e.key === 'ArrowDown') { merchDdIndex = Math.min(merchDdIndex+1, items.length-1); highlightMerchDD(items); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { merchDdIndex = Math.max(merchDdIndex-1, 0); highlightMerchDD(items); e.preventDefault(); }
  else if (e.key === 'Enter') { if (merchDdIndex>=0) selectMerchArticle(merchDdIndex); else if(items.length===1) selectMerchArticle(0); }
  else if (e.key === 'Escape') { dd.style.display='none'; }
}

function highlightMerchDD(items) {
  items.forEach((it,i) => it.style.background = i===merchDdIndex ? 'var(--card)' : '');
}

function selectMerchArticle(i) {
  selectedMerchArticle = merchDdItems[i];
  selectedMerchUnit = ALL_UNITS.find(u => selectedMerchArticle.vente[u] != null) || null;
  document.getElementById('merch-search').value = selectedMerchArticle.name;
  document.getElementById('merch-dropdown').style.display = 'none';
  renderMerchUnitPicker();
  updateMerchPreview();
  document.getElementById('merch-qty').focus();
}

function renderMerchUnitPicker() {
  const el = document.getElementById('merch-unit-picker');
  if (!selectedMerchArticle) { el.innerHTML = ''; el.style.display = 'none'; return; }
  const units = ALL_UNITS.filter(u => selectedMerchArticle.vente[u] != null);
  if (units.length <= 1) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = units.map(u => `<button type="button" class="unit-btn ${u===selectedMerchUnit?'sel':''}" onclick="pickMerchUnit('${u}')">${unitLabel(u)}</button>`).join('');
}

function pickMerchUnit(u) {
  selectedMerchUnit = u;
  renderMerchUnitPicker();
  updateMerchPreview();
}

function updateMerchPreview() {
  const qty = parseFloat(document.getElementById('merch-qty').value) || 0;
  const el = document.getElementById('merch-preview');
  if (!selectedMerchArticle || !selectedMerchUnit) { el.innerHTML = '← Choisis un article'; return; }
  const total = selectedMerchArticle.vente[selectedMerchUnit] * qty;
  el.innerHTML = `<b>${esc(selectedMerchArticle.name)}</b> × ${qty} ${unitLabel(selectedMerchUnit)}<br><span class="prix-calc">${fmt(total)} CFA</span>`;
}

// ---- panier de vente en cours ----
function addToSale() {
  if (!selectedMerchArticle || !selectedMerchUnit) return;
  const qty = parseFloat(document.getElementById('merch-qty').value);
  if (!qty || qty <= 0) return shake('merch-qty');
  saleList.push({
    id: Date.now(),
    name: selectedMerchArticle.name,
    price: selectedMerchArticle.vente[selectedMerchUnit],
    unit: selectedMerchUnit,
    qty
  });
  saveSale();
  document.getElementById('merch-search').value = '';
  document.getElementById('merch-qty').value = '1';
  selectedMerchArticle = null;
  selectedMerchUnit = null;
  renderMerchUnitPicker();
  updateMerchPreview();
  renderSaleList();
}

function changeMerchQty(id, delta) {
  const it = saleList.find(s => s.id === id);
  if (!it) return;
  const newQty = Math.round((it.qty + delta) * 100) / 100;
  if (newQty <= 0) {
    saleList = saleList.filter(s => s.id !== id);
  } else {
    it.qty = newQty;
  }
  saveSale();
  renderSaleList();
}

function removeSaleItem(id) {
  saleList = saleList.filter(s => s.id !== id);
  saveSale();
  renderSaleList();
}

function saleTotal() {
  return saleList.reduce((acc, s) => acc + s.price * s.qty, 0);
}

function renderSaleList() {
  const list = document.getElementById('merch-list');
  if (!saleList.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div>Aucune vente en cours.<br>Recherche un article ci-dessus.</div>';
  } else {
    list.innerHTML = saleList.map(s => `
      <div class="shop-item">
        <div class="shop-info">
          <div class="shop-name">${esc(s.name)}</div>
          <div class="shop-sub">${fmt(s.price)} CFA / ${unitLabel(s.unit)}</div>
        </div>
        <div class="qty-ctrl">
          <button onclick="changeMerchQty(${s.id}, -1)">−</button>
          <span>${s.qty} ${unitLabel(s.unit)}</span>
          <button onclick="changeMerchQty(${s.id}, +1)">+</button>
        </div>
        <div class="shop-price">${fmt(s.price * s.qty)} CFA</div>
        <button class="btn-rm" onclick="removeSaleItem(${s.id})">✕</button>
      </div>
    `).join('');
  }
  const total = saleTotal();
  const n = saleList.length;
  document.getElementById('merch-total').textContent = fmt(total) + ' CFA';
  document.getElementById('merch-count').textContent = n + ' article' + (n!==1?'s':'');
  updateChange();
}

// ---- encaissement / monnaie à rendre ----
function updateChange() {
  const total = saleTotal();
  const received = parseFloat(document.getElementById('cash-received').value);
  const line = document.getElementById('change-line');
  line.classList.remove('ok','bad');
  if (!saleList.length) {
    line.textContent = 'Ajoute des articles à la vente';
    return;
  }
  if (isNaN(received)) {
    line.textContent = 'Saisis la somme reçue';
    return;
  }
  const diff = received - total;
  if (diff < 0) {
    line.classList.add('bad');
    line.textContent = `Il manque ${fmt(Math.abs(diff))} CFA`;
  } else {
    line.classList.add('ok');
    line.textContent = `Monnaie à rendre : ${fmt(diff)} CFA`;
  }
}

function clearSale() {
  if (!saleList.length) return;
  if (confirm('Annuler la vente en cours ?')) {
    saleList = [];
    document.getElementById('cash-received').value = '';
    saveSale();
    renderSaleList();
  }
}


// ---- facture ----
let invoiceSeq = 0;

function nextInvoiceNumber() {
  invoiceSeq++;
  db.ref('invoiceSeq').set(invoiceSeq);
  return 'F-' + String(invoiceSeq).padStart(5, '0');
}

function validateSale() {
  if (!saleList.length) return shake('merch-search');
  const total = saleTotal();
  const received = parseFloat(document.getElementById('cash-received').value);
  if (isNaN(received) || received < total) {
    return shake('cash-received');
  }
  const change = received - total;
  const number = nextInvoiceNumber();
  const date = new Date();
  const invoice = {
    number,
    date: date.toISOString(),
    items: saleList.map(s => ({...s})),
    total,
    received,
    change
  };
  invoices.push(invoice);
  saleList = [];
  document.getElementById('cash-received').value = '';
  saveSale();
  renderSaleList();
  showInvoice(invoice);
}

function showInvoice(invoice) {
  document.getElementById('invoice-number').textContent = invoice.number;
  const d = new Date(invoice.date);
  const rows = invoice.items.map(it => `
    <tr>
      <td>${esc(it.name)}<br><span style="color:var(--muted);font-size:.72rem">${fmt(it.price)} CFA/${unitLabel(it.unit)}</span></td>
      <td>${it.qty}</td>
      <td>${fmt(it.price * it.qty)} CFA</td>
    </tr>
  `).join('');
  document.getElementById('invoice-content').innerHTML = `
    <div class="inv-logo-wrap">
      <img class="inv-logo-img" src="data:image/jpeg;base64,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" alt="La Cave du Marché">
      <div class="inv-phone">Tel: 01 41 88 13 97 / 07 68 51 55 79 </div>
    </div>
    <div class="inv-meta">${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</div>
    <table>
      <thead><tr><th>Article</th><th>Qté</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td>${fmt(invoice.total)} CFA</td></tr></tfoot>
    </table>
    <div class="inv-cash">
      Reçu : <b>${fmt(invoice.received)} CFA</b><br>
      Monnaie rendue : <b>${fmt(invoice.change)} CFA</b>
    </div>
  `;
  document.getElementById('invoice-overlay').classList.add('open');
}

function closeInvoice() {
  document.getElementById('invoice-overlay').classList.remove('open');
}

function printInvoice() {
  window.print();
}

document.getElementById('invoice-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeInvoice();
});

// ==================== UTILS ====================
function fmt(n) { return Math.round(n).toLocaleString('fr-FR'); }
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function shake(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'var(--danger)';
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake .3s';
  setTimeout(() => { el.style.borderColor=''; el.style.animation=''; }, 600);
}

// ==================== INIT (synchronisation Firebase) ====================
// Chaque appareil écoute les mêmes données : dès qu'un appareil modifie quelque chose,
// tous les autres reçoivent la mise à jour automatiquement, sans recharger la page.
db.ref('catalog').on('value', snap => {
  catalog = snap.val() || [];
  migrateCatalog();
  renderCatalog();
});
db.ref('shopList').on('value', snap => {
  shopList = snap.val() || [];
  renderShopList();
});
db.ref('saleList').on('value', snap => {
  saleList = snap.val() || [];
  renderSaleList();
});
db.ref('invoices').on('value', snap => {
  invoices = snap.val() || [];
});
db.ref('invoiceSeq').on('value', snap => {
  invoiceSeq = snap.val() || 0;
});

// Raccourcis clavier
document.getElementById('cat-name').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('cat-price').focus(); });
document.getElementById('cat-price').addEventListener('keydown', e => { if(e.key==='Enter') addCatItem(); });
