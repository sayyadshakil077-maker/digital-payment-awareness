(() => {
  "use strict";
  const btn = document.getElementById("downloadPdfBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const invoice = document.getElementById("invoice");
    if (!invoice || invoice.hidden) return;

    if (!window.html2canvas || !window.jspdf?.jsPDF) {
      alert("PDF library could not load. Check your internet connection and try again.");
      return;
    }

    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generating PDF...";

    try {
      const canvas = await window.html2canvas(invoice, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const imgHeight = canvas.height * usableWidth / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      const billNo = document.getElementById("rBillNo")?.textContent || "grocery-bill";
      pdf.save(`${billNo}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Could not generate the PDF. Please try Print Bill and choose Save as PDF.");
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });
})();
