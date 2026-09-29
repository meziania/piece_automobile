require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
const { buildPdf } = require("./lib/pdf");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data", "reponses");
const INDEX_PATH = path.join(DATA_DIR, "index.json");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(ROOT, "public"), { index: "index.html" }));

const hits = new Map();

function clientIp(req) {
  return req.ip || req.socket.remoteAddress || "local";
}

function limited(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 30) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function readIndex() {
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeIndex(rows) {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(rows, null, 2));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function oneLine(value, max = 80) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

function cleanAnswers(input) {
  const source = input && typeof input === "object" ? input : {};
  const clean = {};
  for (const [key, value] of Object.entries(source)) {
    if (!/^[a-z0-9_]+$/i.test(key)) continue;
    if (Array.isArray(value)) {
      const items = value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 20);
      if (items.length) clean[key] = items;
      continue;
    }
    if (typeof value === "string") {
      const text = value.trim().slice(0, 2000);
      if (text) clean[key] = text;
    }
  }
  return clean;
}

function cookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function adminToken() {
  return crypto.createHmac("sha256", ADMIN_PASSWORD || "unset").update("admin").digest("hex");
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const given = cookies(req).admin || "";
  const expected = adminToken();
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function mailConfigured() {
  return Boolean(process.env.MAIL_TO && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createdAtLabel() {
  return new Date().toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function mailSummary(record) {
  const answers = record.answers;
  const shop = oneLine(answers.nom_magasin || answers.contact_nom || "Magasin");
  const budget = oneLine(answers.budget);
  const essayer = oneLine(answers.essayer);
  const affaire = oneLine(answers.prix_affaire);
  const max = oneLine(answers.prix_max);
  return {
    shop,
    subject: `[Lafiray Salmia 2] Réponse — ${shop}`,
    text: [
      "Nouvelle réponse au questionnaire pièces auto, Lafiray Salmia 2.",
      "",
      `Magasin : ${shop}`,
      budget ? `Budget d'achat mensuel : ${budget}` : "",
      essayer ? `Prêt à essayer : ${essayer}` : "",
      affaire ? `Bonne affaire : ${affaire} DH` : "",
      max ? `Maximum accepté : ${max} DH` : "",
      "",
      "Le PDF complet est en pièce jointe.",
      `Référence : ${record.id}`,
    ].filter(Boolean).join("\n"),
  };
}

async function sendMail(record, pdf) {
  const summary = mailSummary(record);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT) === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO,
    subject: summary.subject,
    text: summary.text,
    attachments: [
      {
        filename: `reponse-salmiya2-${record.id}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

function pageShell(title, body) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="wrap admin-wrap">${body}</main>
</body>
</html>`;
}

function loginPage(error) {
  return pageShell("Accès aux PDF", `
    <p class="kicker">Salmiya 2 · Casablanca</p>
    <h1>Télécharger les PDF</h1>
    <p class="lede">Les réponses envoyées par email sont aussi archivées ici.</p>
    ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
    <form class="stack" method="post" action="/admin/login">
      <label class="field" data-label="Mot de passe">
        <span class="label">Mot de passe</span>
        <input type="password" name="password" autocomplete="current-password" required>
      </label>
      <button class="btn" type="submit">Entrer</button>
    </form>
  `);
}

function listPage(rows) {
  const items = rows.length
    ? `<ul class="file-list">${rows.map((row) => `
        <li>
          <div>
            <strong>${esc(row.nom || row.rue || "Magasin")}</strong>
            <span>${esc(row.rue || "")}</span>
            <span>${esc(row.createdAt)} · ${row.emailed ? "email envoyé" : "email non envoyé"}</span>
          </div>
          <a class="btn btn-small" href="/admin/fichier/${esc(row.id)}">Télécharger le PDF</a>
        </li>`).join("")}</ul>`
    : `<p class="lede">Aucune réponse pour le moment.</p>`;

  return pageShell("PDF reçus", `
    <p class="kicker">Archive</p>
    <div class="admin-head">
      <h1>Réponses PDF</h1>
      <a href="/admin/logout">Quitter</a>
    </div>
    ${items}
    <p class="footnote"><a href="/">Retour au questionnaire</a></p>
  `);
}

app.get("/admin", (req, res) => {
  if (!isAdmin(req)) {
    res.send(loginPage());
    return;
  }
  res.set("Cache-Control", "no-store");
  res.send(listPage(readIndex().slice().reverse()));
});

app.post("/admin/login", (req, res) => {
  const password = String(req.body.password || "");
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    res.status(401).send(loginPage("Mot de passe incorrect."));
    return;
  }
  res.setHeader("Set-Cookie", `admin=${adminToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  res.redirect("/admin");
});

app.get("/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", "admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.redirect("/admin");
});

app.get("/admin/fichier/:id", (req, res) => {
  if (!isAdmin(req)) {
    res.status(401).send(loginPage());
    return;
  }
  if (!/^[a-f0-9]{16}$/.test(req.params.id)) {
    res.status(404).send("Fichier introuvable.");
    return;
  }
  const file = path.join(DATA_DIR, `${req.params.id}.pdf`);
  if (!fs.existsSync(file)) {
    res.status(404).send("Fichier introuvable.");
    return;
  }
  res.download(file, `reponse-salmiya2-${req.params.id}.pdf`);
});

app.get("/telecharger/:id", (req, res) => {
  if (!/^[a-f0-9]{16}$/.test(req.params.id)) {
    res.status(404).send("Fichier introuvable.");
    return;
  }
  const row = readIndex().find((item) => item.id === req.params.id);
  const token = String(req.query.t || "");
  if (!row || token.length !== row.token.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(row.token))) {
    res.status(404).send("Fichier introuvable.");
    return;
  }
  const file = path.join(DATA_DIR, `${row.id}.pdf`);
  if (!fs.existsSync(file)) {
    res.status(404).send("Fichier introuvable.");
    return;
  }
  res.download(file, `reponse-salmiya2-${row.id}.pdf`);
});

app.post("/api/reponse", async (req, res) => {
  try {
    if (limited(req)) {
      res.status(429).json({ ok: false, error: "Trop de réponses. Réessayez plus tard." });
      return;
    }
    if (String(req.body.company_site || "").trim()) {
      res.json({ ok: true, emailed: false });
      return;
    }

    const answers = cleanAnswers(req.body.answers);
    if (answers.decideur !== "Oui") {
      res.status(400).json({ ok: false, error: "Seul le décideur des achats peut répondre." });
      return;
    }

    const record = {
      id: crypto.randomBytes(8).toString("hex"),
      token: crypto.randomBytes(18).toString("hex"),
      createdAt: createdAtLabel(),
      answers,
      emailed: false,
    };

    const pdf = await buildPdf(record);
    fs.writeFileSync(path.join(DATA_DIR, `${record.id}.pdf`), pdf);

    if (mailConfigured()) {
      try {
        await sendMail(record, pdf);
        record.emailed = true;
      } catch (error) {
        console.error("Email non envoyé:", error.message);
      }
    }

    const rows = readIndex();
    rows.push({
      id: record.id,
      token: record.token,
      createdAt: record.createdAt,
      nom: oneLine(answers.nom_magasin || answers.contact_nom, 120),
      rue: "Lafiray Salmia 2",
      emailed: record.emailed,
    });
    writeIndex(rows);

    res.json({
      ok: true,
      emailed: record.emailed,
      downloadUrl: `/telecharger/${record.id}?t=${record.token}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Envoi impossible pour le moment." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => `http://${item.address}:${PORT}`);
  console.log(`Questionnaire: http://localhost:${PORT}`);
  if (ips.length) console.log(`Téléphone (même Wi-Fi): ${ips.join("  ")}`);
  if (mailConfigured()) console.log(`Email PDF → ${process.env.MAIL_TO}`);
  else if (process.env.MAIL_TO) console.log(`Email prévu → ${process.env.MAIL_TO} (SMTP_PASS manquant)`);
  else console.log("Email non configuré: remplissez MAIL_TO dans .env");
  console.log(ADMIN_PASSWORD ? "Archive PDF: /admin" : "ADMIN_PASSWORD manquant dans .env");
});
