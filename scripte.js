// ==================== DATA ====================
let catalog = JSON.parse(localStorage.getItem('catalog') || '[]');
catalog.forEach(c => { if (c.sellPrice === undefined) c.sellPrice = c.price; }); // anciens articles
// Un article peut n'avoir qu'un seul des deux prix : on se rabat sur l'autre si besoin
function buyPrice(c)  { return c.price != null ? c.price : (c.sellPrice != null ? c.sellPrice : 0); }
function sellPriceOf(c) { return c.sellPrice != null ? c.sellPrice : (c.price != null ? c.price : 0); }
function fmtPrice(n) { return n == null ? '—' : fmt(n); }
let shopList = JSON.parse(localStorage.getItem('shopList') || '[]');
let selectedUnit = 'unité';
let selectedArticle = null;
let ddIndex = -1;
let ddItems = [];

function save() {
  localStorage.setItem('catalog', JSON.stringify(catalog));
  localStorage.setItem('shopList', JSON.stringify(shopList));
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
function selUnit(btn, unit) {
  document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  selectedUnit = unit;
}

let catPriceType = 'achat';

function selCatType(btn, type) {
  catPriceType = type;
  document.querySelectorAll('#cat-type-toggle .type-btn').forEach(b => {
    const on = b === btn;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-checked', on);
  });
  document.getElementById('cat-price').focus();
}

function addCatItem() {
  const name = document.getElementById('cat-name').value.trim();
  const value = parseFloat(document.getElementById('cat-price').value);
  if (!name) return shake('cat-name');
  if (isNaN(value) || value < 0) return shake('cat-price');
if (catalog.find(c => c.name.toLowerCase() === name.toLowerCase() && c.unit === selectedUnit)) {
  alert('Cet article existe déjà avec cette unité.');
  return;
}
  // Le prix saisi est attribué au type choisi ; l'autre reste vide (modifiable via « Modifier »).
  const price = catPriceType === 'achat' ? value : null;
  const sellPrice = catPriceType === 'vente' ? value : null;
  catalog.push({ id: Date.now(), name, price, sellPrice, unit: selectedUnit });
  save();
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
let editUnit = 'unité';
let editPriceType = 'achat';
let editPrices = { achat: null, vente: null };

function openEdit(id) {
  const item = catalog.find(c => c.id === id);
  if (!item) return;
  editingId = id;
  editUnit = item.unit;
  editPrices = { achat: item.price, vente: item.sellPrice };
  editPriceType = 'achat';
  document.getElementById('edit-name').value = item.name;
  syncEditTypeUI();
  document.querySelectorAll('#edit-unit-toggle .unit-btn').forEach(b => {
    b.classList.toggle('sel', b.textContent.trim() === item.unit);
  });
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('edit-name').focus(), 100);
}

// range la valeur du champ dans le type de prix actuellement sélectionné
function commitEditPrice() {
  const raw = document.getElementById('edit-price').value;
  const v = parseFloat(raw);
  editPrices[editPriceType] = (raw === '' || isNaN(v)) ? null : v;
}

function syncEditTypeUI() {
  document.querySelectorAll('#edit-type-toggle .type-btn').forEach(b => {
    const on = b.dataset.type === editPriceType;
    b.classList.toggle('sel', on);
    b.setAttribute('aria-checked', on);
  });
  const v = editPrices[editPriceType];
  document.getElementById('edit-price').value = v == null ? '' : v;
  updateEditHint();
}

function updateEditHint() {
  document.getElementById('edit-hint').innerHTML =
    `Achat : <b>${fmtPrice(editPrices.achat)}</b> · Vente : <b>${fmtPrice(editPrices.vente)}</b> CFA`;
}

function onEditPriceInput() {
  commitEditPrice();
  updateEditHint();
}

function selEditType(btn, type) {
  commitEditPrice();
  editPriceType = type;
  syncEditTypeUI();
  document.getElementById('edit-price').focus();
}

function selEditUnit(btn, unit) {
  editUnit = unit;
  document.querySelectorAll('#edit-unit-toggle .unit-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}

function saveEdit() {
  const name = document.getElementById('edit-name').value.trim();
  commitEditPrice();
  if (!name) return shake('edit-name');
  const { achat, vente } = editPrices;
  if ((achat == null && vente == null) || (achat != null && achat < 0) || (vente != null && vente < 0)) {
    return shake('edit-price');
  }
  const dup = catalog.find(c => c.name.toLowerCase() === name.toLowerCase() && c.unit === editUnit && c.id !== editingId);
  if (dup) { alert('Un autre article porte déjà ce nom avec cette unité.'); return; }
  const item = catalog.find(c => c.id === editingId);
  if (!item) return;
  item.name = name;
  item.price = achat;
  item.sellPrice = vente;
  item.unit = editUnit;
  save();
  closeModal();
  renderCatalog();
}

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function renderCatalog() {
  const list = document.getElementById('cat-list');
  document.getElementById('cat-count').textContent = catalog.length + ' article' + (catalog.length!==1?'s':'');
  if (!catalog.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div>Ton catalogue est vide.<br>Ajoute tes articles habituels ici.</div>';
    return;
  }
  const sorted = [...catalog].sort((a,b) => a.name.localeCompare(b.name));
  list.innerHTML = sorted.map(c => `
    <div class="cat-item">
      <div class="cat-item-left">
        <div class="cat-item-name">${esc(c.name)}</div>
        <div class="cat-item-price">${[c.price != null ? 'Achat ' + fmt(c.price) : '', c.sellPrice != null ? 'Vente ' + fmt(c.sellPrice) : ''].filter(Boolean).join(' / ')} CFA <span class="cat-item-unit">/ ${c.unit}</span></div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <button class="btn-edit" onclick="openEdit(${c.id})"> Modifier</button>
        <button class="btn-del" onclick="delCatItem(${c.id})">✕</button>
      </div>
    </div>
  `).join('');
}

// ==================== SHOPPING ====================
function onSearch() {
  const q = document.getElementById('shop-search').value.trim().toLowerCase();
  const dd = document.getElementById('dropdown');
  ddIndex = -1;
  if (!q) { dd.style.display='none'; selectedArticle=null; updatePreview(); return; }
  ddItems = catalog.filter(c => c.price != null && c.name.toLowerCase().includes(q));
  if (!ddItems.length) { dd.style.display='none'; return; }
  dd.innerHTML = ddItems.map((c,i) => `
    <div class="dropdown-item" onmousedown="selectArticle(${i})">
      <span class="dd-name">${highlight(c.name, q)}</span>
      <span class="dd-price">${fmt(buyPrice(c))} CFA/${c.unit}</span>
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
  document.getElementById('shop-search').value = selectedArticle.name;
  document.getElementById('dropdown').style.display = 'none';
  updatePreview();
  document.getElementById('shop-qty').focus();
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
  if (!selectedArticle) { el.innerHTML = '← Choisis un article'; return; }
  const total = buyPrice(selectedArticle) * qty;
  el.innerHTML = `<b>${esc(selectedArticle.name)}</b> × ${qty} ${selectedArticle.unit}<br><span class="prix-calc">${fmt(total)} CFA</span>`;
}

function addToList() {
  if (!selectedArticle) return;
  const qty = parseFloat(document.getElementById('shop-qty').value);
  if (!qty || qty <= 0) return shake('shop-qty');
  shopList.push({
    id: Date.now(),
    name: selectedArticle.name,
    price: buyPrice(selectedArticle),
    unit: selectedArticle.unit,
    qty,
    done: false
  });
  save();
  document.getElementById('shop-search').value = '';
  document.getElementById('shop-qty').value = '1';
  selectedArticle = null;
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
        <div class="shop-sub">${fmt(s.price)} CFA / ${s.unit}</div>
      </div>
      <div class="qty-ctrl">
        <button onclick="changeQty(${s.id}, -1)">−</button>
        <span>${s.qty} ${s.unit}</span>
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
let saleList = JSON.parse(localStorage.getItem('saleList') || '[]');
let invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
let selectedMerchArticle = null;
let merchDdIndex = -1;
let merchDdItems = [];

function saveSale() {
  localStorage.setItem('saleList', JSON.stringify(saleList));
  localStorage.setItem('invoices', JSON.stringify(invoices));
}

// ---- recherche (même logique que l'onglet Ma Liste, sur le même catalogue) ----
function onMerchSearch() {
  const q = document.getElementById('merch-search').value.trim().toLowerCase();
  const dd = document.getElementById('merch-dropdown');
  merchDdIndex = -1;
  if (!q) { dd.style.display='none'; selectedMerchArticle=null; updateMerchPreview(); return; }
  merchDdItems = catalog.filter(c => c.sellPrice != null && c.name.toLowerCase().includes(q));
  if (!merchDdItems.length) { dd.style.display='none'; return; }
  dd.innerHTML = merchDdItems.map((c,i) => `
    <div class="dropdown-item" onmousedown="selectMerchArticle(${i})">
      <span class="dd-name">${highlight(c.name, q)}</span>
      <span class="dd-price">${fmt(sellPriceOf(c))} CFA/${c.unit}</span>
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
  document.getElementById('merch-search').value = selectedMerchArticle.name;
  document.getElementById('merch-dropdown').style.display = 'none';
  updateMerchPreview();
  document.getElementById('merch-qty').focus();
}

function updateMerchPreview() {
  const qty = parseFloat(document.getElementById('merch-qty').value) || 0;
  const el = document.getElementById('merch-preview');
  if (!selectedMerchArticle) { el.innerHTML = '← Choisis un article'; return; }
  const total = sellPriceOf(selectedMerchArticle) * qty;
  el.innerHTML = `<b>${esc(selectedMerchArticle.name)}</b> × ${qty} ${selectedMerchArticle.unit}<br><span class="prix-calc">${fmt(total)} CFA</span>`;
}

// ---- panier de vente en cours ----
function addToSale() {
  if (!selectedMerchArticle) return;
  const qty = parseFloat(document.getElementById('merch-qty').value);
  if (!qty || qty <= 0) return shake('merch-qty');
  saleList.push({
    id: Date.now(),
    name: selectedMerchArticle.name,
    price: sellPriceOf(selectedMerchArticle),
    unit: selectedMerchArticle.unit,
    qty
  });
  saveSale();
  document.getElementById('merch-search').value = '';
  document.getElementById('merch-qty').value = '1';
  selectedMerchArticle = null;
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
          <div class="shop-sub">${fmt(s.price)} CFA / ${s.unit}</div>
        </div>
        <div class="qty-ctrl">
          <button onclick="changeMerchQty(${s.id}, -1)">−</button>
          <span>${s.qty} ${s.unit}</span>
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
function nextInvoiceNumber() {
  let n = parseInt(localStorage.getItem('invoiceSeq') || '0', 10) + 1;
  localStorage.setItem('invoiceSeq', String(n));
  return 'F-' + String(n).padStart(5, '0');
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
      <td>${esc(it.name)}<br><span style="color:var(--muted);font-size:.72rem">${fmt(it.price)} CFA/${it.unit}</span></td>
      <td>${it.qty}</td>
      <td>${fmt(it.price * it.qty)} CFA</td>
    </tr>
  `).join('');
  document.getElementById('invoice-content').innerHTML = `
    <div class="inv-meta">Mes Courses by Ivan — ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</div>
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

// ==================== INIT ====================
renderCatalog();
renderShopList();
renderSaleList();

// Keyboard shortcut: Enter in cat-name moves to price
document.getElementById('cat-name').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('cat-price').focus(); });
document.getElementById('cat-price').addEventListener('keydown', e => { if(e.key==='Enter') addCatItem(); });