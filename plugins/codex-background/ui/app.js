const form = document.querySelector("#settingsForm");
const previewCanvas = document.querySelector("#previewCanvas");
const dropZone = document.querySelector("#dropZone");
const placementStage = document.querySelector("#placementStage");
const illustration = document.querySelector("#illustration");
const imageInput = document.querySelector("#imageInput");
const imageName = document.querySelector("#imageName");
const imageAdvice = document.querySelector("#imageAdvice");
const connection = document.querySelector("#connection");
const connectionText = document.querySelector("#connectionText");
const actionNote = document.querySelector("#actionNote");
const saveButton = document.querySelector("#saveButton");
const startButton = document.querySelector("#startButton");
const toast = document.querySelector("#toast");
const positionButtons = [...document.querySelectorAll("[data-x][data-y]")];
const sizeButtons = [...document.querySelectorAll("[data-size]")];

const rangeSettings = {
  illustrationSize: { suffix: " px", multiplier: 1 },
  illustrationBlur: { suffix: " px", multiplier: 1 },
  illustrationOpacity: { suffix: "%", multiplier: 100 },
  illustrationX: { suffix: "%", multiplier: 1 },
  illustrationY: { suffix: "%", multiplier: 1 },
};

let toastTimer;
let dragDepth = 0;
let draggingIllustration = false;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && typeof options.body === "string" ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function notify(message, error = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", error);
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), error ? 6500 : 3500);
}

function setBusy(button, busy, busyText) {
  const label = button.querySelector("span");
  if (!button.dataset.label) button.dataset.label = (label || button).textContent.trim();
  button.disabled = busy;
  (label || button).textContent = busy ? busyText : button.dataset.label;
}

function updateRange(input) {
  const output = document.querySelector(`#${input.id}Output`);
  const settings = rangeSettings[input.id];
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const value = Number(input.value);
  input.style.setProperty("--range-fill", `${((value - minimum) / (maximum - minimum)) * 100}%`);
  output.value = `${Math.round(value * settings.multiplier)}${settings.suffix}`;
}

function updatePresetStates() {
  const x = Number(form.elements.illustrationX.value);
  const y = Number(form.elements.illustrationY.value);
  const size = Number(form.elements.illustrationSize.value);
  positionButtons.forEach((button) => {
    const active = Math.abs(Number(button.dataset.x) - x) <= 2 && Math.abs(Number(button.dataset.y) - y) <= 2;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  sizeButtons.forEach((button) => {
    const active = Number(button.dataset.size) === size;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updatePreview() {
  const size = Number(form.elements.illustrationSize.value);
  const x = Number(form.elements.illustrationX.value);
  const y = Number(form.elements.illustrationY.value);
  const blur = Number(form.elements.illustrationBlur.value);
  const opacity = Number(form.elements.illustrationOpacity.value);
  document.documentElement.style.setProperty("--illustration-preview-size", `${Math.min(80, Math.max(7, (size / 1200) * 100))}%`);
  document.documentElement.style.setProperty("--illustration-x", `${x}%`);
  document.documentElement.style.setProperty("--illustration-y", `${y}%`);
  document.documentElement.style.setProperty("--illustration-blur", `${blur}px`);
  document.documentElement.style.setProperty("--illustration-opacity", opacity);
  Object.keys(rangeSettings).forEach((id) => updateRange(document.querySelector(`#${id}`)));
  updatePresetStates();
}

function renderConnection(status) {
  if (!status.imageReadable) {
    connection.dataset.state = "error";
    connectionText.textContent = "插图不可读取";
  } else if (status.cdpAvailable && status.daemonRunning) {
    connection.dataset.state = "connected";
    connectionText.textContent = "人物背景已连接";
  } else if (status.cdpAvailable) {
    connection.dataset.state = "ready";
    connectionText.textContent = "Codex 可立即应用";
  } else {
    connection.dataset.state = "ready";
    connectionText.textContent = "等待启动背景模式";
  }
}

function updateImageAdvice(imagePath) {
  const extension = imagePath?.split(".").pop()?.toLowerCase();
  const opaque = extension === "jpg" || extension === "jpeg";
  imageAdvice.classList.toggle("is-warning", opaque);
  imageAdvice.textContent = opaque
    ? "当前图片有矩形底；人物插图建议换成透明 PNG / WebP"
    : "透明背景会自然融入 Codex 原生界面";
}

function renderState(payload) {
  const { config, status } = payload;
  form.elements.enabled.checked = config.enabled;
  form.elements.illustrationSize.value = config.illustrationSize;
  form.elements.illustrationX.value = config.illustrationX;
  form.elements.illustrationY.value = config.illustrationY;
  form.elements.illustrationBlur.value = config.illustrationBlur;
  form.elements.illustrationOpacity.value = config.illustrationOpacity;
  imageName.textContent = config.image ? config.image.split("/").pop() : "尚未选择图片";
  imageName.title = config.image || "";
  updateImageAdvice(config.image);
  if (config.image) illustration.style.setProperty("--preview-image", `url("/api/image?v=${Date.now()}")`);
  else illustration.style.removeProperty("--preview-image");
  renderConnection(status);
  startButton.disabled = !config.enabled || !status.imageReadable;
  updatePreview();
}

function configFromForm() {
  return {
    enabled: form.elements.enabled.checked,
    illustrationSize: Number(form.elements.illustrationSize.value),
    illustrationX: Number(form.elements.illustrationX.value),
    illustrationY: Number(form.elements.illustrationY.value),
    illustrationBlur: Number(form.elements.illustrationBlur.value),
    illustrationOpacity: Number(form.elements.illustrationOpacity.value),
  };
}

function describeApplication(application) {
  if (!application) return "人物布景已保存。";
  if (application.mode === "injected") return `人物布景已应用到 ${application.targets} 个 Codex 窗口。`;
  if (application.mode === "started") return `背景模式已启动，并应用到 ${application.targets} 个 Codex 窗口。`;
  if (application.mode === "removed") return "人物背景已关闭，Codex 原生界面保持不变。";
  if (application.reason === "cdp-unavailable") return "布景已保存。请正常退出 Codex，保持此页面开启，然后点击“启动背景模式”。";
  if (application.reason === "image-missing") return "布景已保存，请先选择一张人物插图。";
  return "人物布景已保存。";
}

async function saveSettings(event) {
  event.preventDefault();
  setBusy(saveButton, true, "正在摆放");
  try {
    const payload = await api("/api/config", { method: "PUT", body: JSON.stringify(configFromForm()) });
    renderState(payload);
    const message = describeApplication(payload.application);
    actionNote.textContent = message;
    notify(message);
  } catch (error) {
    notify(error.message, true);
  } finally {
    setBusy(saveButton, false, "正在摆放");
  }
}

async function startBackground() {
  setBusy(startButton, true, "正在连接");
  try {
    const payload = await api("/api/start", { method: "POST" });
    renderState(payload);
    const message = describeApplication(payload.application);
    actionNote.textContent = message;
    notify(message);
  } catch (error) {
    actionNote.textContent = error.message;
    notify(error.message, true);
  } finally {
    setBusy(startButton, false, "正在连接");
  }
}

async function uploadImage(file) {
  if (!file) return;
  const accepted = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
  if (!accepted.includes(file.type)) return notify("请选择 PNG、JPEG、WebP、GIF 或 AVIF 图片。", true);
  if (file.size > 25 * 1024 * 1024) return notify("图片不能超过 25 MB。", true);

  const temporaryUrl = URL.createObjectURL(file);
  illustration.style.setProperty("--preview-image", `url("${temporaryUrl}")`);
  imageName.textContent = file.name;
  notify("正在把人物插图放入本地布景台……");
  try {
    const payload = await api("/api/image", { method: "POST", body: file, headers: { "content-type": file.type } });
    renderState(payload);
    const message = describeApplication(payload.application);
    actionNote.textContent = message;
    notify(`人物插图已更换。${message}`);
  } catch (error) {
    notify(error.message, true);
  } finally {
    URL.revokeObjectURL(temporaryUrl);
    imageInput.value = "";
  }
}

function positionFromPointer(event) {
  const bounds = placementStage.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
  form.elements.illustrationX.value = Math.round(x);
  form.elements.illustrationY.value = Math.round(y);
  updatePreview();
}

illustration.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  draggingIllustration = true;
  illustration.classList.add("is-dragging");
  illustration.setPointerCapture(event.pointerId);
  positionFromPointer(event);
});

illustration.addEventListener("pointermove", (event) => {
  if (draggingIllustration) positionFromPointer(event);
});

illustration.addEventListener("pointerup", (event) => {
  draggingIllustration = false;
  illustration.classList.remove("is-dragging");
  illustration.releasePointerCapture(event.pointerId);
});

illustration.addEventListener("pointercancel", () => {
  draggingIllustration = false;
  illustration.classList.remove("is-dragging");
});

form.addEventListener("submit", saveSettings);
startButton.addEventListener("click", startBackground);
imageInput.addEventListener("change", () => uploadImage(imageInput.files[0]));
form.addEventListener("input", (event) => {
  if (event.target.matches('input[type="range"]')) updatePreview();
});

positionButtons.forEach((button) => button.addEventListener("click", () => {
  form.elements.illustrationX.value = button.dataset.x;
  form.elements.illustrationY.value = button.dataset.y;
  updatePreview();
}));

sizeButtons.forEach((button) => button.addEventListener("click", () => {
  form.elements.illustrationSize.value = button.dataset.size;
  updatePreview();
}));

dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  dropZone.classList.add("is-file-dragging");
});
dropZone.addEventListener("dragover", (event) => event.preventDefault());
dropZone.addEventListener("dragleave", () => {
  dragDepth -= 1;
  if (dragDepth <= 0) {
    dragDepth = 0;
    dropZone.classList.remove("is-file-dragging");
  }
});
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove("is-file-dragging");
  uploadImage(event.dataTransfer.files[0]);
});

api("/api/state").then(renderState).catch((error) => {
  connection.dataset.state = "error";
  connectionText.textContent = "设置服务异常";
  notify(error.message, true);
});
