const PDFDocument = require("pdfkit");
const schema = require("./schema");

function asNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatMad(value) {
  const n = asNumber(value);
  if (n == null) return String(value);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n)} MAD`;
}

function formatPct(value) {
  const n = asNumber(value);
  if (n == null) return String(value);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n)} %`;
}

function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === "";
}

function display(field, value) {
  if (Array.isArray(value)) return value.join(", ");
  if (field.format === "mad") return formatMad(value);
  if (field.format === "pct") return formatPct(value);
  return String(value);
}

function margeLine(achat, vente) {
  const a = asNumber(achat);
  const v = asNumber(vente);
  if (a == null || v == null) return null;
  const delta = v - a;
  const money = formatMad(delta);
  if (a <= 0) return money;
  const pct = Math.round((delta / a) * 100);
  return `${money} (${pct} %)`;
}

function buildPdf(record) {
  const answers = record.answers || {};
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      bufferPages: true,
      info: {
        Title: "Réponse questionnaire pièces auto — Salmiya 2",
        Author: "Étude de marché Salmiya 2",
      },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const shop = answers.nom || answers.rue || "Magasin";

    doc.fillColor("#8f3d2b").font("Helvetica").fontSize(9).text(
      "ÉTUDE DE MARCHÉ  ·  PIÈCES AUTOMOBILES  ·  SALMIYA 2, CASABLANCA",
      { width, characterSpacing: 0.4 }
    );
    doc.moveDown(0.45);
    doc.fillColor("#1a1814").font("Helvetica-Bold").fontSize(20).text(String(shop), { width });
    doc.moveDown(0.25);
    doc.fillColor("#5c564c").font("Helvetica").fontSize(10).text(
      `Reçu le ${record.createdAt}   ·   Réf. ${record.id}`,
      { width }
    );
    doc.moveDown(0.5);
    doc.strokeColor("#d9d0c3").moveTo(48, doc.y).lineTo(48 + width, doc.y).stroke();
    doc.moveDown(0.8);

    for (const section of schema) {
      const rows = [];
      for (const field of section.fields) {
        const value = answers[field.key];
        if (isEmpty(value)) continue;
        rows.push([field.label, display(field, value)]);
      }

      if (section.title === "Prix") {
        const m1 = margeLine(answers.p1_achat, answers.p1_vente);
        const m2 = margeLine(answers.p2_achat, answers.p2_vente);
        const m3 = margeLine(answers.p3_achat, answers.p3_vente);
        if (m1) rows.push(["Marge pièce 1 (vente client − achat)", m1]);
        if (m2) rows.push(["Marge pièce 2 (vente client − achat)", m2]);
        if (m3) rows.push(["Marge pièce 3 (vente − achat)", m3]);
        const bas = asNumber(answers.prix_doute);
        const haut = asNumber(answers.prix_max);
        if (bas != null && haut != null) {
          rows.push([
            "Zone de prix d'achat acceptable (pièce 1)",
            `${formatMad(bas)} - ${formatMad(haut)}`,
          ]);
        }
      }

      if (!rows.length) continue;

      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.fillColor("#8f3d2b").font("Helvetica-Bold").fontSize(12).text(section.title, { width });
      doc.moveDown(0.15);
      doc.strokeColor("#e4d5cc").moveTo(48, doc.y).lineTo(120, doc.y).stroke();
      doc.moveDown(0.45);

      for (const [label, value] of rows) {
        const labelHeight = doc.font("Helvetica").fontSize(8).heightOfString(label, { width });
        const valueHeight = doc.font("Helvetica").fontSize(11).heightOfString(value, { width });
        if (doc.y + labelHeight + valueHeight + 14 > doc.page.height - 56) doc.addPage();
        doc.fillColor("#8a8175").font("Helvetica").fontSize(8).text(label, { width });
        doc.fillColor("#1a1814").font("Helvetica").fontSize(11).text(value, { width });
        doc.moveDown(0.45);
      }
      doc.moveDown(0.35);
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#8a8175").text(
        `Confidentiel  ·  Salmiya 2  ·  ${i - range.start + 1}/${range.count}`,
        48,
        doc.page.height - 34,
        { lineBreak: false, width }
      );
    }

    doc.end();
  });
}

module.exports = { buildPdf, asNumber, formatMad };
