/**
 * Map module for Hydrological Parameter Calculator
 * Handles map initialization, interactions and click events
 * 
 * Author: Hydrological Research Team
 * Date: 2023
 */

/**
 * Initialize Leaflet map when DOM is ready
 */
function initializeMap() {
    // Default location (India - Kharagpur, West Bengal)
    const defaultLat = 22.3149;
    const defaultLng = 87.3105;
    
    // Create map instance
    appState.map = L.map('map').setView([defaultLat, defaultLng], 6);
    
    // Add tile layer with attribution
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        minZoom: 2
    }).addTo(appState.map);
    
    // Add default marker
    appState.marker = L.marker([defaultLat, defaultLng])
        .addTo(appState.map)
        .bindPopup('<b>Default Location</b><br>Kharagpur, West Bengal, India')
        .openPopup();
    
    // Add click event to map
    appState.map.on('click', handleMapClick);
    
    // Add map controls
    addMapControls();
    
    console.log('Map initialized successfully');
}

/**
 * Handle map click events
 * @param {Object} e - Leaflet event object
 */
function handleMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Update form inputs
    if (elements.latitudeInput) {
        elements.latitudeInput.value = lat.toFixed(4);
    }
    if (elements.longitudeInput) {
        elements.longitudeInput.value = lng.toFixed(4);
    }
    
    // Update marker position
    updateMapMarker(lat, lng);
    
    // Show notification
    showNotification(`Location selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
}

/**
 * Update map marker position
 * @param {number} latitude - Latitude of marker
 * @param {number} longitude - Longitude of marker
 */
function updateMapMarker(latitude, longitude) {
    // Remove existing marker if it exists
    if (appState.marker) {
        appState.map.removeLayer(appState.marker);
    }
    
    // Create new marker with popup
    appState.marker = L.marker([latitude, longitude])
        .addTo(appState.map)
        .bindPopup(`<b>Selected Location</b><br>Lat: ${latitude.toFixed(4)}<br>Lng: ${longitude.toFixed(4)}`)
        .openPopup();
    
    // Center map on marker with animation
    appState.map.setView([latitude, longitude], 10, {
        animate: true,
        duration: 0.5
    });
}

/**
 * Pan map to a specific location
 * @param {number} latitude - Latitude to pan to
 * @param {number} longitude - Longitude to pan to
 * @param {number} zoom - Zoom level (optional)
 */
function panMapToLocation(latitude, longitude, zoom = 10) {
    if (appState.map) {
        appState.map.setView([latitude, longitude], zoom, {
            animate: true,
            duration: 0.5
        });
        updateMapMarker(latitude, longitude);
    }
}

/**
 * Add map controls (scale, fullscreen, etc.)
 */
function addMapControls() {
    // Add scale control
    L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false,
        maxWidth: 100
    }).addTo(appState.map);
    
    // Add zoom control (if not already present)
    if (!appState.map.zoomControl) {
        L.control.zoom({
            position: 'topright'
        }).addTo(appState.map);
    }
}

/**
 * Add fullscreen control to map
 */
function addMapFullscreen() {
    const fullscreenControl = L.control({
        position: 'topright'
    });
    
    fullscreenControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('button', 'leaflet-control-fullscreen', div);
        
        button.innerHTML = '<i class="fas fa-expand"></i>';
        button.title = 'Toggle Fullscreen';
        button.style.width = '30px';
        button.style.height = '30px';
        button.style.lineHeight = '30px';
        button.style.cursor = 'pointer';
        button.style.backgroundColor = 'white';
        button.style.border = 'none';
        
        button.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleMapFullscreen();
        };
        
        return div;
    };
    
    fullscreenControl.addTo(appState.map);
}

/**
 * Toggle map fullscreen mode
 */
function toggleMapFullscreen() {
    const mapContainer = document.getElementById('map');
    
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    if (!document.fullscreenElement && !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && !document.msFullscreenElement) {
        // Enter fullscreen
        if (mapContainer.requestFullscreen) {
            mapContainer.requestFullscreen();
        } else if (mapContainer.webkitRequestFullscreen) {
            mapContainer.webkitRequestFullscreen();
        } else if (mapContainer.mozRequestFullScreen) {
            mapContainer.mozRequestFullScreen();
        } else if (mapContainer.msRequestFullscreen) {
            mapContainer.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    // Invalidate map size after fullscreen change
    setTimeout(() => {
        appState.map.invalidateSize();
    }, 100);
}

/**
 * Add custom legend to map
 * @param {Object} legendData - Legend data with color and label for each item
 */
function addMapLegend(legendData) {
    const legend = L.control({
        position: 'bottomright'
    });
    
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'info legend');
        
        // Add styles
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
        
        // Create legend content
        let legendContent = '<h4 style="margin: 0 0 10px 0; font-size: 14px;">Legend</h4>';
        
        // Create legend items
        for (const key in legendData) {
            if (legendData.hasOwnProperty(key)) {
                const item = legendData[key];
                legendContent += `
                    <div class="legend-item" style="margin: 5px 0; display: flex; align-items: center;">
                        <i style="background: ${item.color}; width: 18px; height: 18px; display: inline-block; margin-right: 8px; border-radius: 2px;"></i>
                        <span style="font-size: 12px;">${item.label}</span>
                    </div>
                `;
            }
        }
        
        div.innerHTML = legendContent;
        return div;
    };
    
    legend.addTo(appState.map);
}

/**
 * Add circle overlay to map
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Radius in meters
 * @param {Object} options - Circle options
 */
function addMapCircle(latitude, longitude, radius, options = {}) {
    const defaultOptions = {
        color: '#0d6efd',
        fillColor: '#0d6efd',
        fillOpacity: 0.2,
        weight: 2
    };
    
    const circleOptions = { ...defaultOptions, ...options };
    
    const circle = L.circle([latitude, longitude], radius, circleOptions).addTo(appState.map);
    
    return circle;
}

/**
 * Add polygon overlay to map
 * @param {Array} latLngs - Array of [lat, lng] coordinate pairs
 * @param {Object} options - Polygon options
 */
function addMapPolygon(latLngs, options = {}) {
    const defaultOptions = {
        color: '#0d6efd',
        fillColor: '#0d6efd',
        fillOpacity: 0.2,
        weight: 2
    };
    
    const polygonOptions = { ...defaultOptions, ...options };
    
    const polygon = L.polygon(latLngs, polygonOptions).addTo(appState.map);
    
    return polygon;
}

/**
 * Clear all overlays from map (markers, circles, polygons)
 */
function clearMapOverlays() {
    appState.map.eachLayer(function(layer) {
        if (layer instanceof L.Marker || layer instanceof L.Circle || 
            layer instanceof L.Polygon || layer instanceof L.Polyline) {
            if (layer !== appState.marker) { // Don't remove the main marker
                appState.map.removeLayer(layer);
            }
        }
    });
}

/**
 * Fit map bounds to show all markers/overlays
 * @param {Array} coordinates - Array of [lat, lng] coordinates
 */
function fitMapBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) return;
    
    const bounds = L.latLngBounds(coordinates);
    appState.map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 12
    });
}

/**
 * Get current map center and zoom
 * @returns {Object} - Object with center and zoom
 */
function getMapView() {
    if (!appState.map) return null;
    
    const center = appState.map.getCenter();
    const zoom = appState.map.getZoom();
    
    return {
        latitude: center.lat,
        longitude: center.lng,
        zoom: zoom
    };
}

/**
 * Set map view to specific location
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {number} zoom - Zoom level
 */
function setMapView(latitude, longitude, zoom = 10) {
    if (appState.map) {
        appState.map.setView([latitude, longitude], zoom, {
            animate: true,
            duration: 0.5
        });
    }
}

/**
 * Add layer group for managing multiple markers/overlays
 * @param {string} groupName - Name for the layer group
 * @returns {L.LayerGroup} - Created layer group
 */
function addLayerGroup(groupName) {
    const layerGroup = L.layerGroup().addTo(appState.map);
    
    if (!appState.layerGroups) {
        appState.layerGroups = {};
    }
    
    appState.layerGroups[groupName] = layerGroup;
    
    return layerGroup;
}

/**
 * Remove layer group from map
 * @param {string} groupName - Name of layer group to remove
 */
function removeLayerGroup(groupName) {
    if (appState.layerGroups && appState.layerGroups[groupName]) {
        appState.map.removeLayer(appState.layerGroups[groupName]);
        delete appState.layerGroups[groupName];
    }
}

/**
 * Export map as image
 * @param {string} filename - Filename for the exported image
 */
function exportMapAsImage(filename = 'map.png') {
    // Note: This requires additional libraries like leaflet-image or html2canvas
    console.warn('Map export functionality requires additional library (leaflet-image)');
    showNotification('Map export feature coming soon', 'info');
}

// Listen for fullscreen changes to invalidate map size
document.addEventListener('fullscreenchange', function() {
    if (appState.map) {
        setTimeout(() => {
            appState.map.invalidateSize();
        }, 100);
    }
});

document.addEventListener('webkitfullscreenchange', function() {
    if (appState.map) {
        setTimeout(() => {
            appState.map.invalidateSize();
        }, 100);
    }
});

document.addEventListener('mozfullscreenchange', function() {
    if (appState.map) {
        setTimeout(() => {
            appState.map.invalidateSize();
        }, 100);
    }
});

document.addEventListener('MSFullscreenChange', function() {
    if (appState.map) {
        setTimeout(() => {
            appState.map.invalidateSize();
        }, 100); s
    }
});