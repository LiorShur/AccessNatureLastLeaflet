
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

  function formatBytes(bytes) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function getLocalStorageSizeInfo() {
  let totalBytes = 0;
  let photoBytes = 0;

  for (let key in localStorage) {
    if (!localStorage.hasOwnProperty(key)) continue;

    const value = localStorage.getItem(key);
    const bytes = new Blob([value]).size;
    totalBytes += bytes;

    // Check if value is a base64 image
    if (typeof value === 'string' && value.startsWith("data:image/")) {
      photoBytes += bytes;
    }

    // Alternatively, check for images in structured JSON
    else if (value.includes("data:image/")) {
      const matches = value.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
      if (matches) {
        matches.forEach(base64Img => {
          photoBytes += new Blob([base64Img]).size;
        });
      }
    }
  }

  return {
    totalKB: (totalBytes / 1024).toFixed(1),
    photoKB: (photoBytes / 1024).toFixed(1),
    availableKB: ((5 * 1024) - (totalBytes / 1024)).toFixed(1)
  };
}

function renderLocalStorageStatus() {
  const div = document.getElementById("localStorageStatus");
  if (!div) return;

  const { totalKB, photoKB, availableKB } = getLocalStorageSizeInfo();

  div.innerHTML = `
    📦 localStorage Usage:<br>
    • Used: ${totalKB} KB<br>
    • Photos: ${photoKB} KB<br>
    • Available: ${availableKB} KB
  `;
}

setInterval(renderLocalStorageStatus, 2000); // Update every 2 seconds
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
