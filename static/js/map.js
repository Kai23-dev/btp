// Map module for Hydrological Parameter Calculator
// Author: Hydrological Research Team (adapted)

const appState = {
    map: null,
    marker: null,
    layerGroups: {}
};

const elements = {
    latitudeInput: null,
    longitudeInput: null
};

function showNotification(message, type = 'info', timeout = 3000) {
    // create notification container if not exists
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.position = 'fixed';
        container.style.right = '20px';
        container.style.top = '20px';
        container.style.zIndex = 10000;
        document.body.appendChild(container);
    }

    const note = document.createElement('div');
    note.className = 'notification ' + type;
    note.style.background = '#fff';
    note.style.border = '1px solid #ccc';
    note.style.padding = '8px 12px';
    note.style.marginTop = '8px';
    note.style.borderRadius = '6px';
    note.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
    note.textContent = message;
    container.appendChild(note);

    setTimeout(() => { container.removeChild(note); }, timeout);
}

function initializeMap() {
    // Set element references
    elements.latitudeInput = document.getElementById('lat');
    elements.longitudeInput = document.getElementById('lon');

    // Default location
    const defaultLat = 22.3149;
    const defaultLng = 87.3105;

    if (!appState.map) {
        appState.map = L.map('map', { preferCanvas: true }).setView([defaultLat, defaultLng], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 2
        }).addTo(appState.map);

        appState.marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(appState.map);
        appState.marker.bindPopup('<b>Default Location</b><br>Kharagpur, West Bengal, India');
        appState.marker.on('dragend', function(ev) {
            const p = ev.target.getLatLng();
            if (elements.latitudeInput) elements.latitudeInput.value = p.lat.toFixed(6);
            if (elements.longitudeInput) elements.longitudeInput.value = p.lng.toFixed(6);
        });

        appState.map.on('click', function(e) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            if (elements.latitudeInput) elements.latitudeInput.value = lat.toFixed(6);
            if (elements.longitudeInput) elements.longitudeInput.value = lng.toFixed(6);
            updateMapMarker(lat, lng);
            showNotification(`Location selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'info');
        });
    }
}

function updateMapMarker(latitude, longitude) {
    if (!appState.map) return;
    // remove marker
    if (appState.marker) {
        appState.marker.setLatLng([latitude, longitude]);
    } else {
        appState.marker = L.marker([latitude, longitude], { draggable: true }).addTo(appState.map);
    }
    appState.marker.bindPopup(`<b>Selected Location</b><br>Lat: ${latitude.toFixed(6)}<br>Lng: ${longitude.toFixed(6)}`);
    appState.map.setView([latitude, longitude], Math.max(appState.map.getZoom(), 8));
}

function isValidLatLon(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function openAndCenterMap(latitude, longitude, zoom = 8) {
    if (!isValidLatLon(latitude, longitude)) {
        showNotification('Invalid lat/lon', 'error');
        return;
    }
    const wrapper = document.getElementById('mapWrapper');
    if (wrapper) wrapper.style.display = 'block';
    if (!appState.map) initializeMap();
    updateMapMarker(latitude, longitude);
    setTimeout(() => { appState.map.invalidateSize(); appState.map.setView([latitude, longitude], zoom); }, 200);
}

// other helper functions (fullscreen, legend, overlays) follow
function addMapControls() {
    if (!appState.map) return;
    L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(appState.map);
}

function addMapFullscreen() {
    // Optional: use existing code or external plugin
    // Provide a simple toggle with a control
    if (!appState.map) return;
    const fc = L.control({ position: 'topright' });
    fc.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-bar');
        const btn = L.DomUtil.create('a', '', div);
        btn.href = '#';
        btn.title = 'FullScreen';
        btn.innerHTML = '⛶';
        btn.style.fontSize = '16px';
        btn.style.width = '30px';
        btn.style.textAlign = 'center';
        btn.onclick = function(e) { e.preventDefault(); toggleMapFullscreen(); };
        return div;
    };
    fc.addTo(appState.map);
}

function toggleMapFullscreen() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    if (!document.fullscreenElement) {
        if (mapContainer.requestFullscreen) mapContainer.requestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
    setTimeout(() => { if (appState.map) appState.map.invalidateSize(); }, 100);
}

function addMapLegend(legendData) {
    if (!appState.map) return;
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
        let content = '<h4 style="margin: 0 0 10px 0; font-size: 14px;">Legend</h4>';
        for (const key in legendData) {
            const item = legendData[key];
            content += `<div style="display:flex; align-items:center; margin:5px 0;"><i style="background:${item.color}; width:18px; height:18px; display:inline-block; margin-right:8px; border-radius:2px;"></i><span style="font-size:12px">${item.label}</span></div>`;
        }
        div.innerHTML = content;
        return div;
    };
    legend.addTo(appState.map);
}

function clearMapOverlays() {
    if (!appState.map) return;
    appState.map.eachLayer(function(layer) {
        if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polygon || layer instanceof L.Polyline) {
            if (layer !== appState.marker) appState.map.removeLayer(layer);
        }
    });
}

function fitMapBounds(coordinates) {
    if (!appState.map || !coordinates || coordinates.length === 0) return;
    const bounds = L.latLngBounds(coordinates);
    appState.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
}

// Expose some functions globally so frontend main script can call them
window.hydroMap = {
    initializeMap,
    openAndCenterMap,
    updateMapMarker,
    addMapControls,
    addMapFullscreen,
    addMapLegend,
    addLayerGroup: (name) => { if (!appState.layerGroups[name]) appState.layerGroups[name] = L.layerGroup().addTo(appState.map); return appState.layerGroups[name]; },
    clearMapOverlays,
    fitMapBounds,
    getMapView: () => appState.map ? { latitude: appState.map.getCenter().lat, longitude: appState.map.getCenter().lng, zoom: appState.map.getZoom() } : null
};

// Initialize map on DOM ready if map container is present
document.addEventListener('DOMContentLoaded', function() {
    const mapElement = document.getElementById('map');
    if (mapElement) initializeMap();
});

// Handle fullscreen change events
['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, function() { if (appState.map) setTimeout(() => appState.map.invalidateSize(), 100); });
});
