
(function () {
  const monitorId = "localStorageStatus";
  let panel = document.getElementById(monitorId);

  if (!panel) {
    panel = document.createElement("div");
    panel.id = monitorId;
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0,0,0,0.85);
      color: white;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 6px;
      z-index: 9999;
      line-height: 1.5;
    `;
    document.body.appendChild(panel);
  }

  function getLocalStorageUsage() {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key);
        total += key.length + (value ? value.length : 0);
      }
    }
    return total;
  }

  function formatBytes(bytes) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function getLocalStorageSizeInfo() {
  let totalBytes = 0;
  let photoBytes = 0;
  let photoCount = 0;

  for (let key in localStorage) {
    if (!localStorage.hasOwnProperty(key)) continue;

    const value = localStorage.getItem(key);
    if (!value) continue;

    try {
      const bytes = new Blob([value]).size;
      totalBytes += bytes;

      // Only count base64 image strings
      if (value.startsWith("data:image/")) {
        photoBytes += bytes;
        photoCount++;
      }

    } catch (err) {
      console.warn(`Error parsing localStorage key "${key}":`, err);
    }
  }

  const maxKB = 5 * 1024; // localStorage ~5MB
  const totalKB = totalBytes / 1024;
  const availableKB = maxKB - totalKB;

  return {
    totalKB: totalKB.toFixed(1),
    availableKB: availableKB.toFixed(1),
    photoKB: (photoBytes / 1024).toFixed(1),
    photoCount
  };
}


function renderLocalStorageStatus() {
  const content = document.getElementById("storageContent");
  if (!content) return;

  const { totalKB, availableKB, photoKB, photoCount } = getLocalStorageSizeInfo();

  content.innerHTML = `
    • Used: ${totalKB} KB<br>
    • Photos: ${photoKB} KB (${photoCount})<br>
    • Available: ${availableKB} KB
  `;
}

// setInterval(renderLocalStorageStatus, 2000);
// renderLocalStorageStatus();

// === Draggable functionality ===
(function makeDraggable() {
  const panel = document.getElementById("localStorageStatus");
  const header = document.getElementById("storageHeader");

  let offsetX = 0, offsetY = 0, isDragging = false;

  header.addEventListener("mousedown", e => {
    isDragging = true;
    offsetX = e.clientX - panel.offsetLeft;
    offsetY = e.clientY - panel.offsetTop;
    panel.style.transition = "none";
  });

  document.addEventListener("mouseup", () => isDragging = false);

  document.addEventListener("mousemove", e => {
    if (isDragging) {
      panel.style.left = `${e.clientX - offsetX}px`;
      panel.style.top = `${e.clientY - offsetY}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }
  });
})();

// === Collapsible toggle ===
document.getElementById("storageHeader").addEventListener("click", () => {
  const content = document.getElementById("storageContent");
  const header = document.getElementById("storageHeader");

  const isVisible = content.style.display !== "none";
  content.style.display = isVisible ? "none" : "block";
  header.textContent = isVisible ? "📦 localStorage Monitor ▲" : "📦 localStorage Monitor ▼";
});


setInterval(renderLocalStorageStatus, 1000); // Update every 1 seconds
renderLocalStorageStatus(); // Initial call

  function updatePanel() {
    const { total, photoBytes } = getLocalStorageUsage();
    const maxBytes = 5 * 1024 * 1024; // 5MB max
    const percent = ((total / maxBytes) * 100).toFixed(1);
    const photoPercent = ((photoBytes / total) * 100).toFixed(1);

    panel.innerHTML = `
      🗂 LocalStorage<br>
      Used: ${formatBytes(total)}<br>
      Limit: 5120 KB<br>
      Usage: ${percent}%<br>
      Photos: ${formatBytes(photoBytes)} (${photoPercent}%)
    `;
  }

  updatePanel();
  setInterval(updatePanel, 10000);
})();
