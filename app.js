// === GLOBAL VARIABLES ===
let map, marker, watchId;
let path = [];
let routeData = [];
let lastCoords = null;
let totalDistance = 0;
let startTime = null;
let timerInterval = null;
let isPaused = false;
let elapsedTime = 0;
let mediaRecorder;
let audioChunks = [];
let isTracking = false;

function setControlButtonsEnabled(enabled) {
  const idsToDisable = [
    "startBtn",
    "resetBtn",
    "prepareAndExportBtn",
    "exportAllRoutesBtn",
    "exportDataBtn",
    "exportPDFBtn",
    "exportGPXBtn",
    "toggleArchivePanelBtn",
    "clearArchiveBtnBtn",
    "closeHistoryBtn",
    "clearAllSessionsBtn",
    "clearAllAppDataBtn",
    "loadSessionBtn",
  ];

  idsToDisable.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !enabled;
      el.style.opacity = enabled ? "1" : "0.5";
      el.style.pointerEvents = enabled ? "auto" : "none";
    }
  });
}


function setTrackingButtonsEnabled(enabled) {
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (startBtn) startBtn.disabled = !enabled;
  if (pauseBtn) pauseBtn.disabled = !enabled;
  if (stopBtn) stopBtn.disabled = !enabled;
}

const noteIcon = L.divIcon({
  className: 'custom-icon note-icon',
  html: '📝',
  iconSize: [36, 36]
});

const photoIcon = L.divIcon({
  className: 'custom-icon photo-icon',
  html: '📸',
  iconSize: [36, 36]
});
const audioIcon = L.divIcon({
  className: 'custom-icon audio-icon',
  html: '<span title="Audio">🎙️</span>',
  iconSize: [24, 24]
});

const videoIcon = L.divIcon({
  className: 'custom-icon video-icon',
  html: '<span title="Video">🎬</span>',
  iconSize: [24, 24]
});

// const noteIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Note">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <path fill="orange" d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/>
//         <text x="6" y="17" font-size="12" fill="black">📝</text>
//       </svg>
//     </div>`
// });

// const photoIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Photo">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <path fill="#2196F3" d="M21 19V5H3v14h18zM3 3h18a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2z"/>
//         <circle cx="12" cy="12" r="3" fill="white"/>
//       </svg>
//     </div>`
// });

// const audioIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Audio">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <rect x="9" y="4" width="6" height="14" fill="purple"/>
//         <path d="M5 10v4h2v-4H5zm12 0v4h2v-4h-2z" fill="gray"/>
//       </svg>
//     </div>`
// });

// const videoIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Video">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <rect x="4" y="5" width="14" height="14" fill="#4CAF50"/>
//         <polygon points="10,9 15,12 10,15" fill="white"/>
//       </svg>
//     </div>`
// });

// === INIT LEAFLET MAP ===

function initMap(callback) {
  //   // If a map already exists on this container, remove it
  if (map && map.remove) {
    map.remove(); // Clean up the previous map instance
  }
//   // Now safely initialize a new map
  map = L.map('map').setView([0, 0], 15);

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Add initial marker at [0, 0]
  marker = L.marker([0, 0]).addTo(map).bindPopup("Start").openPopup();

  // Try to get user location and delay view update to avoid premature map interaction
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // Use a short timeout to ensure map is ready before setting view
        setTimeout(() => {
          map.setView(userLocation, 17);
          marker.setLatLng(userLocation);
        }, 150); // slight delay to avoid _leaflet_pos error
      },
      error => {
        console.warn("Geolocation failed or denied, using default.");
      }
    );
  }

  if (callback) callback();
}


// === BACKUP & AUTOSAVE ===
let autoSaveInterval = null;

function startAutoBackup() {
  autoSaveInterval = setInterval(() => {
    const backupData = { routeData, totalDistance, elapsedTime };
    localStorage.setItem("route_backup", JSON.stringify(backupData));
    console.log("🔄 Auto-saved route progress.");
  }, 20000);
}

function stopAutoBackup() {
  clearInterval(autoSaveInterval);
  localStorage.removeItem("route_backup");
  console.log("✅ Auto-backup stopped and cleared.");
}

// === TIMER ===
function startTimer() {
  elapsedTime = 0;
  startTime = Date.now();
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const now = Date.now();
  elapsedTime = now - startTime;
  const hrs = Math.floor(elapsedTime / (1000 * 60 * 60));
  const mins = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((elapsedTime % (1000 * 60)) / 1000);
  const formatted = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  document.getElementById("timer").textContent = formatted;
  //document.getElementById("liveTimer").textContent = formatted;
}

function resumeTimer() {
  if (!timerInterval) {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }
}

// function pad(n) {
//   return n.toString().padStart(2, "0");
// }

// === DISTANCE ===
function haversineDistance(coord1, coord2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// === ROUTE TRACKING ===

function disableStartButton() {
  const btn = document.getElementById("startBtn");
  if (btn) {
    btn.disabled = true;
  }
}

window.startTracking = function () {
  openAccessibilityForm();

  setTrackingButtonsEnabled(true);
  document.getElementById("startBtn").disabled = true;
  document.getElementById("resetBtn").disabled = true;

  isTracking = true;
  setControlButtonsEnabled(false);  // ⛔ disable unrelated controls


  startAutoBackup();

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 25) return;

        const latLng = { lat: latitude, lng: longitude };

        if (lastCoords) {
          const dist = haversineDistance(lastCoords, latLng);
          if (dist > 0.2) return; // skip GPS jumps
          totalDistance += dist;
        }

        lastCoords = latLng;
        path.push(latLng);
        marker.setLatLng(latLng);
        map.panTo(latLng);

        // Draw new polyline for the path
        if (path.length > 1) {
          const segment = [path[path.length - 2], path[path.length - 1]];
          L.polyline(segment, { color: 'green' }).addTo(map);
        }

        routeData.push({
          type: "location",
          timestamp: Date.now(),
          coords: latLng
        });

        document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
        //document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    //startTimer();
    startTime = Date.now() - elapsedTime;
clearInterval(timerInterval);
updateTimerDisplay();
timerInterval = setInterval(updateTimerDisplay, 1000);

  } else {
    alert("Geolocation not supported");
  }
};

window.stopTracking = function () {
  
  if (watchId) navigator.geolocation.clearWatch(watchId);
  stopTimer();
  stopAutoBackup();
const wantsToFill = confirm("Do you want to fill out the accessibility questionnaire?");
if (wantsToFill) openAccessibilityForm();

  const wantsToSave = confirm("💾 Do you want to save this route?");
  if (wantsToSave) {
    const wasSaved = saveSession(); // returns true if saved
    if (wasSaved) {
      //Summary();
      resetApp();
    } else {
      resumeTracking();
    }
  } else {
    resumeTracking();
  }
};

function resetApp() {
  // Clear state
  routeData = [];
  path = [];
  lastCoords = null;
  totalDistance = 0;
  elapsedTime = 0;
  startTime = null;
  isPaused = false;

  // Reset display
  document.getElementById("distance").textContent = "0.00 km";
  document.getElementById("timer").textContent = "00:00:00";
  // document.getElementById("liveDistance").textContent = "0.00 km";
  // document.getElementById("liveTimer").textContent = "00:00:00";

  // Stop autosave and clear backup
  stopAutoBackup();
  localStorage.removeItem("route_backup");

  // Re-enable Start button, disable Pause/Stop
  // document.getElementById("startBtn").disabled = false;
  // document.getElementById("pauseBtn").disabled = true;
  // document.getElementById("stopBtn").disabled = true;
  // document.getElementById("resetBtn").disabled = false;

  // Clear map layers if needed
  if (map) {
    map.eachLayer(layer => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
  }

  // Re-add base tile layer and marker
  if (!map) {
    initMap();
  }

  const defaultView = [0, 0];
  map.setView(defaultView, 15);
  marker = L.marker(defaultView).addTo(map).bindPopup("Start").openPopup();

  // Try to recenter map on user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.setView(userLocation, 17);
        marker.setLatLng(userLocation);
      },
      error => {
        console.warn("Geolocation failed or denied, using default.");
      }
    );
  }
  setTrackingButtonsEnabled(true);
  document.getElementById("resetBtn").disabled = false;
  isTracking = false;
  setControlButtonsEnabled(true);   // ✅ re-enable controls

  console.log("🧹 App reset — ready for a new session!");
}

window.confirmAndResetApp = function () {
  // if (routeData.length > 0) {
  //   const confirmReset = confirm("⚠️ Are you sure you want to reset?");
  //   if (!confirmReset) return;
  // }
  const confirmReset = confirm("⚠️ Are you sure you want to reset?");
  if (confirmReset) resetApp();
  //resetApp();
};

function resumeTracking() {
  // Restart timer interval even if timer was running silently
  clearInterval(timerInterval);
  startTime = Date.now() - elapsedTime;
  timerInterval = setInterval(updateTimerDisplay, 1000);

  // Resume location tracking
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 25) return;

        const latLng = { lat: latitude, lng: longitude };
        if (lastCoords) {
          const dist = haversineDistance(lastCoords, latLng);
          if (dist > 0.2) return;
          totalDistance += dist;
        }

        lastCoords = latLng;
        path.push(latLng);
        marker.setLatLng(latLng);
        map.panTo(latLng);
        L.polyline(path, { color: 'green' }).addTo(map);

        routeData.push({ type: "location", timestamp: Date.now(), coords: latLng });
        document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
        //document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  startAutoBackup();
}

function Summary() {
  alert(`🏁 Route Stats:
Total Distance: ${totalDistance.toFixed(2)} km
Total Time: ${document.getElementById("timer").textContent}`);
}

// === TRACKING ===
window.togglePause = function () {
  isPaused = !isPaused;
  document.getElementById("pauseButtonLabel").textContent = isPaused ? "Resume" : "Pause";
  if (!isPaused) {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 1000);
  } else {
    clearInterval(timerInterval);
  }
};

function pad(n) {
  return n.toString().padStart(2, "0");
}

// === MEDIA CAPTURE ===
window.capturePhoto = () => document.getElementById("photoInput").click();
window.captureVideo = () => document.getElementById("videoInput").click();

window.addTextNote = function () {
  const note = prompt("Enter your note:");
  if (note) {
    navigator.geolocation.getCurrentPosition(position => {
      routeData.push({
        type: "text",
        timestamp: Date.now(),
        coords: { lat: position.coords.latitude, lng: position.coords.longitude },
        content: note
      });
      alert("Note saved.");
    });
  }
};

window.startAudioRecording = function () {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          navigator.geolocation.getCurrentPosition(pos => {
            routeData.push({
              type: "audio",
              timestamp: Date.now(),
              coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              content: reader.result
            });
            alert("Audio saved.");
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000);
    })
    .catch(() => alert("Microphone access denied"));
};

function compressImage(file, quality, callback) {
  const img = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    img.src = reader.result;
  };
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const maxWidth = 600;  // Reduce max width
    const quality = 0.5;   // Lower quality from 0.7 to 0.5
    const scale = Math.min(1, maxWidth / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL("image/jpeg", quality));
  };

  reader.readAsDataURL(file);
}

// === MEDIA INPUT EVENTS ===
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("photoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          routeData.push({
            type: "photo",
            timestamp: Date.now(),
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            content: reader.result
          });
          alert("Photo saved.");
        });
      };
      // reader.readAsDataURL(file);
      compressImage(file, 0.7, base64 => {
  navigator.geolocation.getCurrentPosition(pos => {
    routeData.push({
      type: "photo",
      timestamp: Date.now(),
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      content: base64
    });
    alert("📷 Compressed photo saved.");
  });
});

    }
  });

  document.getElementById("videoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          routeData.push({
            type: "video",
            timestamp: Date.now(),
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            content: reader.result
          });
          alert("Video saved.");
        });
      };
      reader.readAsDataURL(file);
    }
  });
});

function openAccessibilityForm() {
  document.getElementById("accessibilityOverlay").style.display = "flex";
}

function closeAccessibilityForm() {
  document.getElementById("accessibilityOverlay").style.display = "none";
}

// Save handler
document.getElementById("accessibilityForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const accessibilityData = {};

  for (const [key, value] of formData.entries()) {
    accessibilityData[key] = value;
  }

  localStorage.setItem("accessibilityData", JSON.stringify(accessibilityData));
  alert("✅ Questionnaire saved!");
  closeAccessibilityForm();
});

// ===  ROUTE & NOTES ===
let noteMarkers = []; // Global array to track note markers

function showRouteDataOnMap() {
  if (noteMarkers.length > 0) {
    noteMarkers.forEach(marker => marker.remove());
    noteMarkers = [];
  }

  if (!routeData || routeData.length === 0) {
    alert("No notes, photos, or media found in this route.");
    return;
  }

  const bounds = L.latLngBounds([]);
  let noteCounter = 1, photoCounter = 1, audioCounter = 1, videoCounter = 1;

  routeData.forEach(entry => {
    const { coords, type, content } = entry;
    if (!coords) return;

    if (type === "location") {
      bounds.extend(coords);
      return;
    }

    let icon, tooltip, popupHTML;

    switch (type) {
      case "text":
        icon = noteIcon;
        tooltip = `Note ${noteCounter}`;
        popupHTML = `<b>${tooltip}</b><br><p>${content}</p>`;
        noteCounter++;
        break;
      case "photo":
        icon = photoIcon;
        tooltip = `Photo ${photoCounter}`;
        popupHTML = `<b>${tooltip}</b><br><img src="${content}" style="width:150px" onclick="showMediaFullScreen('${content}', 'photo')">`;
        photoCounter++;
        break;
      case "audio":
        icon = audioIcon;
        tooltip = `Audio ${audioCounter}`;
        popupHTML = `<b>${tooltip}</b><br><audio controls src="${content}"></audio>`;
        audioCounter++;
        break;
      case "video":
        icon = videoIcon;
        tooltip = `Video ${videoCounter}`;
        popupHTML = `<b>${tooltip}</b><br><video controls width="200" src="${content}" onclick="showMediaFullScreen('${content}', 'video')"></video>`;
        videoCounter++;
        break;
    }

    const marker = L.marker(coords, { icon }).addTo(map);
    marker.bindTooltip(tooltip);
    marker.bindPopup(popupHTML);

    noteMarkers.push(marker);
    bounds.extend(coords);
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds);
  } else {
    map.setZoom(17);
  }
}


// === FULLSCREEN MEDIA VIEWER ===
window.showMediaFullScreen = function (content, type) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0, 0, 0, 0.8)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "20px";
  closeBtn.style.right = "20px";
  closeBtn.style.padding = "10px 20px";
  closeBtn.style.backgroundColor = "#f44336";
  closeBtn.style.color = "#fff";
  closeBtn.onclick = () => document.body.removeChild(overlay);

  overlay.appendChild(closeBtn);

  const media = document.createElement(type === "photo" ? "img" : "video");
  media.src = content;
  media.style.maxWidth = "90%";
  media.style.maxHeight = "90%";
  if (type === "video") media.controls = true;

  overlay.appendChild(media);
  document.body.appendChild(overlay);
};

// === SAVE SESSION ===

window.addEventListener("beforeunload", function (e) {
  if (routeData.length > 0) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

window.saveSession = function () {
  console.log("🔍 Attempting to save session...");

    if (!routeData || routeData.length === 0) {
    alert("⚠️ No route data to save.");
    return false;
  }

  const name = prompt("Enter a name for this route:");
  if (!name) return false;

  const session = {
    name,
    date: new Date().toISOString(),
    time: document.getElementById("timer").textContent,
    distance: totalDistance.toFixed(2),
    data: routeData
  };

  try {
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.push(session);
    localStorage.setItem("sessions", JSON.stringify(sessions));
    localStorage.removeItem("route_backup");

    alert(`✅ Route saved successfully!

🏁 Route Summary:
📏 Distance: ${totalDistance.toFixed(2)} km
⏱️ Time: ${document.getElementById("timer").textContent}`);
    document.getElementById("resetBtn").disabled = false;
    loadSavedSessions();
    return true;
  } catch (e) {
    console.error("❌ Save failed:", e);
    alert("❌ Could not save the route.");
    return false;
  }
  document.getElementById("resetBtn").disabled = false;
  initMap();
};

// window.saveSession = function () {
//   console.log("🔍 Attempting to save session...");

//   if (!routeData || routeData.length === 0) {
//     alert("⚠️ No route data to save. Please start tracking before saving.");
//     console.warn("❌ Save aborted: routeData is empty.");
//     return;
//   }

//   const name = prompt("Enter a name for this route:");
//   if (!name) {
//     console.log("⛔ Save cancelled — no name provided.");
//     return;
//   }

//   const session = {
//     name,
//     date: new Date().toISOString(),
//     time: document.getElementById("timer").textContent,
//     distance: totalDistance.toFixed(2),
//     data: routeData
//   };

//   // ⚠️ Estimate session size
//   const estimatedSizeKB = new Blob([JSON.stringify(session)]).size / 1024;
//   console.log("Estimated session size:", estimatedSizeKB.toFixed(2), "KB");
//   if (estimatedSizeKB > 4500) {
//     alert("⚠️ This route is too large to save in local storage. Please export or reduce media.");
//     return;
//   }

//   // 🌐 Save large media to IndexedDB
//   const indexedDBRequest = indexedDB.open("RouteMediaDB", 1);

//   indexedDBRequest.onupgradeneeded = function (event) {
//     const db = event.target.result;
//     if (!db.objectStoreNames.contains("media")) {
//       db.createObjectStore("media", { keyPath: "id" });
//     }
//   };

//   indexedDBRequest.onsuccess = function (event) {
//     const db = event.target.result;
//     const tx = db.transaction("media", "readwrite");
//     const store = tx.objectStore("media");

//     routeData.forEach((entry, i) => {
//       if (["photo", "audio", "video"].includes(entry.type)) {
//         const id = `media_${Date.now()}_${i}`;
//         store.put({ id, data: entry.content });
//         entry.mediaId = id;
//         delete entry.content;  // Detach base64
//       }
//     });

//     tx.oncomplete = function () {
//       try {
//         const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
//         sessions.push(session);
//         localStorage.setItem("sessions", JSON.stringify(sessions));
//         localStorage.removeItem("route_backup");

//         alert("✅ Route saved successfully!");
//         loadSavedSessions();
//       } catch (e) {
//         console.error("❌ Save failed. Possibly storage is full or corrupted:", e);
//         alert("❌ Could not save the route. Try exporting or clearing older data.");
//       }
//     };

//     tx.onerror = function (e) {
//       console.error("❌ IndexedDB transaction failed", e);
//     };
//   };

//   indexedDBRequest.onerror = function (e) {
//     console.error("❌ Failed to open IndexedDB", e);
//     alert("❌ Failed to open local database for saving media.");
//   };
//   document.getElementById("resetBtn").disabled = false;
//   initMap();
// };


// === LOAD SESSION LIST ===
window.loadSavedSessions = function () {
  const list = document.getElementById("savedSessionsList");
  list.innerHTML = "";
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

  sessions.forEach((session, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${session.name}</strong>
      <button id=loadSessionBtn" onclick="loadSession(${index})">View</button>
    `;
    list.appendChild(li);
  });
};

// === LOAD A SESSION ===

window.loadSession = function (index) {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  const session = sessions[index];

  if (!session || !session.data || session.data.length === 0) {
    alert("❌ This session has no data to export.");
    return;
  }

  routeData = session.data;
  totalDistance = parseFloat(session.distance);
  elapsedTime = 0;
  lastCoords = null;

  path = routeData.filter(e => e.type === "location").map(e => e.coords);

  document.getElementById("timer").textContent = session.time;
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
  //document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

  const accessibilityEntry = session.data.find(e => e.type === "accessibility");
  if (accessibilityEntry) {
  prefillAccessibilityForm(accessibilityEntry.content);
  }

  initMap(() => {
    drawSavedRoutePath();
    showRouteDataOnMap();
    setTrackingButtonsEnabled(false);

    //disableStartButton();
  });

  //document.getElementById("exportSummaryBtn").disabled = false;
};

// === LOAD SESSION + IndexDB===
// window.loadSession = async function (index) {
//   const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
//   const session = sessions[index];

//   if (!session || !session.data || session.data.length === 0) {
//     alert("❌ This session has no data to export.");
//     return;
//   }

//   routeData = [];
//   for (const entry of session.data) {
//     if (entry.mediaId) {
//       try {
//         const base64 = await getMediaFromIndexedDB(entry.mediaId);
//         routeData.push({ ...entry, content: base64 });
//       } catch {
//         routeData.push({ ...entry, content: null });
//       }
//     } else {
//       routeData.push(entry);
//     }
//   }

//   totalDistance = parseFloat(session.distance);
//   elapsedTime = 0;
//   lastCoords = null;

//   path = routeData.filter(e => e.type === "location").map(e => e.coords);

//   document.getElementById("timer").textContent = session.time;
//   document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";

//   initMap(() => {
//     drawSavedRoutePath();
//     showRouteDataOnMap();
//     setTrackingButtonsEnabled(false);
//   });

//   //document.getElementById("exportSummaryBtn").disabled = false;
// };


function drawSavedRoutePath() {
  if (!map || path.length === 0) return;

  const polyline = L.polyline(path, {
    color: 'green',
    weight: 3
  }).addTo(map);

  const bounds = polyline.getBounds();
  map.fitBounds(bounds);

  if (!marker) {
    marker = L.marker(path[0]).addTo(map).bindPopup("Start").openPopup();
  } else {
    marker.setLatLng(path[0]);
  }
}

function loadMostRecentSession(callback) {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  if (sessions.length === 0) {
    alert("❌ No saved sessions found to export.");
    return;
  }

  const mostRecent = sessions[sessions.length - 1];
  routeData = mostRecent.data;
  totalDistance = parseFloat(mostRecent.distance);
  elapsedTime = 0;

  path = routeData.filter(e => e.type === "location").map(e => e.coords);

  // Update UI
  document.getElementById("timer").textContent = mostRecent.time;
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
  //document.getElementById("liveTimer").textContent = mostRecent.time;
  //document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

  if (typeof initMap === "function") {
    initMap(() => {
      drawSavedRoutePath();
      showRouteDataOnMap();
      setTrackingButtonsEnabled(false);

      //disableStartButton();
      if (typeof callback === "function") callback();
    });
  } else if (typeof callback === "function") {
    callback(); // proceed even if map doesn't load
  }
}

function toggleExportDropdown() {
  const dropdown = document.getElementById("exportDropdown");
  if (!dropdown) return;

  dropdown.style.display = dropdown.style.display === "none" || dropdown.style.display === ""
    ? "block"
    : "none";
}

// === EXPORT JSON ===
window.exportData = function () {
  const fileName = `route-${new Date().toISOString()}.json`;
  const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// === EXPORT GPX ===
window.exportData = function () {
  const fileName = `route-${new Date().toISOString()}.json`;
  const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.exportGPX = function () {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NatureTracker" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Route</name><trkseg>\n`;

  routeData
    .filter(e => e.type === "location")
    .forEach(e => {
      gpx += `<trkpt lat="${e.coords.lat}" lon="${e.coords.lng}">
  <time>${new Date(e.timestamp).toISOString()}</time>
</trkpt>\n`;
    });

  gpx += `</trkseg></trk></gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `route-${Date.now()}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// === EXPORT PDF ===
window.exportPDF = async function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;

  doc.setFontSize(16);
  doc.text("Nature Tracker - Route Summary", 10, y);
  y += 10;

  for (const entry of routeData) {
    if (y > 260) {
      doc.addPage();
      y = 10;
    }

    doc.setFontSize(12);
    doc.text(`Type: ${entry.type}`, 10, y); y += 6;
    doc.text(`Time: ${new Date(entry.timestamp).toLocaleString()}`, 10, y); y += 6;
    doc.text(`Lat: ${entry.coords.lat.toFixed(5)}, Lng: ${entry.coords.lng.toFixed(5)}`, 10, y); y += 6;

    if (entry.type === "text") {
      doc.text(`Note: ${entry.content}`, 10, y); y += 10;
    }
    else if (entry.type === "photo") {
      try {
        doc.addImage(entry.content, "JPEG", 10, y, 50, 40);
        y += 50;
      } catch {
        doc.text("Photo not embedded", 10, y); y += 10;
      }
    }
    else if (entry.type === "audio") {
      doc.text("Audio note recorded (not embeddable)", 10, y); y += 10;
    }
    else if (entry.type === "video") {
      doc.text("Video recorded (not embeddable)", 10, y); y += 10;
    }
  }

  doc.save(`route-${Date.now()}.pdf`);
};

// === SHAREABLE LINK ===
window.generateShareableLink = function () {
  const json = JSON.stringify(routeData);
  const base64 = btoa(json);
  const url = `${location.origin}${location.pathname}?data=${encodeURIComponent(base64)}`;

  navigator.clipboard.writeText(url)
    .then(() => alert("Shareable link copied to clipboard!"));
};

// === ON LOAD SHARED LINK HANDLER ===

window.onload = function () {

  window.addEventListener("beforeunload", function (e) {
  if (isTracking) {
    e.preventDefault();
    e.returnValue = '';
  }
});

  const params = new URLSearchParams(window.location.search);
  const base64Data = params.get("data");

  if (base64Data) {
    try {
      const json = atob(base64Data);
      const sharedData = JSON.parse(json);
      routeData = sharedData;
      console.log("✅ Shared route loaded.");

      path = routeData.filter(e => e.type === "location").map(e => e.coords);

      initMap(() => {
        drawSavedRoutePath();
        showRouteDataOnMap();
        setTrackingButtonsEnabled(false);

      });
    } catch (e) {
      console.error("❌ Invalid shared data:", e);
      alert("⚠️ Failed to load shared route.");
    }
  } else {
    const backup = localStorage.getItem("route_backup");
    if (backup) {
      const restore = confirm("🛠️ Unsaved route found! Would you like to restore it?");
      if (restore) {
        try {
          const backupData = JSON.parse(backup);
          if (!backupData.routeData || backupData.routeData.length === 0) {
            throw new Error("Backup routeData is empty or invalid.");
          }

          routeData = backupData.routeData;
          totalDistance = backupData.totalDistance || 0;
          elapsedTime = backupData.elapsedTime || 0;

          path = routeData.filter(e => e.type === "location").map(e => e.coords);

          initMap(() => {
            drawSavedRoutePath();
            showRouteDataOnMap();
            //setTrackingButtonsEnabled(false);

            //disableStartButton();
          });

          document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
          //document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

          startTime = Date.now() - elapsedTime;
          updateTimerDisplay();
          setTrackingButtonsEnabled(true);
          startAutoBackup();
          //startTimer();
          //updateTimerDisplay(); // ✅ only display the recovered time
          // Do not auto-start the timer or backup
          
          

          //disableStartButton();

          alert("✅ Route recovered successfully!");
        } catch (e) {
          console.error("❌ Failed to restore backup:", e);
          alert("⚠️ Could not restore saved backup. Data might be corrupted.");
          resetApp();
          localStorage.removeItem("route_backup");
        }
      } else {
        localStorage.removeItem("route_backup");
        resetApp();
      }
    } else {
      console.log("ℹ️ No backup found. Loading session list.");
      loadSavedSessions();
      if (!map) initMap(); // Fallback map init if no session or route loaded
    }
  }

  // Ensure map initializes if nothing was triggered above
  if (!map) initMap();
};

// === SUMMARY ARCHIVE MODULE ===

function toggleArchivePanel() {
  const panel = document.getElementById("archivePanel");
  const arrow = document.getElementById("archiveArrow");

  panel.classList.toggle("open");
  if (panel.classList.contains("open")) {
    arrow.textContent = "▲";
    SummaryArchive.showArchiveBrowser("archivePanel");
  } else {
    arrow.textContent = "▼";
  }
}

const SummaryArchive = (() => {
  const STORAGE_KEY = "summary_archive";

  function getArchive() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  }

  function saveToArchive(name, htmlContent, media = {}) {
    const archive = getArchive();
    archive.push({
      id: Date.now(),
      name,
      date: new Date().toISOString(),
      html: htmlContent,
      media
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
    alert("✅ Route summary saved to archive!");
  }

  function listSummaries() {
    return getArchive();
  }

  function deleteSummary(id) {
  const confirmed = confirm("🗑️ Are you sure you want to delete this route summary?");
  if (!confirmed) return;

  const archive = getArchive();
  const updatedArchive = archive.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedArchive));

  // Smooth fade-out effect
  const container = document.getElementById("archivePanel");
  if (container) {
    const listItems = container.querySelectorAll("li");
    listItems.forEach(li => {
      if (li.innerHTML.includes(`SummaryArchive.deleteSummary(${id})`)) {
        li.classList.add("fade-out", "remove");
        setTimeout(() => {
          li.remove();
          if (container.querySelectorAll("li").length === 0) {
            showArchiveBrowser(); // rebuild the empty UI
          }
        }, 500);
      }
    });
  }
}


  function viewSummary(id) {
    const item = getArchive().find(entry => entry.id === id);
    if (!item) return alert("Summary not found!");

    const blob = new Blob([item.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  function clearAll() {
    const confirmClear = confirm("⚠️ This will delete all saved summaries permanently. Continue?");
    if (confirmClear) {
      localStorage.removeItem(STORAGE_KEY);
      showArchiveBrowser();
      alert("🧹 Archive cleared!");
      toggleArchivePanel();
    }
  }

  function showArchiveBrowser(containerId = "archivePanel") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const archive = getArchive();
    container.innerHTML = "<h3>📜 Saved Route Summaries</h3>";

    if (archive.length === 0) {
      container.innerHTML += "<p>No summaries found.</p>";
      return;
    }

    const ul = document.createElement("ul");
    archive.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `
        <b>${item.name}</b> (${item.date.split("T")[0]})
        <button onclick="SummaryArchive.viewSummary(${item.id})">View</button>
        <button onclick="SummaryArchive.deleteSummary(${item.id})">🗑️ Delete</button>
      `;
      ul.appendChild(li);
    });

    container.appendChild(ul);
  }

  return {
    saveToArchive,
    listSummaries,
    viewSummary,
    deleteSummary,
    showArchiveBrowser,
    clearAll
  };
})();

function generateAccessibilityHTML(accessibilityData) {
  if (!accessibilityData) return "";

  return `
    <div id="accessibilityDetails">
      <h3>♿ Accessibility Details</h3>
      <ul>
        <li><b>Disabled Parking:</b> ${accessibilityData.disabledParkingCount || "N/A"}</li>
        <li><b>Path Type:</b> ${accessibilityData.pathType || "N/A"}</li>
        <li><b>Accessible Length:</b> ${accessibilityData.accessibleLength || "N/A"} m</li>
        <li><b>Route Type:</b> ${accessibilityData.routeType || "N/A"}</li>
        <li><b>Slope:</b> ${accessibilityData.slope || "N/A"}</li>
        <li><b>Points of Interest:</b> ${accessibilityData.pointsOfInterest || "N/A"}</li>
        <li><b>Lookouts:</b> ${accessibilityData.lookouts ? "Yes" : "No"}</li>
        <li><b>Picnic Spots:</b> ${accessibilityData.picnicSpots ? "Yes" : "No"}</li>
        <li><b>Accessible Toilets:</b> ${accessibilityData.accessibleToilets ? "Yes" : "No"}</li>
        <li><b>Benches:</b> ${accessibilityData.benches ? "Yes" : "No"}</li>
        <li><b>Shade:</b> ${accessibilityData.shade || "N/A"}</li>
      </ul>
    </div>
  `;
}

// async function exportRouteSummary() {
//   console.log("📦 Attempting route export...");

//   if (!routeData || !Array.isArray(routeData) || routeData.length === 0) {
//     alert("⚠️ No route data available to export. Please track or load a route first.");
//     return;
//   }

//   const hasLocation = routeData.some(entry => entry.type === "location");
//   if (!hasLocation) {
//     alert("⚠️ No location data found in this session.");
//     return;
//   }

//   //const name = prompt("Enter a title for this route summary:");
//   const mostRecent = JSON.parse(localStorage.getItem("sessions") || "[]").slice(-1)[0];
//   const defaultName = mostRecent?.name || "My Route";
//   const name = prompt("Enter a title for this route summary:", defaultName);

//   if (!name) return;

//   const zip = new JSZip();
//   const notesFolder = zip.folder("notes");
//   const imagesFolder = zip.folder("images");
//   const audioFolder = zip.folder("audio");

//   let markersJS = "";
//   let pathCoords = [];
//   let noteCounter = 1;
//   let photoCounter = 1;
//   let audioCounter = 1;
//   let videoCounter = 1;

//   for (const entry of routeData) {
//     if (entry.type === "location") {
//       pathCoords.push([entry.coords.lat, entry.coords.lng]);
//     } else if (entry.type === "text") {
//       notesFolder.file(`note${noteCounter}.txt`, entry.content);
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
//   icon: L.divIcon({ className: 'custom-icon', html: '📝', iconSize: [24, 24] })
// })
//   .addTo(map)
//   .bindTooltip("Note ${noteCounter++}")
//   .bindPopup("<b>Note ${noteCounter - 1}</b><br><pre>${entry.content}</pre>");
// `;
//       noteCounter++;
//     } else if (entry.type === "photo") {
//       const base64Data = entry.content.split(",")[1];
//       imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
//   icon: L.divIcon({ className: 'custom-icon', html: '📸', iconSize: [24, 24] })
// })
//   .addTo(map)
//   .bindTooltip("Photo ${photoCounter++}")
//   .bindPopup("<b>Photo ${photoCounter - 1}</b><br><img src='images/photo${photoCounter - 1}.jpg' style='width:200px'>");
// `;
//       photoCounter++;
//     } else if (entry.type === "audio") {
//       const base64Data = entry.content.split(",")[1];
//       audioFolder.file(`audio${audioCounter}.webm`, base64Data, { base64: true });
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}])
//   .addTo(map)
//   .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
// `;
//       audioCounter++;
//     }
//   }

//   const boundsVar = JSON.stringify(pathCoords);

//   const htmlContent = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <title>${name}</title>
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
//   <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
//   <style>
//     body { margin: 0; font-family: Arial, sans-serif; }
//     #map { height: 60vh; }
//     #summaryPanel {
//       padding: 20px;
//       background: #f7f7f7;
//     }
//     #routeTitle {
//       font-size: 24px;
//       margin-bottom: 10px;
//       color: #2c3e50;
//     }
//     .stats { margin-top: 10px; }
//     .stats b { display: inline-block; width: 120px; }
//     #description { margin-top: 20px; }
//     #description textarea {
//       width: 100%;
//       height: 100px;
//       font-size: 14px;
//     }
//     #accessibilityDetails ul { list-style-type: none; padding-left: 0; }
//     #accessibilityDetails li { margin-bottom: 5px; }
//   </style>
// </head>
// <body>
// <div id="summaryPanel">
//   <div id="routeTitle">📍 ${name}</div>
//   <div class="stats">
//     <div><b>Distance:</b> ${totalDistance.toFixed(2)} km</div>
//     <div><b>Time:</b> ${document.getElementById("timer").textContent}</div>
//     <div><b>Photos:</b> ${photoCounter - 1}</div>
//     <div><b>Notes:</b> ${noteCounter - 1}</div>
//     <div><b>Audios:</b> ${audioCounter - 1}</div>
//   </div>

//   <div id="description">
//     <h4>General Description:</h4>
//     <textarea placeholder="Add notes or observations about the route here..."></textarea>
//   </div>
//   <div class="accessibility-summary">
//   <h4>🧩 מידע על נגישות</h4>
//   <pre id="accessibilityDataContainer"></pre>
// </div>
// </div>

// <div id="map"></div>
// <script>
// var map = L.map('map');
// var bounds = L.latLngBounds(${boundsVar});
// map.fitBounds(bounds);

// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//   maxZoom: 18,
//   attribution: '&copy; OpenStreetMap contributors'
// }).addTo(map);

// L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);

// ${markersJS}

// // Fullscreen photo viewer
// function showFullScreen(img) {
//   const overlay = document.createElement("div");
//   overlay.style.position = "fixed";
//   overlay.style.top = 0;
//   overlay.style.left = 0;
//   overlay.style.width = "100%";
//   overlay.style.height = "100%";
//   overlay.style.background = "rgba(0,0,0,0.9)";
//   overlay.style.display = "flex";
//   overlay.style.alignItems = "center";
//   overlay.style.justifyContent = "center";
//   overlay.style.zIndex = "9999";
//   overlay.onclick = () => document.body.removeChild(overlay);

//   const fullImg = document.createElement("img");
//   fullImg.src = img.src;
//   fullImg.style.maxWidth = "90%";
//   fullImg.style.maxHeight = "90%";
//   overlay.appendChild(fullImg);
//   document.body.appendChild(overlay);
// }
// const accessibility = route.find(e => e.type === "accessibility");
// if (accessibility) {
//   document.getElementById("accessibilityDataContainer").textContent = JSON.stringify(accessibility.content, null, 2);
// }

// </script>
// const accessibilityEntry = routeData.find(e => e.type === "accessibility");
// const accessibilityDataJSON = JSON.stringify(accessibilityEntry ? accessibilityEntry.content : null);

// const accessibilityScript = `
// <script>
//   // Store accessibility data globally
//   window.accessibilityContent = ${accessibilityDataJSON};

//   // Function to build accessibility HTML block
//   function generateAccessibilityHTML(data) {
//     if (!data) return "";

//     return \`
//     <div id="accessibilityDetails">
//       <h3>♿ Accessibility Details</h3>
//       <ul>
//         <li><b>Disabled Parking:</b> \${data.disabledParkingCount || "N/A"}</li>
//         <li><b>Path Type:</b> \${data.pathType || "N/A"}</li>
//         <li><b>Accessible Length:</b> \${data.accessibleLength || "N/A"} m</li>
//         <li><b>Route Type:</b> \${data.routeType || "N/A"}</li>
//         <li><b>Slope:</b> \${data.slope || "N/A"}</li>
//         <li><b>Points of Interest:</b> \${data.pointsOfInterest || "N/A"}</li>
//         <li><b>Lookouts:</b> \${data.lookouts ? "Yes" : "No"}</li>
//         <li><b>Picnic Spots:</b> \${data.picnicSpots ? "Yes" : "No"}</li>
//         <li><b>Accessible Toilets:</b> \${data.accessibleToilets ? "Yes" : "No"}</li>
//         <li><b>Benches:</b> \${data.benches ? "Yes" : "No"}</li>
//         <li><b>Shade:</b> \${data.shade || "N/A"}</li>
//       </ul>
//     </div>\`;
//   }

//   document.addEventListener("DOMContentLoaded", function () {
//     const data = window.accessibilityContent;
//     if (data) {
//       const html = generateAccessibilityHTML(data);
//       const panel = document.getElementById("summaryPanel");
//       if (panel) panel.insertAdjacentHTML("beforeend", html);
//     }
//   });
// </script>
// `;

// </body>
// </html>
// `;

//   // Optional: Save to local archive
//   const mediaForArchive = {};
//   routeData.forEach((entry, i) => {
//     if (entry.type === "photo") {
//       const base64 = entry.content.split(",")[1];
//       mediaForArchive[`photo${i + 1}.jpg`] = base64;
//     } else if (entry.type === "text") {
//       mediaForArchive[`note${i + 1}.txt`] = entry.content;
//     }
//   });
//   SummaryArchive.saveToArchive(name, htmlContent, mediaForArchive);

//   zip.file("index.html", htmlContent);

//   try {
//     const blob = await zip.generateAsync({ type: "blob" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `route-summary-${Date.now()}.zip`;
//     a.click();
//     console.log("✅ Route summary exported successfully.");
//   } catch (e) {
//     console.error("❌ Export failed:", e);
//     alert("❌ Failed to export route summary.");
//   }

//   resetApp();
//   initMap();
// }

async function exportRouteSummary() {
  console.log("📦 Attempting route export...");

  if (!routeData || !Array.isArray(routeData) || routeData.length === 0) {
    alert("⚠️ No route data available to export. Please track or load a route first.");
    return;
  }

  const hasLocation = routeData.some(entry => entry.type === "location");
  if (!hasLocation) {
    alert("⚠️ No location data found in this session.");
    return;
  }

  const mostRecent = JSON.parse(localStorage.getItem("sessions") || "[]").slice(-1)[0];
  const defaultName = mostRecent?.name || "My Route";
  const name = prompt("Enter a title for this route summary:", defaultName);

  if (!name) return;

  const zip = new JSZip();
  const notesFolder = zip.folder("notes");
  const imagesFolder = zip.folder("images");
  const audioFolder = zip.folder("audio");

  let markersJS = "";
  let pathCoords = [];
  let noteCounter = 1;
  let photoCounter = 1;
  let audioCounter = 1;

  for (const entry of routeData) {
    if (entry.type === "location") {
      pathCoords.push([entry.coords.lat, entry.coords.lng]);
    } else if (entry.type === "text") {
      notesFolder.file(`note${noteCounter}.txt`, entry.content);
      markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
  icon: L.divIcon({ className: 'custom-icon', html: '📝', iconSize: [24, 24] })
})
  .addTo(map)
  .bindTooltip("Note ${noteCounter}")
  .bindPopup("<b>Note ${noteCounter}</b><br><pre>${entry.content}</pre>");
`;
      noteCounter++;
    } else if (entry.type === "photo") {
      const base64Data = entry.content.split(",")[1];
      imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
      markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
  icon: L.divIcon({ className: 'custom-icon', html: '📸', iconSize: [24, 24] })
})
  .addTo(map)
  .bindTooltip("Photo ${photoCounter}")
  .bindPopup("<b>Photo ${photoCounter}</b><br><img src='images/photo${photoCounter}.jpg' style='width:200px'>");
`;
      photoCounter++;
    } else if (entry.type === "audio") {
      const base64Data = entry.content.split(",")[1];
      audioFolder.file(`audio${audioCounter}.webm`, base64Data, { base64: true });
      markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
`;
      audioCounter++;
    }
  }

  const accessibilityEntry = routeData.find(e => e.type === "accessibility");
  const accessibilityData = accessibilityEntry ? accessibilityEntry.content : null;
  const accessibilityJSON = JSON.stringify(accessibilityData);

  const boundsVar = JSON.stringify(pathCoords);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    #map { height: 60vh; }
    #summaryPanel { padding: 20px; background: #f7f7f7; }
    #routeTitle { font-size: 24px; margin-bottom: 10px; color: #2c3e50; }
    .stats { margin-top: 10px; }
    .stats b { display: inline-block; width: 120px; }
    #description { margin-top: 20px; }
    #description textarea { width: 100%; height: 100px; font-size: 14px; }
    #accessibilityDetails ul { list-style-type: none; padding-left: 0; }
    #accessibilityDetails li { margin-bottom: 5px; }
  </style>
</head>
<body>
<div id="summaryPanel">
  <div id="routeTitle">📍 ${name}</div>
  <div class="stats">
    <div><b>Distance:</b> ${totalDistance.toFixed(2)} km</div>
    <div><b>Time:</b> ${document.getElementById("timer").textContent}</div>
    <div><b>Photos:</b> ${photoCounter - 1}</div>
    <div><b>Notes:</b> ${noteCounter - 1}</div>
    <div><b>Audios:</b> ${audioCounter - 1}</div>
  </div>
  <div id="description">
    <h4>General Description:</h4>
    <textarea placeholder="Add notes or observations about the route here..."></textarea>
  </div>
  <div id="accessibilityDetailsContainer"></div>
</div>

<div id="map"></div>
<script>
var map = L.map('map');
var bounds = L.latLngBounds(${boundsVar});
map.fitBounds(bounds);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);

${markersJS}

// Accessibility summary rendering
(function(){
  const data = ${accessibilityJSON};
  if (!data) return;
  const html = \`
    <div id="accessibilityDetails">
      <h3>♿ Accessibility Details</h3>
      <ul>
        <li><b>Disabled Parking:</b> \${data.disabledParkingCount}</li>
        <li><b>Path Type:</b> \${data.pathType}</li>
        <li><b>Accessible Length:</b> \${data.accessibleLength} m</li>
        <li><b>Route Type:</b> \${data.routeType}</li>
        <li><b>Slope:</b> \${data.slope}</li>
        <li><b>Points of Interest:</b> \${data.pointsOfInterest}</li>
        <li><b>Lookouts:</b> \${data.lookouts ? "Yes" : "No"}</li>
        <li><b>Picnic Spots:</b> \${data.picnicSpots ? "Yes" : "No"}</li>
        <li><b>Accessible Toilets:</b> \${data.accessibleToilets ? "Yes" : "No"}</li>
        <li><b>Benches:</b> \${data.benches ? "Yes" : "No"}</li>
        <li><b>Shade:</b> \${data.shade}</li>
      </ul>
    </div>\`;
  document.getElementById("accessibilityDetailsContainer").innerHTML = html;
})();
</script>
</body>
</html>
`;

  const mediaForArchive = {};
  routeData.forEach((entry, i) => {
    if (entry.type === "photo") {
      const base64 = entry.content.split(",")[1];
      mediaForArchive[`photo${i + 1}.jpg`] = base64;
    } else if (entry.type === "text") {
      mediaForArchive[`note${i + 1}.txt`] = entry.content;
    }
  });
  SummaryArchive.saveToArchive(name, htmlContent, mediaForArchive);

  zip.file("index.html", htmlContent);

  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `route-summary-${Date.now()}.zip`;
    a.click();
    console.log("✅ Route summary exported successfully.");
  } catch (e) {
    console.error("❌ Export failed:", e);
    alert("❌ Failed to export route summary.");
  }

  resetApp();
  initMap();
}


async function exportAllRoutes() {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

  if (sessions.length === 0) {
    alert("No saved sessions to export!");
    return;
  }

  const zip = new JSZip();
  const explorerTableRows = [];

  for (const session of sessions) {
    const folderName = session.name.toLowerCase().replace(/\s+/g, "-");
    const sessionFolder = zip.folder(`routes/${folderName}`);
    const notesFolder = sessionFolder.folder("notes");
    const imagesFolder = sessionFolder.folder("images");
    const audioFolder = sessionFolder.folder("audio");

    let markersJS = "";
    let pathCoords = [];
    let noteCounter = 1;
    let photoCounter = 1;
    let audioCounter = 1;

    for (const entry of session.data) {
      if (entry.type === "location") {
        pathCoords.push([entry.coords.lat, entry.coords.lng]);
      } else if (entry.type === "text") {
        notesFolder.file(`note${noteCounter}.txt`, entry.content);
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Note ${noteCounter}</b><br><pre>${entry.content}</pre>");
`;
        noteCounter++;
      } else if (entry.type === "photo") {
        const base64Data = entry.content.split(",")[1];
        imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup(\`
    <b>Photo ${photoCounter}</b><br>
    <img src='images/photo${photoCounter}.jpg' style='width:200px;cursor:pointer' onclick='showFullScreen(this)'>
  \`);
`;
        photoCounter++;
      } else if (entry.type === "audio") {
        const base64Data = entry.content.split(",")[1];
        audioFolder.file(`audio${audioCounter}.webm`, base64Data, { base64: true });
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
`;
        audioCounter++;
      }
    }
    
  const accessibilityEntry = routeData.find(e => e.type === "accessibility");
  const accessibilityData = accessibilityEntry ? accessibilityEntry.content : null;
  const accessibilityJSON = JSON.stringify(accessibilityData);
    
    if (pathCoords.length === 0) continue;

    const boundsVar = JSON.stringify(pathCoords);
    const sessionHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${session.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    #map { height: 60vh; }
    #summaryPanel {
      padding: 20px;
      background: #f7f7f7;
    }
    #routeTitle {
      font-size: 24px;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .stats { margin-top: 10px; }
    .stats b { display: inline-block; width: 120px; }
    #description { margin-top: 20px; }
    #description textarea {
      width: 100%;
      height: 100px;
      font-size: 14px;
    }
    #accessibilityDetails ul { list-style-type: none; padding-left: 0; }
    #accessibilityDetails li { margin-bottom: 5px; }
  </style>
</head>
<body>
<div id="summaryPanel">
  <div id="routeTitle">📍 ${session.name}</div>
  <div class="stats">
    <div><b>Distance:</b> ${session.distance} km</div>
    <div><b>Time:</b> ${session.time}</div>
    <div><b>Photos:</b> ${photoCounter - 1}</div>
    <div><b>Notes:</b> ${noteCounter - 1}</div>
    <div><b>Audios:</b> ${audioCounter - 1}</div>
  </div>
  // Inject accessibility content
const accessibilityEntry = routeData.find(e => e.type === "accessibility");
const accessibilityHTML = generateAccessibilityHTML(accessibilityEntry ? accessibilityEntry.content : null);
document.getElementById("summaryPanel").innerHTML += accessibilityHTML;

  <div id="description">
    <h4>General Description:</h4>
    <textarea placeholder="Add notes or observations about the route here..."></textarea>
  </div>
  <div id="accessibilityDetailsContainer"></div>
</div>

<div id="map"></div>
<script>
var map = L.map('map');
var bounds = L.latLngBounds(${boundsVar});
map.fitBounds(bounds);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);

${markersJS}

// Fullscreen photo viewer
function showFullScreen(img) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.9)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.onclick = () => document.body.removeChild(overlay);

  const fullImg = document.createElement("img");
  fullImg.src = img.src;
  fullImg.style.maxWidth = "90%";
  fullImg.style.maxHeight = "90%";
  overlay.appendChild(fullImg);
  document.body.appendChild(overlay);
}

// Fullscreen photo viewer
function showFullScreen(img) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.9)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.onclick = () => document.body.removeChild(overlay);

  const fullImg = document.createElement("img");
  fullImg.src = img.src;
  fullImg.style.maxWidth = "90%";
  fullImg.style.maxHeight = "90%";
  overlay.appendChild(fullImg);
  document.body.appendChild(overlay);
}
// Accessibility summary rendering
(function(){
  const data = ${accessibilityJSON};
  if (!data) return;
  const html = \`
    <div id="accessibilityDetails">
      <h3>♿ Accessibility Details</h3>
      <ul>
        <li><b>Disabled Parking:</b> \${data.disabledParkingCount}</li>
        <li><b>Path Type:</b> \${data.pathType}</li>
        <li><b>Accessible Length:</b> \${data.accessibleLength} m</li>
        <li><b>Route Type:</b> \${data.routeType}</li>
        <li><b>Slope:</b> \${data.slope}</li>
        <li><b>Points of Interest:</b> \${data.pointsOfInterest}</li>
        <li><b>Lookouts:</b> \${data.lookouts ? "Yes" : "No"}</li>
        <li><b>Picnic Spots:</b> \${data.picnicSpots ? "Yes" : "No"}</li>
        <li><b>Accessible Toilets:</b> \${data.accessibleToilets ? "Yes" : "No"}</li>
        <li><b>Benches:</b> \${data.benches ? "Yes" : "No"}</li>
        <li><b>Shade:</b> \${data.shade}</li>
      </ul>
    </div>\`;
  document.getElementById("accessibilityDetailsContainer").innerHTML = html;
})();
</script>
</body>
</html>
`;

    sessionFolder.file("index.html", sessionHTML);

    explorerTableRows.push({
      name: session.name,
      distance: session.distance,
      time: session.time,
      date: session.date,
      folder: folderName
    });
  }

  // Build the explorer HTML
  let explorerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Route Explorer</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
    h1 { color: #2c3e50; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; border-bottom: 1px solid #ccc; text-align: left; }
    th { background: #3498db; color: white; }
    tr:hover { background: #eaf4fc; }
    a.button {
      background: #2980b9;
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <h1>📦 Exported Route Summaries</h1>
  <table>
    <thead>
      <tr><th>Name</th><th>Distance</th><th>Time</th><th>Date</th><th>View</th></tr>
    </thead>
    <tbody>
`;

  explorerTableRows.forEach(row => {
    explorerHTML += `
<tr>
  <td>${row.name}</td>
  <td>${row.distance} km</td>
  <td>${row.time}</td>
  <td>${row.date.split("T")[0]}</td>
  <td><a class="button" href="routes/${row.folder}/index.html" target="_blank">Open</a></td>
</tr>`;
  });

  explorerHTML += `
    </tbody>
  </table>
</body>
</html>
`;

  zip.file("explorer.html", explorerHTML);

  // Final ZIP
  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all-routes-${Date.now()}.zip`;
    a.click();
    console.log("✅ All routes exported successfully.");
  } catch (e) {
    console.error("❌ Failed to export all routes:", e);
    alert("❌ Export failed.");
  }
}


function closeHistory() {
  document.getElementById("historyPanel").style.display = "none";
}
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
}
function clearAllSessions() {
  const confirmClear = confirm("⚠️ Are you sure you want to clear all saved routes? This cannot be undone!");

  if (confirmClear) {
    localStorage.removeItem("sessions"); // ✅ Clear saved sessions
    localStorage.removeItem("route_backup"); // ✅ Also clear any backup

    document.getElementById("historyList").innerHTML = ""; // ✅ Clear history panel if open
    loadSavedSessions(); // ✅ Refresh empty list if necessary

    alert("✅ All saved routes have been cleared!");
  }
}
function prepareAndExport() {
  loadMostRecentSession(() => {
    exportRouteSummary(); // now routeData is populated
  });
}

function clearAllAppData() {
  const confirmClear = confirm("⚠️ This will permanently delete all routes, summaries, and backups. Continue?");
  if (!confirmClear) return;

  localStorage.removeItem("sessions");
  localStorage.removeItem("summary_archive");
  localStorage.removeItem("route_backup");

  if (document.getElementById("historyList")) {
    document.getElementById("historyList").innerHTML = "";
  }

  if (typeof SummaryArchive !== "undefined") {
    SummaryArchive.showArchiveBrowser(); // refresh if visible
  }

  loadSavedSessions();

  alert("✅ All app data has been cleared!");
}
let wasTimerRunning = false;

function promptAccessibilityForm(callback) {
  document.getElementById("accessibilityFormOverlay").style.display = "flex";

  if (timerInterval) {
    wasTimerRunning = true;
    clearInterval(timerInterval);
  } else {
    wasTimerRunning = false;
  }

  const form = document.getElementById("accessibilityForm");
  form.onsubmit = e => {
    e.preventDefault();

    const formData = new FormData(form);
    const accessibilityData = {};

    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.name) {
        const reader = new FileReader();
        reader.onload = () => {
          accessibilityData[key] = reader.result;
        };
        reader.readAsDataURL(value);
      } else {
        accessibilityData[key] = value;
      }
    }

    // Optional: Delay execution if awaiting image load
    setTimeout(() => {
      document.getElementById("accessibilityFormOverlay").style.display = "none";
      callback(accessibilityData); // Pass back data
    }, 500);
  };
}
function closeAccessibilityForm() {
  const overlay = document.getElementById("accessibilityOverlay");
  if (overlay) {
    overlay.style.display = "none";
  } else {
    console.warn("⚠️ accessibilityOverlay not found.");
  }
  if (wasTimerRunning) {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }
}

function prefillAccessibilityForm(data) {
  const form = document.getElementById("accessibilityForm");
  if (!form) return;

  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) {
      if (field.type === "file") {
        // ❌ SKIP file inputs – cannot be set programmatically
        return;
      }
      if (field.type === "checkbox") {
        field.checked = value === "on" || value === true;
      } else {
        field.value = value;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("accessibilityForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      const accessibilityData = {};

      for (const [key, value] of formData.entries()) {
        accessibilityData[key] = value;
      }

      localStorage.setItem("accessibilityData", JSON.stringify(accessibilityData));

      routeData.push({
        type: "accessibility",
        timestamp: Date.now(),
        content: accessibilityData
      });

      alert("✅ Questionnaire saved and added to route!");
      closeAccessibilityForm();
    });
  }
});
