
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

    panel.innerHTML = `
      <div id="storageHeader" style="cursor: pointer;">📦 localStorage Monitor ▼</div>
      <div id="storageContent"></div>
      <audio id="storageAlertAudio" style="display:none">
        <source src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=" type="audio/wav">
      </audio>
    `;

    document.body.appendChild(panel);
  }

  let alertPlayed = false;
  const totalBytes = 0;
  const photoBytes = 0;
  const photoCount = 0;


  function getLocalStorageSizeInfo() {
    let totalBytes = 0;
    let photoBytes = 0;
    let photoCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (!value) continue;

      const size = new Blob([value]).size;
      totalBytes += size;

      // if (value.startsWith("data:image/")) {
      //   photoBytes += size;
      //   photoCount++;
      // }
      if (window.routeData && Array.isArray(window.routeData)) {
       for (const item of window.routeData) {
      if (item.type === "photo" && item.content && item.content.startsWith("data:image/")) {
      photoCount++;
      photoBytes += new Blob([item.content]).size;
    } 
  } 
} 
    }

    // const maxBytes = 5 * 1024 * 1024;
    // return {
    //   totalKB: (totalBytes / 1024).toFixed(1),
    //   availableKB: ((maxBytes - totalBytes) / 1024).toFixed(1),
    //   photoKB: (photoBytes / 1024).toFixed(1),
    //   photoCount,
    //   percent: ((totalBytes / maxBytes) * 100).toFixed(1)
    // };
  const maxKB = 5 * 1024;
  const totalKB = totalBytes / 1024;
  const availableKB = maxKB - totalKB;

  return {
    totalKB: totalKB.toFixed(1),
    availableKB: availableKB.toFixed(1),
    photoKB: (photoBytes / 1024).toFixed(1),
    photoCount,
    photoBytes, // ✅ Add this!
    totalBytes // optional but useful
  };
  }

  function renderLocalStorageStatus() {
    const content = document.getElementById("storageContent");
    if (!content) return;

    const audio = document.getElementById("storageAlertAudio");
    //const { totalKB, availableKB, photoKB, photoCount, percent } = getLocalStorageSizeInfo();
    const { totalKB, availableKB, photoKB, photoCount, photoBytes } = getLocalStorageSizeInfo();
    const percent = ((totalBytes / maxBytes) * 100).toFixed(1); // ✅ Calculate percent
  
    // content.innerHTML = `
    //   • Used: ${totalKB} KB (${percent}%)<br>
    //   • Photos: ${photoKB} KB (${photoCount})<br>
    //   • Photos in memory: ${photoCount} (${(photoBytes / 1024).toFixed(1)} KB)
    //   • Available: ${availableKB} KB
    // `;
  content.innerHTML = `
    • Used: ${totalKB} KB<br>
    • Photos in memory: ${photoCount} (${photoKB} KB)<br>
    • Available: ${availableKB} KB
  `;

    // Alert logic
    if (parseFloat(percent) >= 50) {
      panel.style.border = "2px solid red";
      panel.style.animation = "blink 1s infinite alternate";
      if (!alertPlayed) {
        if (audio && audio.play) audio.play().catch(() => {});
        alertPlayed = true;
      }
    } else {
      panel.style.border = "";
      panel.style.animation = "";
      alertPlayed = false;
    }
  }

  // Draggable
  (function makeDraggable() {
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

  // Toggle
  document.getElementById("storageHeader").addEventListener("click", () => {
    const content = document.getElementById("storageContent");
    const header = document.getElementById("storageHeader");
    const isVisible = content.style.display !== "none";
    content.style.display = isVisible ? "none" : "block";
    header.textContent = isVisible ? "📦 localStorage Monitor ▲" : "📦 localStorage Monitor ▼";
  });

  setInterval(renderLocalStorageStatus, 1000);
  renderLocalStorageStatus();
})();

// (function () {
//   const panel = document.createElement("div");
//   panel.id = "localStorageStatus";
//   panel.style.cssText = `
//     position: fixed;
//     bottom: 10px;
//     right: 10px;
//     background: rgba(0, 0, 0, 0.85);
//     color: white;
//     font-family: monospace;
//     font-size: 12px;
//     padding: 0;
//     border-radius: 6px;
//     z-index: 9999;
//     width: 220px;
//   `;

//   panel.innerHTML = `
//     <div id="storageHeader" style="cursor: pointer; padding: 6px; background: #333; border-radius: 6px 6px 0 0;">
//       📦 localStorage Monitor ▼
//     </div>
//     <div id="storageContent" style="padding: 10px; display: block;"></div>
//   `;

//   document.body.appendChild(panel);

//   function getLocalStorageSizeInfo() {
//     let totalBytes = 0;
//     let photoBytes = 0;
//     let photoCount = 0;

//     for (const key in localStorage) {
//       if (!localStorage.hasOwnProperty(key)) continue;

//       const value = localStorage.getItem(key);
//       if (!value) continue;

//       const size = new Blob([value]).size;
//       totalBytes += size;

//       if (value.startsWith("data:image/")) {
//         photoBytes += size;
//         photoCount++;
//       }
//     }

//     const maxKB = 5120;
//     const usedKB = totalBytes / 1024;
//     const availableKB = maxKB - usedKB;

//     return {
//       totalKB: usedKB.toFixed(1),
//       availableKB: availableKB.toFixed(1),
//       photoKB: (photoBytes / 1024).toFixed(1),
//       photoCount
//     };
//   }

//   function render() {
//     const content = document.getElementById("storageContent");
//     if (!content) return;

//     const { totalKB, availableKB, photoKB, photoCount } = getLocalStorageSizeInfo();

//     content.innerHTML = `
//       • Used: ${totalKB} KB<br>
//       • Photos: ${photoKB} KB (${photoCount})<br>
//       • Available: ${availableKB} KB
//     `;
//   }

//   // Collapsing
//   document.getElementById("storageHeader").addEventListener("click", () => {
//     const content = document.getElementById("storageContent");
//     const header = document.getElementById("storageHeader");
//     const isVisible = content.style.display !== "none";
//     content.style.display = isVisible ? "none" : "block";
//     header.textContent = isVisible ? "📦 localStorage Monitor ▲" : "📦 localStorage Monitor ▼";
//   });

//   // Draggable
//   (function makeDraggable() {
//     let offsetX = 0, offsetY = 0, isDragging = false;

//     const header = document.getElementById("storageHeader");

//     header.addEventListener("mousedown", e => {
//       isDragging = true;
//       offsetX = e.clientX - panel.offsetLeft;
//       offsetY = e.clientY - panel.offsetTop;
//       panel.style.transition = "none";
//     });

//     document.addEventListener("mouseup", () => isDragging = false);

//     document.addEventListener("mousemove", e => {
//       if (isDragging) {
//         panel.style.left = `${e.clientX - offsetX}px`;
//         panel.style.top = `${e.clientY - offsetY}px`;
//         panel.style.right = "auto";
//         panel.style.bottom = "auto";
//       }
//     });
//   })();

//   setInterval(render, 1000);
//   render();
// })();
