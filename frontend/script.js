const API = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const menu = document.getElementById("menu");
  const hamburger = document.getElementById("hamburger");

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      menu.style.display = menu.style.display === "flex" ? "none" : "flex";
    });
  }

  if (document.getElementById("slideshow")) loadSlideshow();
  if (document.getElementById("itemsContainer")) loadItems();
  if (document.getElementById("itemDetails")) loadItemDetails();
  if (document.getElementById("buyerForm")) setupPayForm();
  if (document.getElementById("finalizeBtn")) setupFinalizeButton();
  if (document.getElementById("itemForm")) setupAdminPanel?.();
  if (document.getElementById("cartPageItems")) loadCart();
  if (document.getElementById("adminBuyers")) loadBuyers?.();
  if (document.getElementById("adminInquiries")) loadInquiries();
  if (document.getElementById("adminSupport")) loadSupportTickets();


  setupMiniCart();
  updateCartCount();
});

// ---------------- SLIDESHOW ----------------
function loadSlideshow() {
  fetch(`${API}/api/slideshow`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("slideshow");
      container.innerHTML = `
        <div class="slideshow-track">
          ${data.map(file => `<img src="${file.path}" class="slide-image" />`).join("")}
        </div>
      `;
      startSlideshow();
    });
}

function startSlideshow() {
  const track = document.querySelector(".slideshow-track");
  const slides = document.querySelectorAll(".slide-image");
  let index = 0;
  setInterval(() => {
    index = (index + 1) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
  }, 3000);
}

// ---------------- ITEMS ----------------
let allItems = [];

function loadItems() {
  fetch(`${API}/api/items`)
    .then(res => res.json())
    .then(data => {
      allItems = data;
      renderItems(allItems);
    });
}

function renderItems(items) {
  const container = document.getElementById("itemsContainer") || document.getElementById("relatedItems");
  if (!container) return;
  container.innerHTML = items.map(item => `
    <div class="item-box ${item.stock === 0 ? 'out-of-stock' : ''}">
      <img src="${API}${item.photos[0] || ''}" class="item-img" />
      <h2>${item.name}</h2>
      <p>Model: ${item.model}</p>
      <p>Price: ${item.price} ${item.coinType}</p>
      <button onclick="viewItem('${item.id}')">View Item</button>
      <button onclick="addToCart('${item.id}')">Add to Cart</button>
    </div>
  `).join("");
}

function viewItem(id) {
  sessionStorage.setItem("currentItem", id);
  window.location.href = "item.html";
}

function loadItemDetails() {
  const id = sessionStorage.getItem("currentItem");
  fetch(`${API}/api/items`)
    .then(res => res.json())
    .then(data => {
      const item = data.find(i => i.id == id);
      if (!item) return;

      const galleryHTML = item.photos?.length
        ? item.photos.map(file => `<img src="${API}${file}" class="item-photo">`).join("")
        : `<p>No images available</p>`;

      document.getElementById("itemDetails").innerHTML = `
        <div class="item-layout">
          <div class="item-image">${galleryHTML}</div>
          <div class="item-info">
            <h2 class="item-title">${item.name}</h2>
            <p><strong>Model:</strong> ${item.model}</p>
            <p><strong>In Stock:</strong> <span class="stock-count">${item.stock || 0}</span></p>
            <div class="quantity-selector">
              <label for="qty">Qty:</label>
              <input id="qty" type="number" min="1" max="${item.stock || 1}" value="1" />
            </div>
            <p><strong>Quality:</strong> ${item.quality}</p>
            <p><strong>Price:</strong> ${item.price} ${item.coinType}</p>
            <button onclick="addToCart('${item.id}', true)">Add to Cart</button>
          </div>
        </div>
        <div class="item-description-box">
          <h2>Description</h2>
          <div class="item-description">${item.description}</div>
        </div>
      `;

      renderItems(data.filter(i => i.id != id));
    });
}

// ---------------- CART ----------------
function addToCart(id, fromItemPage = false) {
  fetch(`${API}/api/items`)
    .then(res => res.json())
    .then(data => {
      const item = data.find(i => i.id == id);
      if (!item || item.stock <= 0) return alert("Out of stock");

      const qty = fromItemPage
        ? Math.max(1, parseInt(document.getElementById("qty")?.value || 1))
        : 1;

      let cart = JSON.parse(localStorage.getItem("cart")) || [];
      const existing = cart.find(i => i.id == id);

      if (existing) {
        existing.qty = (existing.qty || 1) + qty;
      } else {
        item.qty = qty;
        cart.push(item);
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      updateCartCount();
      alert("Item added to cart!");
    });
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const count = document.getElementById("cartCount");
  if (count) count.innerText = cart.reduce((sum, i) => sum + (i.qty || 1), 0);
}

function loadCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const container = document.getElementById("cartPageItems");
  const totalBox = document.getElementById("totalPrice");
  let total = 0;

  if (!container || !totalBox) return;

  if (!cart.length) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    totalBox.innerText = "";
    return;
  }

  container.innerHTML = cart.map((item, index) => {
    total += parseFloat(item.price) * (item.qty || 1);
    return `
      <div class="cart-item">
        <img src="${API}${item.photos[0]}" />
        <div>
          <h3>${item.name}</h3>
          <p>${item.price} ${item.coinType} × ${item.qty || 1}</p>
          <button onclick="removeFromCart(${index})">Remove</button>
        </div>
      </div>
    `;
  }).join("");

  totalBox.innerText = `Total: ${total.toFixed(2)} ${cart[0].coinType}`;
}

function removeFromCart(index) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  loadCart();
  updateCartCount();
}

function proceedToPay() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (!cart.length) return alert("Your cart is empty.");
  sessionStorage.setItem("cartCheckout", JSON.stringify(cart));
  window.location = "pay.html";
}

// ---------------- MINI CART ----------------
function setupMiniCart() {
  const cartIcon = document.getElementById("cartIcon");
  const miniCart = document.getElementById("miniCart");

  if (!cartIcon || !miniCart) return;

  cartIcon.style.cursor = "pointer";

  cartIcon.addEventListener("click", () => {
    miniCart.classList.toggle("hidden");
    miniCart.classList.toggle("visible");
    loadMiniCart();
  });

  document.addEventListener("click", e => {
    if (!miniCart.contains(e.target) && !cartIcon.contains(e.target)) {
      miniCart.classList.add("hidden");
      miniCart.classList.remove("visible");
    }
  });
}

function loadMiniCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartItemsEl = document.querySelector("#miniCart #cartItems");
  const cartTotalEl = document.querySelector("#miniCart #cartTotal");

  if (!cartItemsEl || !cartTotalEl) return;

  cartItemsEl.innerHTML = "";
  let total = 0;

  if (!cart.length) {
    cartItemsEl.innerHTML = "<p>Your cart is empty.</p>";
    cartTotalEl.textContent = "₦0";
    return;
  }

  cart.forEach((item, index) => {
    total += parseFloat(item.price || 0) * (item.qty || 1);
    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
      <div style="display:flex; align-items:center;">
        <img src="${API}${item.photos?.[0]}" alt="${item.name}" />
        <div style="margin-left:10px;">
          <p><strong>${item.name}</strong></p>
          <p>${item.price} ${item.coinType} × ${item.qty || 1}</p>
        </div>
        <div style="margin-right:10px;"> 
           <button class="mini-cart-remove" onclick="removeFromMiniCart(${index})">✕</button>
           </div>
      </div>
    `;
    cartItemsEl.appendChild(itemEl);
  });


  // Cart total
  cartTotalEl.textContent = `${total.toFixed(2)} ${cart[0].coinType || ''}`;

  // Add Clear Cart button
  const controls = document.createElement("div");
  controls.style.marginTop = "10px";
  controls.innerHTML = `
    <button onclick="clearMiniCart()" style="background:red;color:white;padding:5px 10px;border:none;border-radius:5px;">Clear Cart</button>
  `;
  cartItemsEl.appendChild(controls);
}
function removeFromMiniCart(index) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  loadMiniCart();
  updateCartCount();
}

function clearMiniCart() {
  if (confirm("Are you sure you want to clear the cart?")) {
    localStorage.removeItem("cart");
    loadMiniCart();
    updateCartCount();
  }
}




// ---------------- PAYMENT ----------------
function setupPayForm() {
  const form = document.getElementById("buyerForm");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const details = Object.fromEntries(new FormData(form));
    const cart = JSON.parse(localStorage.getItem("cart")) || [];

    const itemsList = cart.map(i => `${i.name} (x${i.qty || 1})`).join(", ");
    const total = cart.reduce((sum, i) => sum + (parseFloat(i.price) * (i.qty || 1)), 0).toFixed(2);
    const coinType = cart[0]?.coinType || '';

    details.items = itemsList;
    details.totalPrice = `${total} ${coinType}`;

    sessionStorage.setItem("buyerInfo", JSON.stringify(details));
    sessionStorage.setItem("cartCheckout", JSON.stringify(cart));

    fetch(`${API}/api/buyers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details)
    }).then(() => {
      window.location.href = "crypto-payment.html";
    });
  });
}

// ---------------- FINALIZE / CHECKOUT ----------------
function setupFinalizeButton() {
  const btn = document.getElementById("finalizeBtn");
  if (!btn) return;

  const cart = JSON.parse(sessionStorage.getItem("cartCheckout")) || [];
  const buyer = JSON.parse(sessionStorage.getItem("buyerInfo")) || {};

  if (!cart.length || !buyer.email) {
    alert("Cart or buyer info missing.\nPlease go through the checkout form first.");
    window.location.href = "pay.html";
    return;
  }

  btn.addEventListener("click", () => {
    fetch(`${API}/api/send-confirmation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: buyer.email,
        itemName: cart.map(i => `${i.qty || 1}x ${i.name}`).join(", ")
      })
    });

    fetch(`${API}/api/update-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart })
    });

    localStorage.removeItem("cart");
    sessionStorage.removeItem("cartCheckout");
    sessionStorage.removeItem("buyerInfo");

    alert("Thank you for shopping with us!");
    window.location.href = "index.html";
  });
}




function setupAdminPanel() {
  const itemForm = document.getElementById("itemForm");
  const slideForm = document.getElementById("slideshowForm");
  itemForm.addEventListener("submit", e => {
    e.preventDefault();
    const formData = new FormData(itemForm);
    fetch(`${API}/api/upload-item`, { method: "POST", body: formData }).then(() => location.reload());
  });
  slideForm.addEventListener("submit", e => {
    e.preventDefault();
    const formData = new FormData(slideForm);
    fetch(`${API}/api/upload-slideshow`, { method: "POST", body: formData }).then(() => location.reload());
  });
  fetch(`${API}/api/items`).then(res => res.json()).then(items => {
    const adminItems = document.getElementById("adminItems");
    adminItems.innerHTML = items.map(item => `
      <div style="margin:10px;">
        ${item.name} (${item.model}) - ${item.price} ${item.coinType}
        <button onclick="deleteItem('${item.id}')">Delete</button>
      </div>
    `).join("");
  });
  fetch(`${API}/api/slideshow`).then(res => res.json()).then(media => {
    const container = document.getElementById("adminSlideshow");
    container.innerHTML = media.map(file => `
      <div style="margin:10px;">
        ${file.path}
        <button onclick="deleteSlideshow('${file.id}')">Delete</button>
      </div>
    `).join("");
  });
}

function deleteItem(id) {
  fetch(`${API}/api/delete-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  }).then(() => location.reload());
}

function deleteSlideshow(id) {
  fetch(`${API}/api/delete-slideshow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  }).then(() => location.reload());
}

function loadBuyers() {
  fetch("/data/buyers.json")
    .then(res => res.json())
    .then(buyers => {
      const container = document.getElementById("adminBuyers");
      container.innerHTML = "";
      buyers.forEach((buyer, index) => {
        const div = document.createElement("div");
        div.innerHTML = `
          <div style="border:1px solid #ccc; padding:10px; margin-bottom:10px;">
            <strong>Email:</strong> ${buyer.email}<br/>
            <strong>Phone:</strong> ${buyer.phone}<br/>
            <strong>Address:</strong> ${buyer.address}, ${buyer.city}, ${buyer.state}, ${buyer.country} - ${buyer.postalCode}<br/>
            <strong>Items:</strong> ${buyer.items}<br/>
            <strong>Total:</strong> ${buyer.totalPrice}<br/>
            <small>${new Date(buyer.timestamp).toLocaleString()}</small><br/>
            <button onclick="deleteBuyer(${index})">🗑 Delete</button>
          </div>
        `;
        container.appendChild(div);
      });
    });
}

function deleteBuyer(index) {
  if (!confirm("Are you sure you want to delete this buyer?")) return;

  fetch(`${API}/api/delete-buyer/${index}`, {
    method: "DELETE"
  }).then(() => loadBuyers());
}

function clearAllBuyers() {
  if (!confirm("Are you sure you want to permanently delete all buyer records?")) return;

  fetch(`${API}/api/clear-buyers`, {
    method: "DELETE"
  }).then(() => loadBuyers());
}



function exportBuyersToCSV() {
  fetch("/data/buyers.json")
    .then(res => res.json())
    .then(data => {
      const headers = Object.keys(data[0]);
      const rows = data.map(buyer => headers.map(h => `"${buyer[h] || ''}"`).join(","));
      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "buyers.csv";
      a.click();
    });
}





// ---------------- INQUIRY + SUPPORT ----------------
function loadInquiries() {
  fetch(`${API}/data/inquiries.json`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("adminInquiries");
      if (!container) return;
      container.innerHTML = data.length
        ? data.map((i, index) => `
          <div class="admin-entry">
            <p><strong>Name:</strong> ${i.name}</p>
            <p><strong>Email:</strong> ${i.email}</p>
            <p><strong>Product:</strong> ${i.product || 'N/A'}</p>
            <p><strong>Message:</strong> ${i.message || i.text}</p>
            <small>${i.timestamp}</small>
            <button onclick="deleteInquiry(${index})">Delete</button>
          </div>
        `).join("")
        : "<p>No inquiries yet.</p>";
    });
}

function deleteInquiry(index) {
  if (!confirm("Delete this inquiry?")) return;
  fetch(`${API}/api/delete-inquiry/${index}`, { method: "DELETE" })
    .then(() => loadInquiries());
}

function loadSupportTickets() {
  fetch(`${API}/data/support.json`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("adminSupport");
      if (!container) return;
      container.innerHTML = data.length
        ? data.map((i, index) => `
          <div class="admin-entry">
            <p><strong>Name:</strong> ${i.name}</p>
            <p><strong>Email:</strong> ${i.email}</p>
            <p><strong>Order No:</strong> ${i.order || 'N/A'}</p>
            <p><strong>Issue:</strong> ${i.issue || i.text}</p>
            <small>${i.timestamp}</small>
            <button onclick="deleteSupport(${index})">Delete</button>
          </div>
        `).join("")
        : "<p>No support tickets yet.</p>";
    });
}

function deleteSupport(index) {
  if (!confirm("Delete this support ticket?")) return;
  fetch(`${API}/api/delete-support/${index}`, { method: "DELETE" })
    .then(() => loadSupportTickets());
}

// Auto-load if sections are present
if (document.getElementById("adminInquiries")) loadInquiries();
if (document.getElementById("adminSupport")) loadSupportTickets();
