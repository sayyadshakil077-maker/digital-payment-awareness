(() => {
  "use strict";

  const LOGIN_KEY = "digitalPayLoggedIn";
  const BILL_KEY = "dpa_grocery_current_bill";
  const COUNTER_KEY = "dpa_gs_invoice_counter";
  const SHOP_KEY = "dpa_gs_shop_settings";
  const HISTORY_KEY = "dpa_grocery_bill_history";
  const CATEGORIES = [
    "Rice & Grains", "Flour & Pulses", "Oil & Spices", "Dairy", "Beverages",
    "Biscuits & Snacks", "Chocolates & Sweets", "Personal Care", "Cleaning Products",
    "Household Items", "Stationery", "Other"
  ];
  const UNITS = ["Piece", "Pack", "Packet", "Kg", "Gram", "Litre", "ml", "Dozen", "Box", "Bottle", "Other"];

  if (sessionStorage.getItem(LOGIN_KEY) !== "true") {
    window.location.href = "../login.html";
    return;
  }

  const $ = (id) => document.getElementById(id);
  const form = $("billingForm");
  const productBody = $("productBody");
  let logoData = "";

  function money(n) {
    return `₹${Number(n || 0).toFixed(2)}`;
  }

  function safeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function getCounter() {
    const n = parseInt(localStorage.getItem(COUNTER_KEY) || "125", 10);
    return Number.isFinite(n) && n > 0 ? n : 125;
  }

  function formatInvoice(n) {
    return `GS-${String(n).padStart(6, "0")}`;
  }

  function setInvoiceDisplay() {
    const billNo = formatInvoice(getCounter());
    $("billNoDisplay").textContent = billNo;
    $("billNoInfo").textContent = billNo;
  }

  function setDateTime() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    $("dateInfo").textContent = `${dd}-${mm}-${yyyy}`;
    $("timeInfo").textContent = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function optionHtml(options, selected) {
    return options.map(v => `<option value="${v}" ${v === selected ? "selected" : ""}>${v}</option>`).join("");
  }

  function addProductRow(data = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="product-name" type="text" placeholder="Product name" value="${escapeAttr(data.name || "")}"></td>
      <td><select class="category">${optionHtml(CATEGORIES, data.category || "Other")}</select></td>
      <td><input class="qty" type="number" min="0.01" step="0.01" value="${data.quantity ?? 1}"></td>
      <td><select class="unit">${optionHtml(UNITS, data.unit || "Piece")}</select></td>
      <td><input class="rate" type="number" min="0" step="0.01" value="${data.price ?? 0}"></td>
      <td><input class="discount" type="number" min="0" step="0.01" value="${data.discount ?? 0}"></td>
      <td><input class="tax" type="number" min="0" max="100" step="0.01" value="${data.tax ?? 0}"></td>
      <td class="row-total">₹0.00</td>
      <td><button class="remove-btn" type="button" title="Remove product">✕</button></td>`;
    productBody.appendChild(tr);

    tr.querySelectorAll("input,select").forEach(el => el.addEventListener("input", calculate));
    tr.querySelector(".remove-btn").addEventListener("click", () => {
      tr.remove();
      if (!productBody.children.length) addProductRow();
      calculate();
    });
    calculate();
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function getRows() {
    return [...productBody.querySelectorAll("tr")];
  }

  function calculate() {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    getRows().forEach(tr => {
      const qty = safeNumber(tr.querySelector(".qty").value);
      const rate = safeNumber(tr.querySelector(".rate").value);
      const disc = safeNumber(tr.querySelector(".discount").value);
      const taxRate = safeNumber(tr.querySelector(".tax").value);
      const gross = qty * rate;
      const net = Math.max(0, gross - disc);
      const taxAmount = net * taxRate / 100;
      subtotal += gross;
      discount += disc;
      tax += taxAmount;
      tr.querySelector(".row-total").textContent = money(net);
    });

    const taxable = Math.max(0, subtotal - discount);
    const grand = taxable + tax;
    $("subtotalDisplay").textContent = money(subtotal);
    $("discountDisplay").textContent = `− ${money(discount)}`;
    $("taxDisplay").textContent = `+ ${money(tax)}`;
    $("grandTotalDisplay").textContent = money(grand);

    updatePayment(grand);
    return { subtotal, discount, taxable, tax, grand };
  }

  function updatePayment(grand) {
    const paid = safeNumber($("amountPaid").value);
    const balance = grand - paid;
    $("balanceDisplay").textContent = money(balance);

    const statusEl = $("paymentStatus");
    statusEl.className = "status";
    if (grand > 0 && paid >= grand - 0.005) {
      statusEl.textContent = "PAID";
      statusEl.classList.add("paid");
    } else if (paid > 0) {
      statusEl.textContent = "PARTIALLY PAID";
      statusEl.classList.add("partial");
    } else {
      statusEl.textContent = "PENDING";
      statusEl.classList.add("pending");
    }
  }

  function toggleTransactionField() {
    const method = $("paymentMethod").value;
    const show = method === "UPI" || method === "Debit Card" || method === "Credit Card";
    $("transactionField").hidden = !show;
    if (!show) $("transactionId").value = "";
  }

  function readProducts() {
    return getRows().map(tr => {
      const quantity = safeNumber(tr.querySelector(".qty").value);
      const price = safeNumber(tr.querySelector(".rate").value);
      const discount = safeNumber(tr.querySelector(".discount").value);
      const taxRate = safeNumber(tr.querySelector(".tax").value);
      const gross = quantity * price;
      const net = gross - discount;
      const taxAmount = Math.max(0, net) * taxRate / 100;
      return {
        name: tr.querySelector(".product-name").value.trim(),
        category: tr.querySelector(".category").value,
        quantity,
        unit: tr.querySelector(".unit").value,
        price,
        discount,
        tax: taxRate,
        gross,
        net,
        taxAmount
      };
    });
  }

  function validate(products, totals) {
    const errors = [];
    if (!$("shopName").value.trim()) errors.push("Shop name is required.");
    if (!$("shopAddress").value.trim()) errors.push("Shop address is required.");
    if (!$("shopMobile").value.trim()) errors.push("Shop mobile number is required.");
    if (!products.length) errors.push("Add at least one product.");

    products.forEach((p, i) => {
      const n = i + 1;
      if (!p.name) errors.push(`Product ${n}: product name cannot be empty.`);
      if (!(p.quantity > 0)) errors.push(`Product ${n}: quantity must be greater than 0.`);
      if (p.price < 0) errors.push(`Product ${n}: price cannot be negative.`);
      if (p.discount < 0) errors.push(`Product ${n}: discount cannot be negative.`);
      if (p.discount > p.gross) errors.push(`Product ${n}: discount cannot exceed product amount.`);
      if (p.tax < 0 || p.tax > 100) errors.push(`Product ${n}: tax must be between 0 and 100.`);
    });

    const paid = safeNumber($("amountPaid").value);
    if (paid < 0) errors.push("Amount paid cannot be negative.");
    if (!(totals.grand >= 0)) errors.push("Grand total is invalid.");
    return errors;
  }

  function showErrors(errors) {
    const box = $("formError");
    if (!errors.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<strong>Please fix these issues:</strong><br>${errors.map(e => `• ${e}`).join("<br>")}`;
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function buildBill(products, totals) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const paid = safeNumber($("amountPaid").value);
    const balance = totals.grand - paid;
    const status = totals.grand > 0 && paid >= totals.grand - 0.005 ? "PAID" : paid > 0 ? "PARTIALLY PAID" : "PENDING";

    return {
      schemaVersion: 1,
      invoiceNumber: formatInvoice(getCounter()),
      createdAt: now.toISOString(),
      date: `${dd}-${mm}-${yyyy}`,
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      shop: {
        name: $("shopName").value.trim(),
        tagline: $("shopTagline").value.trim(),
        address: $("shopAddress").value.trim(),
        mobile: $("shopMobile").value.trim(),
        gstin: $("gstin").value.trim(),
        taxMode: $("taxMode").value,
        logo: logoData
      },
      customer: {
        name: $("customerName").value.trim(),
        mobile: $("customerMobile").value.trim()
      },
      products,
      totals,
      payment: {
        method: $("paymentMethod").value,
        amountPaid: paid,
        balance,
        status,
        transactionId: $("transactionId").value.trim()
      }
    };
  }

  function saveShopSettings() {
    const settings = {
      name: $("shopName").value.trim(),
      tagline: $("shopTagline").value.trim(),
      address: $("shopAddress").value.trim(),
      mobile: $("shopMobile").value.trim(),
      gstin: $("gstin").value.trim(),
      taxMode: $("taxMode").value,
      logo: logoData
    };
    try { localStorage.setItem(SHOP_KEY, JSON.stringify(settings)); } catch (_) {}
  }

  function loadShopSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(SHOP_KEY) || "null");
      if (!settings) return;
      $("shopName").value = settings.name || $("shopName").value;
      $("shopTagline").value = settings.tagline || "";
      $("shopAddress").value = settings.address || $("shopAddress").value;
      $("shopMobile").value = settings.mobile || $("shopMobile").value;
      $("gstin").value = settings.gstin || "";
      $("taxMode").value = settings.taxMode || "intra";
      logoData = settings.logo || "";
      renderLogo();
    } catch (_) {}
  }

  function renderLogo() {
    const preview = $("logoPreview");
    preview.innerHTML = logoData ? `<img src="${logoData}" alt="Shop logo preview">` : "LOGO";
  }

  $("shopLogo").addEventListener("change", () => {
    const file = $("shopLogo").files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert("Please choose a logo smaller than 1.5 MB.");
      $("shopLogo").value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { logoData = String(reader.result || ""); renderLogo(); };
    reader.readAsDataURL(file);
  });

  $("removeLogoBtn").addEventListener("click", () => {
    logoData = "";
    $("shopLogo").value = "";
    renderLogo();
  });

  $("addProductBtn").addEventListener("click", () => addProductRow());
  $("paymentMethod").addEventListener("change", toggleTransactionField);
  $("amountPaid").addEventListener("input", calculate);

  $("loadSampleBtn").addEventListener("click", () => {
    $("shopName").value = "ABC GENERAL STORE";
    $("shopTagline").value = "Your Trusted Grocery Store";
    $("shopAddress").value = "Mumbai, Maharashtra";
    $("shopMobile").value = "98XXXXXXXX";
    $("customerName").value = "Rahul";
    $("customerMobile").value = "";
    $("paymentMethod").value = "UPI";
    $("transactionId").value = "DPA123456789";
    toggleTransactionField();
    productBody.innerHTML = "";
    addProductRow({ name:"Rice 5 kg", category:"Rice & Grains", quantity:1, unit:"Pack", price:350, discount:0, tax:0 });
    addProductRow({ name:"Milk", category:"Dairy", quantity:2, unit:"Packet", price:35, discount:0, tax:0 });
    addProductRow({ name:"Biscuits", category:"Biscuits & Snacks", quantity:3, unit:"Pack", price:20, discount:5, tax:0 });
    addProductRow({ name:"Soap", category:"Personal Care", quantity:2, unit:"Piece", price:40, discount:0, tax:0 });
    const totals = calculate();
    $("amountPaid").value = totals.grand.toFixed(2);
    calculate();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const totals = calculate();
    const products = readProducts();
    const errors = validate(products, totals);
    showErrors(errors);
    if (errors.length) return;

    const bill = buildBill(products, totals);
    saveShopSettings();

    try {
      localStorage.setItem(BILL_KEY, JSON.stringify(bill));
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      history.unshift(bill);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
      localStorage.setItem(COUNTER_KEY, String(getCounter() + 1));
    } catch (err) {
      showErrors(["Could not save the bill in this browser. Try removing a large shop logo or clearing some site storage."]);
      return;
    }

    window.location.href = "bill.html";
  });

  loadShopSettings();
  setInvoiceDisplay();
  setDateTime();
  addProductRow();
  toggleTransactionField();
  calculate();
  setInterval(setDateTime, 30000);
})();
