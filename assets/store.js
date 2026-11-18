"use strict";

const config = window.PROJECT_CONFIG;
const api = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.appScriptUrl) ? config.appScriptUrl : "";
const admin = String(config.whatsappAdmin).replace(/[\s()+-]/g, "").replace(/^0/, "62");
const hasAdmin = /^62[1-9]\d{7,12}$/.test(admin);
const live = Boolean(api && hasAdmin);
const partialConfig = Boolean(config.appScriptUrl) && !live;
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const $ = id => document.getElementById(id);
const demoProducts = [
  { id: "TL-01", nama: "Keripik Singkong", kategori: "Keripik", harga: 15000, stok: 24, foto: "assets/singkong.webp", deskripsi: "Irisan singkong tipis dan renyah. Kemasan 100 g." },
  { id: "TL-02", nama: "Kacang Pedas Daun Jeruk", kategori: "Kacang", harga: 18000, stok: 18, foto: "assets/kacang.webp", deskripsi: "Kacang gurih dengan cabai dan wangi daun jeruk. Kemasan 100 g." },
  { id: "TL-03", nama: "Abon Nangka Renyah", kategori: "Abon", harga: 25000, stok: 12, foto: "assets/nangka.webp", deskripsi: "Suwiran nangka berbumbu, cocok untuk camilan atau taburan nasi. Kemasan 75 g." }
];

const state = { products: [], cart: readCart(), category: "", query: "", lastOrder: null, attempt: null, busy: false };
const dialog = $("checkout");
const form = $("order-form");

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("teras-lombok-cart-v1") || "[]");
    return new Map(saved.filter(item => Array.isArray(item) && typeof item[0] === "string" && Number.isInteger(item[1]) && item[1] > 0));
  } catch {
    return new Map();
  }
}

function saveCart() {
  try { localStorage.setItem("teras-lombok-cart-v1", JSON.stringify([...state.cart])); } catch {}
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function addSocialLinks(target, links) {
  Object.entries({ instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" }).forEach(([key, name]) => {
    try {
      const href = new URL(links[key]);
      if (href.protocol !== "https:" || ![key + ".com", "www." + key + ".com", "m." + key + ".com"].includes(href.hostname)) return;
      const link = element("a", name + "");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      target.append(link);
    } catch {}
  });
}

function applyProducts(products) {
  state.products = products;
  const validCart = new Map();
  products.forEach(product => {
    const quantity = Math.min(state.cart.get(product.id) || 0, product.stok, 99);
    if (quantity > 0) validCart.set(product.id, quantity);
  });
  state.cart = validCart;
  saveCart();
  renderFilters();
  renderProducts();
  renderCart();
}

async function loadProducts() {
  if (!live) {
    applyProducts(demoProducts);
    return;
  }
  $("demo-banner").hidden = true;
  $("catalog-status").textContent = "Memuat katalog…";
  try {
    const response = await fetch(api, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok || result.status !== "success" || !Array.isArray(result.data)) throw new Error();
    applyProducts(result.data);
  } catch {
    $("catalog-status").textContent = "Katalog belum bisa dimuat. ";
    const retry = element("button", "Coba lagi", "filter");
    retry.addEventListener("click", loadProducts);
    $("catalog-status").append(retry);
  }
}

function renderFilters() {
  const categories = ["", ...new Set(state.products.map(product => product.kategori).filter(Boolean))];
  if (!categories.includes(state.category)) state.category = "";
  const buttons = categories.map(category => {
    const button = element("button", category || "Semua", "filter");
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.category === category));
    button.addEventListener("click", () => {
      state.category = category;
      buttons.forEach(node => node.setAttribute("aria-pressed", String(node === button)));
      renderProducts();
    });
    return button;
  });
  $("filters").replaceChildren(...buttons);
}

function renderProducts() {
  const matches = state.products.filter(product => {
    const searchable = [product.nama, product.kategori, product.deskripsi].join(" ").toLocaleLowerCase("id");
    return (!state.category || state.category === product.kategori) && searchable.includes(state.query);
  });
  $("catalog-status").textContent = matches.length ? "" : "Produk tidak ditemukan.";
  $("product-grid").replaceChildren(...matches.map(productCard));
}

function productCard(product) {
  const card = element("article", "", "product");
  const fallback = () => element("div", "Foto belum tersedia", "photo-fallback");
  let photo = fallback();
  if (product.foto && (!live || /^https:\/\//i.test(product.foto))) {
    photo = element("img");
    photo.alt = product.nama;
    photo.loading = "lazy";
    photo.addEventListener("error", () => photo.replaceWith(fallback()), { once: true });
    photo.src = product.foto;
  }
  const body = element("div", "", "product-body");
  body.append(element("p", product.kategori, "tag"), element("h3", product.nama), element("p", product.deskripsi));
  const footer = element("div", "", "product-bottom");
  const price = element("div");
  price.append(element("strong", rupiah.format(product.harga)), element("small", product.stok ? "Stok " + product.stok : "Stok habis"));
  const add = element("button", product.stok ? "+ Tambah" : "Habis", "button solid");
  add.type = "button";
  add.disabled = product.stok < 1;
  add.setAttribute("aria-label", "Tambah " + product.nama + " ke keranjang");
  add.addEventListener("click", () => {
    const changed = changeQuantity(product, 1);
    const feedback = $("cart-feedback");
    feedback.textContent = changed ? product.nama + " masuk keranjang." : "Jumlah sudah mencapai batas pembelian.";
    clearTimeout(state.toast);
    state.toast = setTimeout(() => { feedback.textContent = ""; }, 2700);
  });
  footer.append(price, add);
  body.append(footer);
  card.append(photo, body);
  return card;
}

function changeQuantity(product, difference) {
  if (state.busy) return false;
  const next = (state.cart.get(product.id) || 0) + difference;
  if (next > Math.min(product.stok, 99) || next < 0) return false;
  if (next) state.cart.set(product.id, next);
  else state.cart.delete(product.id);
  saveCart();
  renderCart();
  return true;
}

function cartLines() {
  return state.products.filter(product => state.cart.has(product.id)).map(product => ({ product, qty: state.cart.get(product.id) }));
}

function renderCart() {
  const lines = cartLines();
  const quantity = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.product.harga * line.qty, 0);
  $("cart-count").textContent = quantity;
  $("subtotal").textContent = rupiah.format(total);
  $("order-submit").disabled = !quantity || state.busy;
  form.hidden = !quantity;
  const focused = document.activeElement?.dataset.cartControl;
  const rows = lines.map(({ product, qty }) => {
    const row = element("div", "", "cart-row");
    const name = element("div");
    name.append(element("strong", product.nama), element("small", rupiah.format(product.harga * qty)));
    const controls = element("div", "", "qty");
    const minus = element("button", "−");
    const plus = element("button", "+");
    [[minus, -1, "Kurangi"], [plus, 1, "Tambah"]].forEach(([button, direction, label]) => {
      button.type = "button";
      button.dataset.cartControl = product.id + ":" + direction;
      button.setAttribute("aria-label", label + " " + product.nama);
      button.addEventListener("click", () => changeQuantity(product, direction));
    });
    minus.disabled = state.busy;
    plus.disabled = state.busy || qty >= Math.min(product.stok, 99);
    controls.append(minus, element("span", String(qty)), plus);
    row.append(name, controls);
    return row;
  });
  $("cart-items").replaceChildren(...(lines.length ? rows : [element("p", "Keranjang masih kosong.", "muted")]));
  if (focused) {
    const controls = [...$("cart-items").querySelectorAll("button:not(:disabled)")];
    (controls.find(button => button.dataset.cartControl === focused) || controls[0] || $("close-cart")).focus();
  }
}

function showCart() {
  if (!state.cart.size && state.lastOrder) showInvoice(state.lastOrder);
  else {
    $("checkout-title").textContent = "Keranjang";
    $("cart-stage").hidden = false;
    $("invoice-stage").hidden = true;
    $("order-error").textContent = "";
  }
  dialog.showModal();
}

function showInvoice(order) {
  $("checkout-title").textContent = "Invoice pesanan";
  $("cart-stage").hidden = true;
  $("invoice-stage").hidden = false;
  $("invoice-mode").textContent = live ? "Menunggu konfirmasi" : "Simulasi · pesanan contoh";
  $("invoice-number").textContent = order.invoice;
  $("invoice-total").textContent = rupiah.format(order.total);
  const lines = order.items.map(item => item.qty + " × " + item.nama);
  $("invoice-items").replaceChildren(...lines.map(line => element("li", line)));
  const summary = [order.invoice, ...lines, "Subtotal: " + rupiah.format(order.total)].join("\n");
  const paymentMessage = live
    ? "Halo Teras Lombok, saya " + order.nama + " ingin mengonfirmasi pembayaran.\n\n" + summary +
      "\n\nSaya lampirkan bukti transfer pada chat ini. Mohon dicek. Terima kasih."
    : "Halo Admin Teras Lombok. Ini simulasi konfirmasi pembayaran untuk tugas.\n\n" + summary +
      "\n\nPesan uji coba. Tidak ada pembayaran sungguhan.";
  const demoGuide = hasAdmin ? "Buka WhatsApp untuk melihat pesan uji coba. " : "Lihat pratinjau pesan di bawah. ";
  $("payment-guide").textContent = live
    ? "Minta ongkir dan cara pembayaran ke admin. Setelah transfer, buka tombol konfirmasi, lampirkan bukti, lalu kirim pesannya."
    : demoGuide + "Pesanan demo tidak dicatat di Google Sheets.";
  $("payment-actions").hidden = !hasAdmin;
  $("wa-order").hidden = !live;
  if (hasAdmin) {
    $("wa-payment").href = "https://wa.me/" + admin + "?text=" + encodeURIComponent(paymentMessage);
    $("wa-payment").textContent = live ? "Konfirmasi pembayaran via WhatsApp" : "Uji konfirmasi via WhatsApp";
  }
  if (live) {
    const orderMessage = "Halo Teras Lombok, saya ingin memesan.\n\n" + summary + "\n\n" +
      "Nama: " + order.nama + "\nWhatsApp: " + order.whatsapp + "\nAlamat: " + order.alamat +
      "\n\nMohon info ongkir, total akhir, dan cara pembayarannya. Terima kasih.";
    $("wa-order").href = "https://wa.me/" + admin + "?text=" + encodeURIComponent(orderMessage);
  }
  $("invoice-message").textContent = paymentMessage;
  $("message-preview").open = !live;
  $("copy-status").textContent = "";
  $("close-cart").focus();
}

function makeRequestId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
}

async function submitOrder(event) {
  event.preventDefault();
  if (state.busy || !state.cart.size) return;
  const fields = new FormData(form);
  const order = {
    nama: fields.get("nama").trim(),
    whatsapp: fields.get("whatsapp").replace(/[\s()+-]/g, "").replace(/^0/, "62"),
    alamat: fields.get("alamat").trim(),
    items: cartLines().map(({ product, qty }) => ({ id: product.id, qty })),
  };
  if (order.nama.length < 2 || order.alamat.length < 5 || !/^62[1-9]\d{7,12}$/.test(order.whatsapp)) {
    $("order-error").textContent = "Isi nama dan alamat lengkap serta nomor WhatsApp yang diawali 08 atau +62.";
    return;
  }
  const snapshot = JSON.stringify(order);
  if (state.attempt?.snapshot !== snapshot) state.attempt = { snapshot, id: makeRequestId() };
  state.busy = true;
  renderCart();
  [...form.elements].forEach(control => { control.disabled = true; });
  $("order-error").textContent = "";
  $("order-submit").textContent = "Membuat invoice…";
  try {
    let invoice;
    if (live) {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ ...order, requestId: state.attempt.id }),
        signal: AbortSignal.timeout(25000)
      });
      const result = await response.json();
      if (!response.ok || result.status !== "success") {
        $("order-error").textContent = result.status === "error" && result.message ? result.message : "Pesanan belum terverifikasi. Coba lagi dengan data yang sama.";
        return;
      }
      invoice = result;
    } else {
      const items = cartLines().map(({ product, qty }) => ({ nama: product.nama, harga: product.harga, qty }));
      invoice = { invoice: "DEMO-" + state.attempt.id.slice(0, 8).toUpperCase(), items, total: items.reduce((sum, item) => sum + item.harga * item.qty, 0) };
    }
    state.lastOrder = { ...order, ...invoice };
    state.cart.clear();
    saveCart();
    state.attempt = null;
    form.reset();
    if (dialog.open) showInvoice(state.lastOrder);
    else showCart();
  } catch {
    $("order-error").textContent = "Pesanan belum terverifikasi. Coba lagi dengan data yang sama.";
  } finally {
    state.busy = false;
    [...form.elements].forEach(control => { control.disabled = false; });
    $("order-submit").textContent = "Buat invoice →";
    renderCart();
  }
}

$("search").addEventListener("input", event => {
  state.query = event.target.value.trim().toLocaleLowerCase("id");
  renderProducts();
});
$("open-cart").addEventListener("click", showCart);
$("close-cart").addEventListener("click", () => dialog.close());
form.addEventListener("submit", submitOrder);
$("copy-message").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("invoice-message").textContent);
    $("copy-status").textContent = "Pesan disalin.";
  } catch {
    $("message-preview").open = true;
    $("copy-status").textContent = "Pilih dan salin teks dari pratinjau pesan.";
  }
});
addSocialLinks($("store-socials"), config.storeSocials);
$("order-note").textContent = live ? "Data dipakai untuk memproses pesanan." : "Gunakan data contoh untuk mencoba alur checkout.";
if (!live) {
  const fill = element("button", "Isi data contoh", "filter");
  fill.type = "button";
  fill.addEventListener("click", () => {
    form.elements.nama.value = "Pembeli Demo";
    form.elements.whatsapp.value = "081234567890";
    form.elements.alamat.value = "Alamat simulasi, Mataram";
  });
  $("order-note").append(" ", fill);
}
if (partialConfig) $("demo-banner").textContent = "Mode demo · konfigurasi toko belum lengkap";
loadProducts();
