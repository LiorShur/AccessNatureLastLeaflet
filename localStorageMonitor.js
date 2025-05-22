
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

  function getLocalStorageUsage() {
    let total = 0;
    let photoBytes = 0;

    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key);
        const size = key.length + (value ? value.length : 0);
        total += size;

        if (key.toLowerCase().includes("photo") || (value && value.startsWith("data:image/"))) {
          photoBytes += size;
        }
      }
    }
    return { total, photoBytes };
  }

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
