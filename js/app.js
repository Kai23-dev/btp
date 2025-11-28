/**
 * Main Application JavaScript for Hydrological Parameter Calculator
 * Handles UI interactions and coordinates between different modules
 *
 * This application implements methodologies from:
 * 1. Sarkar & Maity (2021) - Global climate shift in 1970s
 * 2. Hussain et al. (2021) - Estimation of hydrogeological parameters
 *
 * Author: Hydrological Research Team
 * Date: 2023
 */

// Global variables for application state
const appState = {
  map: null,
  marker: null,
  charts: {},
  currentLocation: null,
  analysisData: null,
  isLoading: false
};

// DOM elements cache for performance
const elements = {
  // Form elements
  locationForm: document.getElementById('locationForm'),
  latitudeInput: document.getElementById('latitude'),
  longitudeInput: document.getElementById('longitude'),
  startYearInput: document.getElementById('startYear'),
  endYearInput: document.getElementById('endYear'),
  locateBtn: document.getElementById('locateBtn'),

  // UI elements
  loadingIndicator: document.getElementById('loadingIndicator'),
  resultsContainer: document.getElementById('resultsContainer'),
  downloadBtn: document.getElementById('downloadBtn'),

  // Result elements
  locationResult: document.getElementById('locationResult'),
  avgPrecipResult: document.getElementById('avgPrecipResult'),
  meanAmdpResult: document.getElementById('meanAmdpResult'),
  stdAmdpResult: document.getElementById('stdAmdpResult'),
  pmpResult: document.getElementById('pmpResult'),
  climateZoneResult: document.getElementById('climateZoneResult'),
  kmResult: document.getElementById('kmResult'),
  envelopeType: document.getElementById('envelopeType'),
  avgTempResult: document.getElementById('avgTempResult'),
  avgHumidityResult: document.getElementById('avgHumidityResult'),
  avgWindResult: document.getElementById('avgWindResult'),
  dataTableBody: document.getElementById('dataTableBody')
};

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

/**
 * Initialize application components
 */
function initializeApp() {
  // Initialize map
  initializeMap();

  // Setup event listeners
  setupEventListeners();

  // Initialize tooltips
  initializeTooltips();

  console.log('Hydrological Calculator initialized successfully');
}

/**
 * Setup event listeners for form elements
 */
function setupEventListeners() {
  // Form submission
  elements.locationForm.addEventListener('submit', handleFormSubmit);

  // Locate button
  elements.locateBtn.addEventListener('click', handleLocateOnMap);

  // Download button
  elements.downloadBtn.addEventListener('click', handleDownloadData);

  // Input validation feedback
  elements.latitudeInput.addEventListener('input', validateLatitudeInput);
  elements.longitudeInput.addEventListener('input', validateLongitudeInput);
  elements.startYearInput.addEventListener('input', validateYearInput);
  elements.endYearInput.addEventListener('input', validateYearInput);
}

/**
 * Handle form submission
 */
function handleFormSubmit(event) {
  event.preventDefault();

  // Get form values
  const latitude = parseFloat(elements.latitudeInput.value);
  const longitude = parseFloat(elements.longitudeInput.value);
  const startYear = parseInt(elements.startYearInput.value);
  const endYear = parseInt(elements.endYearInput.value);

  // Validate input
  if (!validateInput(latitude, longitude, startYear, endYear)) {
    showNotification('Please enter valid input values', 'warning');
    return;
  }

  // Store current location
  appState.currentLocation = {
    latitude,
    longitude,
    startYear,
    endYear
  };

  // Show loading indicator
  showLoading();

  // Calculate parameters with delay to show loading animation
  setTimeout(() => {
    try {
      // Calculate hydrological parameters
      calculateHydrologicalParameters(latitude, longitude, startYear, endYear);

      // Hide loading and show results
      hideLoading();
      showResults();

      // Scroll to results
      scrollToSection('resultsContainer');

      // Show success notification
      showNotification('Analysis completed successfully!', 'success');
    } catch (error) {
      console.error('Error during calculation:', error);
      hideLoading();
      showNotification('An error occurred during calculation. Please try again.', 'danger');
    }
  }, 2000);
}

/**
 * Handle locate on map button click
 */
function handleLocateOnMap() {
  const latitude = parseFloat(elements.latitudeInput.value);
  const longitude = parseFloat(elements.longitudeInput.value);

  if (isNaN(latitude) || isNaN(longitude)) {
    showNotification('Please enter valid latitude and longitude values', 'warning');
    return;
  }

  // Update marker position
  updateMapMarker(latitude, longitude);

  // Show notification
  showNotification(`Location selected: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, 'info');
}

/**
 * Handle download data button click
 */
function handleDownloadData() {
  if (!appState.analysisData) {
    showNotification('No data available for download', 'warning');
    return;
  }

  try {
    // Generate CSV content
    const csvContent = generateCSVContent(appState.analysisData);

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hydrological_data_${appState.currentLocation.latitude}_${appState.currentLocation.longitude}_${appState.currentLocation.startYear}_${appState.currentLocation.endYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up
    URL.revokeObjectURL(url);

    // Show success notification
    showNotification('Data downloaded successfully!', 'success');
  } catch (error) {
    console.error('Error downloading data:', error);
    showNotification('Failed to download data', 'danger');
  }
}

/**
 * Validate form input functions
 */
function validateLatitudeInput() {
  const value = parseFloat(this.value);
  const isValid = !isNaN(value) && value >= -90 && value <= 90;
  this.classList.toggle('is-invalid', !isValid && this.value !== '');
}

function validateLongitudeInput() {
  const value = parseFloat(this.value);
  const isValid = !isNaN(value) && value >= -180 && value <= 180;
  this.classList.toggle('is-invalid', !isValid && this.value !== '');
}

function validateYearInput() {
  const value = parseInt(this.value);
  const isValid = !isNaN(value) && value >= 1940 && value <= 2023;
  this.classList.toggle('is-invalid', !isValid && this.value !== '');
}

/**
 * Validate all input values
 */
function validateInput(latitude, longitude, startYear, endYear) {
  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    return false;
  }
  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    return false;
  }
  if (isNaN(startYear) || startYear < 1940 || startYear > 2023) {
    return false;
  }
  if (isNaN(endYear) || endYear < 1940 || endYear > 2023) {
    return false;
  }
  if (startYear > endYear) {
    return false;
  }
  return true;
}

/**
 * Show loading indicator
 */
function showLoading() {
  appState.isLoading = true;
  elements.loadingIndicator.classList.remove('d-none');
  elements.resultsContainer.classList.add('d-none');

  // Disable form inputs during loading
  elements.locationForm.querySelectorAll('input, button').forEach(el => {
    el.disabled = true;
  });
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  appState.isLoading = false;
  elements.loadingIndicator.classList.add('d-none');

  // Re-enable form inputs
  elements.locationForm.querySelectorAll('input, button').forEach(el => {
    el.disabled = false;
  });
}

/**
 * Show results container
 */
function showResults() {
  elements.resultsContainer.classList.remove('d-none');
  elements.resultsContainer.classList.add('fade-in');
}

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (success, warning, danger, info)
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '1050';
  notification.style.minWidth = '300px';
  notification.style.maxWidth = '400px';
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  // Add to document
  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 150);
    }
  }, 5000);
}

/**
 * Scroll to a specific section
 * @param {string} sectionId - ID of section to scroll to
 */
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
}

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
    new bootstrap.Tooltip(el);
  });
}

/**
 * Initialize Leaflet map
 */
function initializeMap() {
  // Create map centered on India
  appState.map = L.map('map').setView([20.5937, 78.9629], 5);

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(appState.map);

  // Add click event listener
  appState.map.on('click', handleMapClick);

  // Add scale control
  addMapScale();
}

/**
 * Update map with marker
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

  // Center map on marker
  appState.map.setView([latitude, longitude], 10);
}

/**
 * Handle map click events
 * @param {Object} e - Leaflet map click event
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
 * Pan map to a specific location
 * @param {number} latitude - Latitude to pan to
 * @param {number} longitude - Longitude to pan to
 * @param {number} zoom - Zoom level (optional)
 */
function panMapToLocation(latitude, longitude, zoom = 10) {
  if (appState.map) {
    appState.map.setView([latitude, longitude], zoom);
  }
}

/**
 * Add a circle overlay to map
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Radius in meters
 * @param {Object} options - Additional options for the circle
 */
function addMapCircle(latitude, longitude, radius, options = {}) {
  const defaultOptions = {
    color: '#0d6efd',
    fillColor: '#0d6efd',
    fillOpacity: 0.2,
    weight: 2
  };

  const circleOptions = { ...defaultOptions, ...options };

  return L.circle([latitude, longitude], radius, circleOptions).addTo(appState.map);
}

/**
 * Add a polygon overlay to map
 * @param {Array} latLngs - Array of [lat, lng] pairs
 * @param {Object} options - Additional options for the polygon
 */
function addMapPolygon(latLngs, options = {}) {
  const defaultOptions = {
    color: '#0d6efd',
    fillColor: '#0d6efd',
    fillOpacity: 0.2,
    weight: 2
  };

  const polygonOptions = { ...defaultOptions, ...options };

  return L.polygon(latLngs, polygonOptions).addTo(appState.map);
}

/**
 * Add a scale control to map
 */
function addMapScale() {
  L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
  }).addTo(appState.map);
}

/**
 * Add a fullscreen control to map
 */
function addMapFullscreen() {
  // Create fullscreen control
  const fullscreenControl = L.control({
    position: 'topright'
  });

  fullscreenControl.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    const button = L.DomUtil.create('button', '', div);
    button.innerHTML = '<i class="fas fa-expand"></i>';
    button.style.backgroundColor = 'white';
    button.style.border = 'none';
    button.style.width = '30px';
    button.style.height = '30px';
    button.style.cursor = 'pointer';
    button.title = 'Toggle Fullscreen';

    button.onclick = function() {
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

  if (!document.fullscreenElement) {
    if (mapContainer.requestFullscreen) {
      mapContainer.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else if (mapContainer.webkitRequestFullscreen) {
      mapContainer.webkitRequestFullscreen();
    } else if (mapContainer.msRequestFullscreen) {
      mapContainer.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

/**
 * Add a custom legend to map
 * @param {Object} legendData - Object containing legend items
 * @param {Object} options - Additional options for the legend
 */
function addMapLegend(legendData, options = {}) {
  const legend = L.control({
    position: options.position || 'bottomright'
  });

  legend.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'info legend');
    div.style.backgroundColor = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '5px';
    div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';

    // Create legend content
    let legendContent = '<h4 style="margin: 0 0 10px 0;">Legend</h4>';

    // Create legend items
    for (const key in legendData) {
      const item = legendData[key];
      legendContent += `
        <div class="legend-item" style="margin: 5px 0;">
          <i style="background: ${item.color}; width: 18px; height: 18px; display: inline-block; margin-right: 5px;"></i>
          <span>${item.label}</span>
        </div>
      `;
    }

    div.innerHTML = legendContent;
    return div;
  };

  legend.addTo(appState.map);
}

/**
 * Add annotation to chart
 * @param {string} chartId - ID of chart to add annotation to
 * @param {Object} annotation - Annotation object
 */
function addChartAnnotation(chartId, annotation) {
  const chart = appState.charts[chartId];

  if (!chart) {
    console.warn(`Chart with ID ${chartId} not found`);
    return;
  }

  // Add annotation if it doesn't exist
  if (!chart.options.plugins.annotation) {
    chart.options.plugins.annotation = {
      annotations: {}
    };
  }

  // Add annotation
  chart.options.plugins.annotation.annotations[annotation.id] = annotation;
  chart.update();
}

/**
 * Generate CSV content from analysis data
 * @param {Object} data - Analysis data object
 * @returns {string} CSV formatted string
 */
function generateCSVContent(data) {
  let csv = 'Parameter,Value,Unit\n';
  csv += `Latitude,${data.latitude},degrees\n`;
  csv += `Longitude,${data.longitude},degrees\n`;
  csv += `Average Precipitation,${data.avgPrecip},mm\n`;
  csv += `Mean AMDP,${data.meanAmdp},mm\n`;
  csv += `Standard Deviation AMDP,${data.stdAmdp},mm\n`;
  csv += `PMP,${data.pmp},mm\n`;
  csv += `Climate Zone,${data.climateZone},-\n`;
  csv += `Average Temperature,${data.avgTemp},°C\n`;
  csv += `Average Humidity,${data.avgHumidity},%\n`;
  csv += `Average Wind Speed,${data.avgWind},m/s\n`;
  return csv;
}

/**
 * Update chart data
 * @param {string} chartId - ID of chart to update
 * @param {Object} newData - New data for the chart
 */
function updateChart(chartId, newData) {
  const chart = appState.charts[chartId];
  
  if (!chart) {
    console.warn(`Chart with ID ${chartId} not found`);
    return;
  }

  chart.data = newData;
  chart.update();
}

// Expose functions to global scope
window.appState = appState;

window.mapFunctions = {
  initializeMap,
  updateMapMarker,
  panMapToLocation,
  addMapCircle,
  addMapPolygon,
  addMapScale,
  addMapFullscreen,
  addMapLegend
};

window.chartFunctions = {
  addChartAnnotation,
  updateChart
};

window.utilityFunctions = {
  showNotification,
  scrollToSection,
  generateCSVContent
};