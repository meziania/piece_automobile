const form = document.querySelector("#form");
const panels = [...document.querySelectorAll(".panel")];
const review = document.querySelector("#review");
const reviewList = document.querySelector("#reviewList");
const thanks = document.querySelector("#thanks");
const progress = document.querySelector("#progress");
const nav = document.querySelector("#nav");
const backBtn = document.querySelector("#back");
const nextBtn = document.querySelector("#next");
const errorEl = document.querySelector("#error");
const bar = document.querySelector("#bar");
const stepLabel = document.querySelector("#stepLabel");
const foot = document.querySelector("#foot");

let step = 0;
let onReview = false;

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

function selected(name, value) {
  return [...document.querySelectorAll(`[name="${name}"]`)].some(
    (input) => input.checked && input.value === value
  );
}

function applyConditions() {
  document.querySelectorAll("[data-show-if]").forEach((el) => {
    const [name, value] = el.dataset.showIf.split(":");
    const visible = selected(name, value);
    const wasHidden = el.hidden;
    el.hidden = !visible;
    if (!visible && !wasHidden) {
      el.querySelectorAll("input, textarea, select").forEach((input) => {
        if (input.type === "checkbox" || input.type === "radio") input.checked = false;
        else input.value = "";
      });
    }
  });
}

function decideurBlock() {
  const choice = document.querySelector('[name="decideur"]:checked')?.value;
  if (!choice) return t("Indiquez si cette personne décide des achats.");
  if (choice === "Non") return t("Cette personne ne décide pas des achats. Demandez à parler au décideur, sinon arrêtez.");
  return "";
}

function conditionallyHidden(el) {
  if (el.hidden && el.hasAttribute("data-show-if")) return true;
  let node = el.parentElement;
  while (node && node !== form) {
    if (node.hidden && node.hasAttribute("data-show-if")) return true;
    if (node.classList.contains("panel") || node.classList.contains("review")) return false;
    node = node.parentElement;
  }
  return false;
}

function choiceText(input) {
  return input.parentElement.querySelector("span")?.textContent.trim() || input.value;
}

function readField(field) {
  if (conditionallyHidden(field)) return "";
  const boxes = [...field.querySelectorAll('input[type="checkbox"]')];
  if (boxes.length) {
    return boxes.filter((box) => box.checked).map(choiceText).join(currentLang() === "ar" ? "، " : ", ");
  }
  const radios = [...field.querySelectorAll('input[type="radio"]')];
  if (radios.length) {
    const chosen = radios.find((radio) => radio.checked);
    return chosen ? choiceText(chosen) : "";
  }
  return [...field.querySelectorAll("input, textarea, select")]
    .filter((control) => !conditionallyHidden(control))
    .map((control) => {
      if (control.tagName === "SELECT") {
        const option = control.selectedOptions[0];
        return option && option.value ? option.textContent.trim() : "";
      }
      return control.value.trim();
    })
    .filter(Boolean)
    .join(" · ");
}

function render() {
  panels.forEach((panel, index) => {
    panel.hidden = onReview || index !== step;
  });
  review.hidden = !onReview;
  backBtn.hidden = step === 0 && !onReview;
  const current = onReview ? panels.length : step;
  const total = panels.length;
  bar.style.width = `${((current + (onReview ? 1 : 1)) / (total + 1)) * 100}%`;
  stepLabel.textContent = onReview
    ? t("Vérification")
    : currentLang() === "ar"
      ? `الخطوة ${step + 1} من ${total}`
      : `Étape ${step + 1} sur ${total}`;
  nextBtn.textContent = onReview ? t("Envoyer") : step === total - 1 ? t("Vérifier") : t("Continuer");
  if (onReview) {
    reviewList.replaceChildren();
    document.querySelectorAll(".field[data-label]").forEach((field) => {
      const value = readField(field);
      if (!value) return;
      const item = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = t(field.dataset.label);
      item.append(label, document.createTextNode(value));
      reviewList.append(item);
    });
  }
}

function collect() {
  const answers = {};
  const elements = [...form.querySelectorAll("input[name], textarea[name], select[name]")];
  elements.forEach((el) => {
    if (!el.name || el.name === "company_site" || conditionallyHidden(el)) return;
    if (el.type === "checkbox") {
      if (!answers[el.name]) answers[el.name] = [];
      if (el.checked) answers[el.name].push(el.value);
      return;
    }
    if (el.type === "radio") {
      if (el.checked) answers[el.name] = el.value;
      return;
    }
    const value = el.value.trim();
    if (value) answers[el.name] = value;
  });
  return answers;
}

let lastEmailed = false;

function paintThanks() {
  document.querySelector("#thanksText").textContent = lastEmailed
    ? t("Les réponses sont envoyées par email en PDF. Vous pouvez aussi le télécharger ici.")
    : t("Aucun email n'a été envoyé. Ouvrez le questionnaire sur cet ordinateur, pas sur le site Vercel.");
}

async function submit() {
  showError("");
  const answers = collect();
  if (decideurBlock()) {
    onReview = false;
    step = 0;
    render();
    showError(decideurBlock());
    return;
  }
  nextBtn.disabled = true;
  nextBtn.textContent = t("Envoi…");
  try {
    const response = await fetch("/api/reponse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        company_site: form.elements.company_site.value,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok || !data.downloadUrl) {
      throw new Error(t(data.error) || t("Envoi impossible."));
    }
    form.hidden = true;
    progress.hidden = true;
    foot.hidden = true;
    thanks.hidden = false;
    lastEmailed = Boolean(data.emailed);
    paintThanks();
    document.querySelector("#download").href = data.downloadUrl;
  } catch (error) {
    showError(error.message || t("Envoi impossible. Réessayez."));
    nextBtn.disabled = false;
    nextBtn.textContent = t("Envoyer");
  }
}

backBtn.addEventListener("click", () => {
  showError("");
  if (onReview) onReview = false;
  else step = Math.max(0, step - 1);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

nextBtn.addEventListener("click", () => {
  showError("");
  if (onReview) {
    submit();
    return;
  }
  if (step === 0) {
    const reason = decideurBlock();
    if (reason) {
      showError(reason);
      return;
    }
  }
  if (step < panels.length - 1) step += 1;
  else onReview = true;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

form.addEventListener("change", applyConditions);
document.addEventListener("langchange", () => {
  render();
  if (!thanks.hidden) paintThanks();
});

applyConditions();
render();
