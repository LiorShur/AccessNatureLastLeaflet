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

// === INIT MAP ===
window.initMap = function (callback) {
  const initial = path.length > 0 ? path[0] : { lat: 0, lng: 0 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 17,
    center: initial,
    mapTypeId: 'terrain'
  });

  marker = new google.maps.Marker({
    position: initial,
    map,
    title: "Start"
  });
// Try to get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.setCenter(userLocation);
        marker.setPosition(userLocation);
      },
      error => {
        console.warn("Geolocation failed or denied, using default.");
      }
    );
  }
  if (callback) callback();
};
let autoSaveInterval = null;

function initRecoveredRoute() {
  path = routeData.filter(e => e.type === "location").map(e => e.coords);
  if (path.length > 0) {
    map.setCenter(path[0]);
    new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#00FF00",
      strokeOpacity: 1.0,
      strokeWeight: 2,
      map: map
    });
  }
}
// const script = document.createElement('script');
// script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyB4IoUFBPNGtVySKpFoqE9VITvGV7nkLHw&callback=initMap';
// script.async = true;
// script.defer = true;
// document.head.appendChild(script);


function startAutoBackup() {
  autoSaveInterval = setInterval(() => {
    const backupData = {
      routeData,
      totalDistance,
      elapsedTime
    };
    localStorage.setItem("route_backup", JSON.stringify(backupData));
    console.log("🔄 Auto-saved route progress.");
  }, 20000);
}

function stopAutoBackup() {
  clearInterval(autoSaveInterval);
  localStorage.removeItem("route_backup");
  console.log("✅ Auto-backup stopped and cleared.");
}
function Summary() {
  alert(`🏁 Route Completed!
Total Distance: ${totalDistance.toFixed(2)} km
Total Time: ${document.getElementById("timer").textContent}`);
}


// === TRACKING ===
window.startTracking = function () {
  startAutoBackup(); // start auto-saving every 20s

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;

        if (accuracy > 25) return;
        if (lastCoords) {
          const dist = haversineDistance(lastCoords, { lat: latitude, lng: longitude });
          if (dist > 0.2) return;
        }

        if (!isPaused) {
          const latLng = { lat: latitude, lng: longitude };

          if (lastCoords) {
            const dist = haversineDistance(lastCoords, latLng);
            totalDistance += dist;
            document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
            document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

          }

          lastCoords = latLng;
          path.push(latLng);
          marker.setPosition(latLng);
          map.panTo(latLng);

          new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#00FF00",
            strokeOpacity: 1.0,
            strokeWeight: 2,
            map
          });

          routeData.push({
            type: "location",
            timestamp: Date.now(),
            coords: latLng
          });
        }
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    startTimer();
  } else {
    alert("Geolocation not supported");
  }
};


window.stopTracking = function () {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  stopTimer();
  stopAutoBackup();
  
  const wantsToSave = confirm("💾 Do you want to save this route?");
  if (wantsToSave) {
    saveSession(); // Save session properly
  }
  Summary(); //  nice summary
  resetApp(); // Clean reset after saving or not
};

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

function resetApp() {
  routeData = [];
  path = [];
  lastCoords = null;
  totalDistance = 0;
  elapsedTime = 0;
  startTime = null;
  isPaused = false;

  document.getElementById("distance").textContent = "0.00 km";
  document.getElementById("timer").textContent = "00:00:00";

  document.getElementById("liveDistance").textContent = "0.00 km"; // ✅ reset floating distance
  document.getElementById("liveTimer").textContent = "00:00:00";   // ✅ reset floating timer

  if (map && marker) {
    marker.setPosition({ lat: 0, lng: 0 });
    map.setCenter({ lat: 0, lng: 0 });
    map.setZoom(17);
  }

  stopAutoBackup();
  localStorage.removeItem("route_backup");

  console.log("🧹 App reset — ready for a new session!");
}


function startTimer() {
  elapsedTime = 0; // important
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

  const formatted = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`; // ✅ Create formatted string!

  document.getElementById("timer").textContent = formatted;
  document.getElementById("liveTimer").textContent = formatted;
}


function pad(n) {
  return n.toString().padStart(2, "0");
}

// === DISTANCE ===
function haversineDistance(coord1, coord2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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
    const maxWidth = 800;
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

// ===  ROUTE & NOTES ===
let noteMarkers = []; // Global array to track note markers

function showRouteDataOnMap() {
  // Clear previous note markers first
  if (noteMarkers.length > 0) {
    noteMarkers.forEach(marker => marker.setMap(null));
    noteMarkers = [];
  }

  if (!routeData || routeData.length === 0) {
    alert("No notes, photos, or media found in this route.");
    return;
  }

  const bounds = new google.maps.LatLngBounds();

  routeData.forEach(entry => {
    const { coords, type, content } = entry;
    if (!coords) return; // Safety

    if (type === "location") {
      bounds.extend(coords);
      return; // Skip simple location-only entries
    }

    let infoContent = "";

    if (type === "text") {
      infoContent = `<p>${content}</p>`;
    } else if (type === "photo") {
      infoContent = `<img src="${content}" alt="Photo" style="width:150px" onclick="showMediaFullScreen('${content}', 'photo')">`;
    } else if (type === "audio") {
      infoContent = `<audio controls src="${content}"></audio>`;
    } else if (type === "video") {
      infoContent = `<video controls width="200" src="${content}" onclick="showMediaFullScreen('${content}', 'video')"></video>`;
    }

    // const marker = new google.maps.Marker({
    //   position: coords,
    //   map: map,
    //   icon: {
    //     url: type === "photo" ? "📸" :
    //          type === "audio" ? "🎙️" :
    //          type === "video" ? "🎬" :
    //          "📝",
    //     scaledSize: new google.maps.Size(32, 32)
    //   }
    // });
    const marker = new google.maps.Marker({
  position: coords,
  map: map,
  label: type === "photo" ? "📸" :
         type === "audio" ? "🎙️" :
         type === "video" ? "🎬" : "📝"
});


    const infoWindow = new google.maps.InfoWindow({
      content: infoContent
    });

    marker.addListener("click", () => {
      infoWindow.open(map, marker);
    });

    noteMarkers.push(marker);
    bounds.extend(coords);
  });

  // if (!bounds.isEmpty()) {
  //   map.fitBounds(bounds);
  // }
  if (!bounds.isEmpty()) {
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
    alert("⚠️ No route data to save. Please start tracking before saving.");
    console.warn("❌ Save aborted: routeData is empty.");
    return;
  }

  const name = prompt("Enter a name for this route:");
  if (!name) {
    console.log("⛔ Save cancelled — no name provided.");
    return;
  }

  const session = {
    name,
    date: new Date().toISOString(),
    time: document.getElementById("timer").textContent,
    distance: totalDistance.toFixed(2),
    data: routeData
  };

  // let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  // sessions.push(session);

  // try {
  //   localStorage.setItem("sessions", JSON.stringify(sessions));
  //   localStorage.removeItem("route_backup");
  //   console.log("✅ Session saved to localStorage.", session);
  //   alert("✅ Route saved successfully!");
  //   loadSavedSessions();
  // } catch (e) {
  //   console.error("❌ Failed to save session:", e);
  //   alert("❌ Could not save the route. Storage may be full.");
  // }
  try {
    let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.push(session);
    localStorage.setItem("sessions", JSON.stringify(sessions));
    localStorage.removeItem("route_backup");

    alert("✅ Route saved successfully!");
    loadSavedSessions();
  } catch (e) {
    console.error("❌ Save failed. Storage full or data too large.", e);
    alert("❌ Could not save the route. Storage may be full. Try exporting and clearing older data.");
  }
};


// === LOAD SESSION LIST ===
window.loadSavedSessions = function () {
  const list = document.getElementById("savedSessionsList");
  list.innerHTML = "";
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

  sessions.forEach((session, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${session.name}</strong>
      <button onclick="loadSession(${index})">View</button>
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
  console.log("Session loaded. routeData:", routeData);

  totalDistance = parseFloat(session.distance);
  elapsedTime = 0;
  lastCoords = null;

  path = session.data.filter(e => e.type === "location").map(e => e.coords);

  document.getElementById("timer").textContent = session.time;
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";

  initMap(() => {
    drawSavedRoutePath();
    showRouteDataOnMap();
  });
  document.getElementById("exportSummaryBtn").disabled = false;

};

function drawSavedRoutePath() {
  if (path.length > 1) {
    new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#00FF00",
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map
    });

    map.setCenter(path[0]);
    marker.setPosition(path[0]);
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

  // Update displays
  document.getElementById("timer").textContent = mostRecent.time;
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
  document.getElementById("liveTimer").textContent = mostRecent.time;
  document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

  if (typeof initMap === "function") {
    initMap(() => {
      drawSavedRoutePath();
      showRouteDataOnMap();
      if (typeof callback === "function") callback();
    });
  } else if (typeof callback === "function") {
    callback(); // export can proceed anyway
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
  doc.text("Nature Tracker - Route Summary", 10, y); y += 10;

  for (const entry of routeData) {
    if (y > 260) { doc.addPage(); y = 10; }

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
      });

    } catch (e) {
      console.error("❌ Invalid share data:", e);
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
          });

          document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
          document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

          startTime = Date.now() - elapsedTime;
          updateTimerDisplay();
          startTimer();
          startAutoBackup();

          console.log("✅ Route successfully restored from backup.");
          alert("✅ Route recovered successfully!");

        } catch (e) {
          console.error("❌ Failed to restore from backup:", e);
          alert("⚠️ Failed to restore previous route. It may be corrupted.");
          resetApp();
          localStorage.removeItem("route_backup");
        }
      } else {
        console.log("🧹 User declined backup restore. Clearing backup...");
        localStorage.removeItem("route_backup");
        resetApp();
      }
    } else {
      console.log("ℹ️ No backup found. Loading saved sessions.");
      loadSavedSessions();
      if (!map) initMap(); // ✅ This is where you add the fallback map init
    }
  }
  if (!map) {
  initMap(); // Ensure the map initializes even if no session or shared route is loaded
}
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
    let archive = getArchive();
    archive = archive.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
  }

  function viewSummary(id) {
    const item = getArchive().find(entry => entry.id === id);
    if (!item) return alert("Summary not found!");

    // Convert HTML and base64 media into a Blob and open in new tab
    const blob = new Blob([item.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }
  
  function clearAll() {
  const confirmClear = confirm("⚠️ This will delete all saved summaries permanently. Continue?");
  if (confirmClear) {
    localStorage.removeItem(STORAGE_KEY);
    SummaryArchive.showArchiveBrowser(); // Refresh UI
    alert("🧹 Archive cleared!");
    toggleArchivePanel();
  }
}
  
function clearAllSummaries() {
  const confirmClear = confirm("⚠️ Clear all archived summaries? This cannot be undone!");
  if (confirmClear) {
    localStorage.removeItem("summary_archive");
    alert("✅ All archived summaries cleared!");
    SummaryArchive.showArchiveBrowser(); // Refresh panel if visible
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

// async function exportRouteSummary() {

// console.log("📦 Attempting route export...");
//   if (!routeData || !Array.isArray(routeData) || routeData.length === 0) {
//     alert("⚠️ No route data available to export. Please track or load a route first.");
//     console.warn("❌ Export aborted: routeData is missing or empty.");
//     return;
//   }

//   const hasLocation = routeData.some(entry => entry.type === "location");
//   if (!hasLocation) {
//     alert("⚠️ No location data found. Start a route and record some movement first!");
//     console.warn("❌ Export aborted: No GPS points in routeData.");
//     return;
//   }
//   const zip = new JSZip();
//   const notesFolder = zip.folder("notes");
//   const imagesFolder = zip.folder("images");
//   const audioFolder = zip.folder("audio");

//   let markersJS = "";
//   let pathCoords = [];
//   let noteCounter = 1;
//   let photoCounter = 1;
//   let audioCounter = 1;

//   for (const entry of routeData) {
//     if (entry.type === "location") {
//       pathCoords.push([entry.coords.lat, entry.coords.lng]);
//     } else if (entry.type === "text") {
//       notesFolder.file(`note${noteCounter}.txt`, entry.content);
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}])
//   .addTo(map)
//   .bindPopup("<b>Note ${noteCounter}</b><br>${entry.content}");
// `;
//       noteCounter++;
//     } else if (entry.type === "photo") {
//       const base64Data = entry.content.split(",")[1];
//       imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}])
//   .addTo(map)
//   .bindPopup("<b>Photo ${photoCounter}</b><br><img src='images/photo${photoCounter}.jpg' style='width:200px' onclick='showFullScreen(this)'>");
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

//   const htmlContent = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
// <meta charset="UTF-8">
// <title>${name}</title>
// <meta name="viewport" content="width=device-width, initial-scale=1.0">
// <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
// <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
// <style>
//  <!-- // #map { height: 100vh; margin: 0; }
//   // #summaryPanel {
//   //   position: absolute; top: 10px; right: 10px;
//   //   background: white; padding: 10px; border-radius: 8px;
//   //   box-shadow: 0 0 10px rgba(0,0,0,0.3); font-size: 14px;
//   // } -->
//   body { margin: 0; font-family: Arial, sans-serif; }
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
//     .stats {
//       margin-top: 10px;
//     }
//     .stats b {
//       display: inline-block;
//       width: 120px;
//     }
//     #description {
//       margin-top: 20px;
//     }
//     #description textarea {
//       width: 100%;
//       height: 100px;
//       font-size: 14px;
//     }
// </style>
// </head>
// <body>
// <!--// <div id="map"></div>
// // <div id="summaryPanel">
// //   <b>Distance:</b> ${totalDistance.toFixed(2)} km<br>
// //   <b>Photos:</b> ${photoCounter - 1}<br>
// //   <b>Notes:</b> ${noteCounter - 1}<br>
// //   <b>Audios:</b> ${audioCounter - 1}<br>
// // </div> -->
// <div id="summaryPanel">
//     <div id="routeTitle">📍 ${name}</div>
//     <div class="stats">
//       <div><b>Distance:</b> ${totalDistance.toFixed(2)} km</div>
//       <div><b>Time:</b> ${document.getElementById("timer").textContent}</div>
//       <div><b>Photos:</b> ${photoCounter - 1}</div>
//       <div><b>Notes:</b> ${noteCounter - 1}</div>
//       <div><b>Audios:</b> ${audioCounter - 1}</div>
//     </div>
//     <div id="description">
//       <h4>General Description:</h4>
//       <textarea placeholder="Add notes or observations about the route here..."></textarea>
//     </div>
//   </div>

//   <div id="map"></div>
// <script>
// var map = L.map('map').setView([${pathCoords[0][0]}, ${pathCoords[0][1]}], 15);
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//   maxZoom: 19,
//   attribution: '&copy; OpenStreetMap contributors'
// }).addTo(map);

// var route = L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);
// // map.fitBounds(route.getBounds());
// map.fitBounds(bounds);
// const listener = google.maps.event.addListenerOnce(map, "bounds_changed", function () {
//   if (map.getZoom() > 17) map.setZoom(17); // Limit zoom level
// });

// ${markersJS}

// // Fullscreen photo viewer
// function showFullScreen(img) {
//   var overlay = document.createElement("div");
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

//   var fullImg = document.createElement("img");
//   fullImg.src = img.src;
//   fullImg.style.maxWidth = "90%";
//   fullImg.style.maxHeight = "90%";
//   overlay.appendChild(fullImg);
//   document.body.appendChild(overlay);
// }
// </script>
// </body>
// </html>
// `;
//  // Save to archive (for in-browser stored summary)
//   const mediaForArchive = {};

//   routeData.forEach((entry, i) => {
//     if (entry.type === "photo") {
//       const base64 = entry.content.split(",")[1]; // remove data URI prefix
//       mediaForArchive[`photo${i + 1}.jpg`] = base64;
//     } else if (entry.type === "text") {
//       mediaForArchive[`note${i + 1}.txt`] = entry.content;
//     }
//   });

//   SummaryArchive.saveToArchive(name, htmlContent, mediaForArchive);
//   zip.file("index.html", htmlContent);

//   // const blob = await zip.generateAsync({ type: "blob" });
//   // const url = URL.createObjectURL(blob);

//   // const a = document.createElement("a");
//   // a.href = url;
//   // a.download = `route-summary-${Date.now()}.zip`;
//   // a.click();
// try {
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

//   // ✅ Re-initialize the map if needed
// resetApp();
// initMap();
// }

async function exportRouteSummary() {
  console.log("📦 Attempting route export...");

  if (!routeData || !Array.isArray(routeData) || routeData.length === 0) {
    alert("⚠️ No route data available to export. Please track or load a route first.");
    console.warn("❌ Export aborted: routeData is missing or empty.");
    return;
  }

  const hasLocation = routeData.some(entry => entry.type === "location");
  if (!hasLocation) {
    alert("⚠️ No location data found. Start a route and record some movement first!");
    console.warn("❌ Export aborted: No GPS points in routeData.");
    return;
  }

  const name = prompt("Enter a title for this route summary:");
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
    <img src="images/photo${photoCounter}.jpg" style="width:200px;cursor:pointer" onclick="showFullScreen(this)">
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

  // ✅ Leaflet bounds fix
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
  #summaryPanel {
    padding: 20px;
    background: #f7f7f7;
  }
  #routeTitle {
    font-size: 24px;
    margin-bottom: 10px;
    color: #2c3e50;
  }
  .stats {
    margin-top: 10px;
  }
  .stats b {
    display: inline-block;
    width: 120px;
  }
  #description {
    margin-top: 20px;
  }
  #description textarea {
    width: 100%;
    height: 100px;
    font-size: 14px;
  }
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

var route = L.polyline(${boundsVar}, { color: 'blue' }).addTo(map);

${markersJS}

// Fullscreen photo viewer
function showFullScreen(img) {
  var overlay = document.createElement("div");
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

  var fullImg = document.createElement("img");
  fullImg.src = img.src;
  fullImg.style.maxWidth = "90%";
  fullImg.style.maxHeight = "90%";
  overlay.appendChild(fullImg);
  document.body.appendChild(overlay);
}
</script>
</body>
</html>
`;

  // Store media for internal archive (optional)
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
  .bindPopup("<b>Note ${noteCounter}</b><br>${entry.content}");
`;
        noteCounter++;
      } else if (entry.type === "photo") {
        const base64Data = entry.content.split(",")[1];
        imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Photo ${photoCounter}</b><br><img src='images/photo${photoCounter}.jpg' style='width:200px' onclick='showFullScreen(this)'>");
`;
        photoCounter++;
      } else if (entry.type === "audio") {
        const base64Data = entry.content.split(",")[1];
        audioFolder.file(`audio/audio${audioCounter}.webm`, base64Data, { base64: true });
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
`;
        audioCounter++;
      }
    }

    // ✅ SKIP if no GPS points
    if (pathCoords.length === 0) {
      console.warn(`⚠️ Session "${session.name}" has no GPS points. Skipping export.`);
      continue;
    }

    // ✅ Generate the session's index.html
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
#map { height: 100vh; margin: 0; }
#summaryPanel {
  position: absolute; top: 10px; right: 10px;
  background: white; padding: 10px; border-radius: 8px;
  box-shadow: 0 0 10px rgba(0,0,0,0.3); font-size: 14px;
}
</style>
</head>
<body>
<div id="map"></div>
<div id="summaryPanel">
  <b>Distance:</b> ${session.distance} km<br>
  <b>Photos:</b> ${photoCounter - 1}<br>
  <b>Notes:</b> ${noteCounter - 1}<br>
  <b>Audios:</b> ${audioCounter - 1}<br>
</div>
<script>
var map = L.map('map').setView([${pathCoords[0][0]}, ${pathCoords[0][1]}], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

var route = L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);
map.fitBounds(route.getBounds());

${markersJS}

// Fullscreen photo viewer
function showFullScreen(img) {
  var overlay = document.createElement("div");
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

  var fullImg = document.createElement("img");
  fullImg.src = img.src;
  fullImg.style.maxWidth = "90%";
  fullImg.style.maxHeight = "90%";
  overlay.appendChild(fullImg);
  document.body.appendChild(overlay);
}
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

  // ✅ Build final explorer.html
  let explorerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Route Explorer</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: Arial, sans-serif; margin: 20px; background: #f9f9f9; }
  h1 { color: #4CAF50; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
  th { background-color: #4CAF50; color: white; }
  tr:hover { background-color: #f1f1f1; }
  a.button {
    background: #2196F3; color: white; padding: 8px 14px;
    border-radius: 4px; text-decoration: none;
    display: inline-block;
  }
</style>
</head>
<body>

<h1>📍 Your Route Explorer</h1>

<table id="routesTable">
<thead>
<tr><th>Route Name</th><th>Distance</th><th>Time</th><th>Date</th><th>View</th></tr>
</thead>
<tbody>
`;

  explorerTableRows.forEach(route => {
    explorerHTML += `
<tr>
  <td>${route.name}</td>
  <td>${route.distance} km</td>
  <td>${route.time}</td>
  <td>${route.date.split("T")[0]}</td>
  <td><a class="button" href="routes/${route.folder}/index.html" target="_blank">View Map</a></td>
</tr>
`;
  });

  explorerHTML += `
</tbody>
</table>

</body>
</html>
`;

  zip.file("explorer.html", explorerHTML);

  // ✅ Finally, generate and download ZIP
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nature-explorer-${Date.now()}.zip`;
  a.click();
}
function openHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

  sessions.forEach((session, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${session.name}</b> (${session.distance} km, ${session.time}) 
    <button onclick="loadSession(${index})">View</button>`;
    list.appendChild(li);
  });

  document.getElementById("historyPanel").style.display = "block";
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
