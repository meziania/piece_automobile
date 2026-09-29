const PDFDocument = require("pdfkit");
const schema = require("./schema");

function asNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatDh(value) {
  const n = asNumber(value);
  if (n == null) return String(value);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n)} DH`;
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
  if (field.format === "dh") return formatDh(value);
  if (field.format === "pct") return formatPct(value);
  return String(value);
}

function priceRange(answers) {
  const points = ["prix_doute", "prix_affaire", "prix_cher", "prix_trop"]
    .map((key) => asNumber(answers[key]))
    .filter((value) => value != null);
  if (points.length < 2) return null;
  return points.map((value) => formatDh(value)).join(" / ");
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
    const shop = answers.nom_magasin || answers.contact_nom || "Magasin";

    doc.fillColor("#8f3d2b").font("Helvetica").fontSize(9).text(
      "ÉTUDE DE MARCHÉ  ·  PIÈCES AUTOMOBILES  ·  LAFIRAY SALMIA 2, CASABLANCA",
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
        const range = priceRange(answers);
        if (range) rows.push(["Fourchette déclarée (trop bas / trop cher)", range]);
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
        `Confidentiel  ·  Lafiray Salmia 2  ·  ${i - range.start + 1}/${range.count}`,
        48,
        doc.page.height - 34,
        { lineBreak: false, width }
      );
    }

    doc.end();
  });
}

module.exports = { buildPdf, asNumber, formatDh };
