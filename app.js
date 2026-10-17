const DB_NAME = "my-shop-inventory-db";
const DB_VERSION = 1;
let db;
let currentPhotoData = "";
let toastTimer;

const $ = (id) => document.getElementById(id);
const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(amount) || 0);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("products")) {
        database.createObjectStore("products", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("purchases")) {
        const store = database.createObjectStore("purchases", { keyPath: "id" });
        store.createIndex("productId", "productId", { unique: false });
        store.createIndex("date", "date", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function putRecord(storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function deleteRecord(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function replaceAll(products, purchases) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["products", "purchases"], "readwrite");
    const pStore = tx.objectStore("products");
    const hStore = tx.objectStore("purchases");
    pStore.clear(); hStore.clear();
    products.forEach(item => pStore.put(item));
    purchases.forEach(item => hStore.put(item));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function sortedPurchases(items) {
  return [...items].sort((a,b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
}
async function render() {
  const [products, purchases] = await Promise.all([getAll("products"), getAll("purchases")]);
  $("productCount").textContent = products.length;
  $("purchaseCount").textContent = purchases.length;
  $("totalSpend").textContent = money(purchases.reduce((sum,p) => sum + Number(p.rate)*Number(p.quantity), 0));

  const selected = $("purchaseProduct").value;
  $("purchaseProduct").innerHTML = products.length
    ? `<option value="">Choose a product…</option>` + [...products].sort((a,b)=>a.name.localeCompare(b.name)).map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")
    : `<option value="">Add a product first</option>`;
  if (products.some(p => p.id === selected)) $("purchaseProduct").value = selected;

  const query = $("searchInput").value.trim().toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(query)).sort((a,b)=>a.name.localeCompare(b.name));
  $("productsList").innerHTML = "";
  $("emptyState").classList.toggle("hidden", filtered.length !== 0);
  if (products.length && filtered.length === 0) {
    $("emptyState").classList.remove("hidden");
    $("emptyState").querySelector("h3").textContent = "No matching products";
    $("emptyState").querySelector("p").textContent = "Try a different search term.";
  } else {
    $("emptyState").querySelector("h3").textContent = "No products yet";
    $("emptyState").querySelector("p").textContent = "Add your first product above to start your register.";
  }
  for (const product of filtered) {
    const history = purchases.filter(p => p.productId === product.id);
    const latest = sortedPurchases(history)[0];
    const card = document.createElement("article");
    card.className = "product-card";
    const photo = product.photo
      ? `<img class="product-photo" src="${product.photo}" alt="${escapeHtml(product.name)}">`
      : `<div class="product-photo product-placeholder" aria-label="No photo">▦</div>`;
    card.innerHTML = `${photo}
      <div class="product-info">
        <h3>${escapeHtml(product.name)}</h3>
        <div class="product-meta"><span>${history.length} purchase ${history.length === 1 ? "entry" : "entries"}</span>${latest ? `<span>Latest: ${escapeHtml(latest.date)}</span>` : ""}</div>
        <div class="latest-rate">${latest ? `${money(latest.rate)} <span style="font-size:11px;font-weight:500;color:#718077">/ item (latest)</span>` : "No purchase rate yet"}</div>
      </div>
      <div class="card-actions">
        <button class="mini-button" data-action="history" data-id="${escapeHtml(product.id)}">History</button>
        <button class="mini-button" data-action="edit" data-id="${escapeHtml(product.id)}">Edit</button>
        <button class="mini-button danger" data-action="delete" data-id="${escapeHtml(product.id)}">Delete</button>
      </div>`;
    $("productsList").appendChild(card);
  }
  updateEntryTotal();
}
function updateEntryTotal() {
  $("entryTotal").textContent = money((Number($("purchaseRate").value)||0) * (Number($("purchaseQty").value)||0));
}
async function compressImage(file) {
  if (!file || !file.type.startsWith("image/")) return "";
  const image = await createImageBitmap(file);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}
function resetProductForm() {
  $("productForm").reset();
  $("editingId").value = "";
  currentPhotoData = "";
  $("formTitle").textContent = "Add a product";
  $("saveProductBtn").textContent = "Save product";
  $("cancelEditBtn").classList.add("hidden");
  $("photoPreviewWrap").classList.add("hidden");
  $("photoPreview").src = "";
}
async function editProduct(id) {
  const products = await getAll("products");
  const product = products.find(p => p.id === id);
  if (!product) return;
  $("editingId").value = product.id;
  $("productName").value = product.name;
  currentPhotoData = product.photo || "";
  $("formTitle").textContent = "Edit product";
  $("saveProductBtn").textContent = "Update product";
  $("cancelEditBtn").classList.remove("hidden");
  $("photoPreviewWrap").classList.toggle("hidden", !currentPhotoData);
  if (currentPhotoData) $("photoPreview").src = currentPhotoData;
  $("productForm").scrollIntoView({behavior:"smooth", block:"center"});
}
async function showHistory(id) {
  const [products, purchases] = await Promise.all([getAll("products"), getAll("purchases")]);
  const product = products.find(p=>p.id===id);
  if (!product) return;
  const history = sortedPurchases(purchases.filter(p=>p.productId===id));
  $("historyTitle").textContent = `${product.name} — Purchase history`;
  $("historySubtitle").textContent = `${history.length} saved ${history.length===1?"entry":"entries"}`;
  const total = history.reduce((sum,p)=>sum+Number(p.rate)*Number(p.quantity),0);
  const content = $("historyContent");
  content.innerHTML = `<div class="history-summary"><span>Total recorded spend</span><strong>${money(total)}</strong></div>`;
  if (!history.length) content.innerHTML += `<p class="empty-state">No purchase entries yet. Use the purchase form to add one.</p>`;
  for (const item of history) {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `<div><div class="history-date">${escapeHtml(item.date)}</div><div class="history-note">Quantity: ${escapeHtml(item.quantity)} · Rate: ${money(item.rate)} per item</div>${item.note ? `<div class="history-note">${escapeHtml(item.note)}</div>` : ""}</div>
      <div class="history-amount"><strong>${money(Number(item.rate)*Number(item.quantity))}</strong><span>entry total</span><div style="margin-top:7px"><button class="mini-button" data-purchase-edit="${escapeHtml(item.id)}">Edit</button> <button class="mini-button danger" data-purchase-delete="${escapeHtml(item.id)}">Delete</button></div></div>`;
    content.appendChild(row);
  }
  $("historyDialog").showModal();
}
async function exportBackup() {
  const [products, purchases] = await Promise.all([getAll("products"), getAll("purchases")]);
  const data = { app:"My Shop Inventory", version:1, exportedAt:new Date().toISOString(), products, purchases };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`my-shop-backup-${today()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported. Keep the file somewhere safe.");
}
async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.products) || !Array.isArray(data.purchases)) throw new Error("This file does not look like a valid shop backup.");
    const productIds = new Set(data.products.map(p=>p.id));
    if (data.purchases.some(p=>!productIds.has(p.productId))) throw new Error("Some purchase entries do not match products in this backup.");
    if (!confirm(`Restore ${data.products.length} products and ${data.purchases.length} purchase entries? This replaces current data in this browser.`)) return;
    await replaceAll(data.products, data.purchases);
    resetProductForm();
    await render();
    showToast("Backup restored successfully.");
  } catch (err) {
    alert(err.message || "Could not read this backup file.");
  } finally {
    $("importFile").value = "";
  }
}

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("productName").value.trim();
  if (!name) return;
  const id = $("editingId").value || makeId();
  const existing = (await getAll("products")).find(p=>p.id===id);
  await putRecord("products", { id, name, photo:currentPhotoData, createdAt:existing?.createdAt || Date.now(), updatedAt:Date.now() });
  resetProductForm();
  await render();
  showToast(existing ? "Product updated." : "Product saved.");
});
$("productPhoto").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 12*1024*1024) { alert("Please choose a photo smaller than 12 MB."); event.target.value=""; return; }
  try {
    currentPhotoData = await compressImage(file);
    $("photoPreview").src = currentPhotoData;
    $("photoPreviewWrap").classList.remove("hidden");
  } catch {
    alert("Could not open this photo. Try another image.");
  }
});
$("removePhotoBtn").addEventListener("click", () => {
  currentPhotoData = "";
  $("productPhoto").value = "";
  $("photoPreview").src = "";
  $("photoPreviewWrap").classList.add("hidden");
});
$("cancelEditBtn").addEventListener("click", resetProductForm);
$("purchaseDate").value = today();
$("purchaseRate").addEventListener("input", updateEntryTotal);
$("purchaseQty").addEventListener("input", updateEntryTotal);
$("purchaseForm").addEventListener("submit", async event => {
  event.preventDefault();
  const productId = $("purchaseProduct").value;
  const rate = Number($("purchaseRate").value);
  const quantity = Number($("purchaseQty").value);
  const date = $("purchaseDate").value;
  if (!productId) { alert("Please add and choose a product first."); return; }
  if (!date || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(quantity) || quantity <= 0) { alert("Enter a valid date, rate and quantity."); return; }
  await putRecord("purchases", { id:makeId(), productId, rate, quantity, date, note:$("purchaseNote").value.trim(), createdAt:Date.now() });
  $("purchaseRate").value = "";
  $("purchaseQty").value = "1";
  $("purchaseNote").value = "";
  updateEntryTotal();
  await render();
  showToast("Purchase entry saved.");
});
$("searchInput").addEventListener("input", render);
$("productsList").addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const {action,id} = button.dataset;
  if (action==="history") await showHistory(id);
  if (action==="edit") await editProduct(id);
  if (action==="delete") {
    const [products,purchases] = await Promise.all([getAll("products"),getAll("purchases")]);
    const product = products.find(p=>p.id===id);
    const count = purchases.filter(p=>p.productId===id).length;
    if (!confirm(`Delete "${product?.name}" and its ${count} purchase entries? This cannot be undone.`)) return;
    await deleteRecord("products",id);
    for (const purchase of purchases.filter(p=>p.productId===id)) await deleteRecord("purchases",purchase.id);
    await render(); showToast("Product and its purchase history deleted.");
  }
});
$("historyContent").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-purchase-edit]");
  const deleteButton = event.target.closest("[data-purchase-delete]");
  const [products,purchases] = await Promise.all([getAll("products"),getAll("purchases")]);
  if (editButton) {
    const purchase = purchases.find(p=>p.id===editButton.dataset.purchaseEdit);
    if (!purchase) return;
    $("historyDialog").close();
    $("purchaseProduct").value = purchase.productId;
    $("purchaseDate").value = purchase.date;
    $("purchaseRate").value = purchase.rate;
    $("purchaseQty").value = purchase.quantity;
    $("purchaseNote").value = purchase.note || "";
    updateEntryTotal();
    // Save edits as a replacement of the selected purchase entry.
    const form = $("purchaseForm");
    form.dataset.editingPurchase = purchase.id;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = "Update purchase";
    form.scrollIntoView({behavior:"smooth",block:"center"});
  } else if (deleteButton) {
    const id = deleteButton.dataset.purchaseDelete;
    if (!confirm("Delete this purchase entry?")) return;
    await deleteRecord("purchases",id);
    await showHistory(purchases.find(p=>p.id===id)?.productId);
    await render();
    showToast("Purchase entry deleted.");
  }
});
$("purchaseForm").addEventListener("submit", async event => {
  // The main save handler above also runs; this listener is intentionally not used for persistence.
}, true);
$("backupBtn").addEventListener("click", exportBackup);
$("exportBtn").addEventListener("click", exportBackup);
$("importFile").addEventListener("change", event => importBackup(event.target.files[0]));
$("closeHistoryBtn").addEventListener("click", ()=>$("historyDialog").close());

// Override purchase submit to support editing a previous entry while preserving its ID.
$("purchaseForm").addEventListener("submit", async event => {
  const id = $("purchaseForm").dataset.editingPurchase;
  if (!id) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const productId=$("purchaseProduct").value, date=$("purchaseDate").value, rate=Number($("purchaseRate").value), quantity=Number($("purchaseQty").value);
  if (!productId || !date || !Number.isFinite(rate) || rate<0 || !Number.isFinite(quantity) || quantity<=0) { alert("Enter a valid product, date, rate and quantity."); return; }
  const all=await getAll("purchases");
  const old=all.find(p=>p.id===id);
  await putRecord("purchases",{...old,productId,date,rate,quantity,note:$("purchaseNote").value.trim(),updatedAt:Date.now()});
  delete $("purchaseForm").dataset.editingPurchase;
  $("purchaseForm").reset();
  $("purchaseDate").value=today(); $("purchaseQty").value="1";
  $("purchaseForm").querySelector('button[type="submit"]').textContent="Save purchase";
  updateEntryTotal(); await render(); showToast("Purchase entry updated.");
}, true);

(async function init(){
  try {
    db = await openDatabase();
    $("purchaseDate").value=today();
    await render();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    }
  } catch (error) {
    console.error(error);
    alert("Could not start local storage. Please open the app using VS Code Live Server or a local web server in a modern browser.");
  }
})();