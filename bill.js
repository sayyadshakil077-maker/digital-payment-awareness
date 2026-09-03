(() => {
  "use strict";

  const BILL_KEY = "dpa_grocery_current_bill";
  const LOGIN_KEY = "digitalPayLoggedIn";
  const $ = (id) => document.getElementById(id);

  if (sessionStorage.getItem(LOGIN_KEY) !== "true") {
    window.location.href = "../login.html";
    return;
  }

  function money(n) {
    return `₹${Number(n || 0).toFixed(2)}`;
  }

  function text(id, value) {
    $(id).textContent = value ?? "";
  }

  function loadBill() {
    try { return JSON.parse(localStorage.getItem(BILL_KEY) || "null"); }
    catch (_) { return null; }
  }

  const bill = loadBill();
  if (!bill || !bill.shop || !Array.isArray(bill.products)) {
    $("billError").hidden = false;
    $("billError").innerHTML = `No saved bill was found. <a href="billing.html">Create a bill first.</a>`;
    $("invoice").hidden = true;
    return;
  }

  text("invoiceShopName", bill.shop.name || "GENERAL STORE");
  text("invoiceTagline", bill.shop.tagline || "");
  text("invoiceAddress", bill.shop.address || "");
  text("invoicePhone", bill.shop.mobile ? `Phone: ${bill.shop.mobile}` : "");
  if (bill.shop.gstin) {
    $("invoiceGstinWrap").hidden = false;
    text("invoiceGstin", bill.shop.gstin);
  }
  if (bill.shop.logo) {
    $("invoiceLogoWrap").hidden = false;
    $("invoiceLogo").src = bill.shop.logo;
  }

  text("rBillNo", bill.invoiceNumber);
  text("rDate", bill.date);
  text("rTime", bill.time);
  if (bill.customer?.name) {
    $("rCustomerWrap").hidden = false;
    text("rCustomer", bill.customer.name);
  }
  if (bill.customer?.mobile) {
    $("rMobileWrap").hidden = false;
    text("rMobile", bill.customer.mobile);
  }

  const tbody = $("receiptProducts");
  tbody.innerHTML = "";
  bill.products.forEach((p, index) => {
    const tr = document.createElement("tr");
    const qtyLabel = `${p.quantity} ${p.unit || ""}`.trim();
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.category || "")}</small></td>
      <td>${escapeHtml(qtyLabel)}</td>
      <td>${money(p.price)}</td>
      <td>${money(p.discount)}</td>
      <td>${Number(p.tax || 0).toFixed(2)}%</td>
      <td>${money(p.net)}</td>`;
    tbody.appendChild(tr);
  });

  const totals = bill.totals || {};
  text("rSubtotal", money(totals.subtotal));
  text("rDiscount", `− ${money(totals.discount)}`);
  text("rTaxable", money(totals.taxable));
  text("rGrandTotal", money(totals.grand));

  const totalTax = Number(totals.tax || 0);
  if (totalTax > 0.0001) {
    if (bill.shop.taxMode === "inter") {
      $("rIgstWrap").hidden = false;
      text("rIgst", money(totalTax));
    } else {
      $("rCgstWrap").hidden = false;
      $("rSgstWrap").hidden = false;
      text("rCgst", money(totalTax / 2));
      text("rSgst", money(totalTax / 2));
    }
  }

  const payment = bill.payment || {};
  text("rPaymentMethod", payment.method || "—");
  text("rPaymentStatus", payment.status === "PAID" ? "✓ PAID" : payment.status || "PENDING");
  text("rAmountPaid", money(payment.amountPaid));
  text("rBalance", money(payment.balance));
  if (payment.transactionId && payment.method !== "Cash") {
    $("rTransactionWrap").hidden = false;
    text("rTransactionId", payment.transactionId);
  }

  $("printBillBtn").addEventListener("click", () => window.print());
  $("newBillBtn").addEventListener("click", () => {
    if (!confirm("Are you sure you want to start a new bill?")) return;
    localStorage.removeItem(BILL_KEY);
    window.location.href = "billing.html";
  });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }
})();
