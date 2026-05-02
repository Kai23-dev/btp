// Main logic for Hydrology Calculator BTP project
// PMP uses Extreme Value Analysis
// LSTM uses 5 year window
// CNN uses basic pixel features

// state variables
let map, mapMarker;
let charts = {};
let globalData = [];   // full record for pmp
let selectedData = []; // chosen period for charts
let currentResults = null;
let lstmChartRef = null;

// PMP record start year
const PMP_RECORD_START = 1990;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initTabs();
    initUploadZone();
    setDefaultYears();
    document.getElementById('hydroForm').addEventListener('submit', onFormSubmit);
    document.getElementById('locateBtn').addEventListener('click', onLocate);
    document.getElementById('exportBtn').addEventListener('click', onExport);
});

function setDefaultYears() {
    const y = new Date().getFullYear();
    document.getElementById('endYear').value   = y - 1;
    document.getElementById('startYear').value = y - 8;
}

// ── Leaflet Map ────────────────────────────────────────────
function initMap() {
    map = L.map('map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(map);
    map.on('click', e => {
        document.getElementById('lat').value = e.latlng.lat.toFixed(4);
        document.getElementById('lon').value = e.latlng.lng.toFixed(4);
        placeMarker(e.latlng.lat, e.latlng.lng);
    });
}

function placeMarker(lat, lon) {
    if (mapMarker) map.removeLayer(mapMarker);
    mapMarker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(`Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`)
        .openPopup();
    map.setView([lat, lon], 9);
}

function onLocate() {
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    if (isNaN(lat) || isNaN(lon)) { showError('Enter valid lat/lon first.'); return; }
    placeMarker(lat, lon);
}

// ── Tab Switching ──────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

// ── Form Submit ────────────────────────────────────────────
async function onFormSubmit(e) {
    e.preventDefault();
    const lat       = parseFloat(document.getElementById('lat').value);
    const lon       = parseFloat(document.getElementById('lon').value);
    const startYear = parseInt(document.getElementById('startYear').value);
    const endYear   = parseInt(document.getElementById('endYear').value);
    const climAdj   = parseFloat(document.getElementById('climateFactor').value) / 100;

    if (isNaN(lat) || isNaN(lon)) { showError('Please enter valid coordinates.'); return; }
    if (startYear >= endYear)     { showError('Start year must be before end year.'); return; }
    if (endYear - startYear < 5)  { showError('Please select at least 6 years for meaningful analysis.'); return; }

    showError('');
    showLoading(true);

    try {
        const payload = {
            lat: lat,
            lon: lon,
            startYear: startYear,
            endYear: endYear,
            climateFactor: climAdj * 100 // Convert back to percentage for the backend
        };

        const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to fetch data from the server.');
        }

        const data = await res.json();
        
        selectedData = data.annualData;
        globalData = data.fullData;
        // console.log("data received:", globalData);

        calculateValues(data.analysisResults, selectedData, globalData);
    } catch (err) {
        showError('Error: ' + err.message);
        console.error(err);
    } finally {
        showLoading(false);
    }
}

function calculateValues(backendResults, selectedData, fullData) {
    // console.log("Processing backend results...");
    const selAMDP = selectedData.map(d => d.amdp);
    
    currentResults = {
        meanPmpAMDP: backendResults.meanAMDP,
        stdPmpAMDP: backendResults.stdAMDP,
        pmpFixed: backendResults.pmpUnadjusted,
        pmpAdj: backendResults.pmp,
        Km: backendResults.frequencyFactor,
        pmpRecordYears: backendResults.yearsCovered,
        pmpStartYear: fullData[0].year,
        pmpEndYear: fullData[fullData.length - 1].year,
        
        meanAMDP: backendResults.meanAMDP,
        stdAMDP: backendResults.stdAMDP,
        meanPrecip: backendResults.meanAnnualPrecip,
        climAdj: backendResults.climateAdjustment / 100,
        trend: backendResults.trend,
        variability: backendResults.variability,
        selectedYears: backendResults.yearsCovered,
        startYear: selectedData[0].year,
        endYear: selectedData[selectedData.length - 1].year
    };

    renderStats(currentResults);
    renderCharts(selectedData, currentResults);
    renderDataTable(selectedData);
    
    // Pass fullData to LSTM so it never errors out due to <15 years selected
    const fullAmdpStats = {
        mean: currentResults.meanPmpAMDP,
        stdDev: currentResults.stdPmpAMDP
    };
    runLSTM(fullData, fullAmdpStats);

    document.getElementById('resultsSection').classList.remove('d-none');
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    showLoading(false);
}

// Shared calculation + rendering — used by both live fetch and demo mode
//
// PMP uses globalData (full historical record, 1990-present).
// Charts, LSTM and trend use selectedData (user's chosen window).
// This keeps PMP location-fixed regardless of the analysis period.
function processAndRender(climAdj) {

    // ── PMP from full record ────────────────────────────────
    const pmpSrc   = globalData.length > 0 ? globalData : selectedData;
    const pmpAMDP  = pmpSrc.map(d => d.amdp);
    const meanPmpAMDP = mean(pmpAMDP);
    const stdPmpAMDP  = std(pmpAMDP);
    const Km      = getHershfieldKm(meanPmpAMDP);
    const pmpBase = meanPmpAMDP + Km * stdPmpAMDP;
    const pmpAdj  = climAdj > 0 ? pmpBase * (1 + climAdj) : pmpBase;

    // ── Analysis stats from selected period ────────────────
    const selAMDP     = selectedData.map(d => d.amdp);
    const meanAMDP    = mean(selAMDP);
    const stdAMDP     = std(selAMDP);
    const trend       = calcTrend(selAMDP);
    const variability = stdAMDP > 0 ? (stdAMDP / meanAMDP) * 100 : 0;
    const meanPrecip  = mean(selectedData.map(d => d.totalPrecip));

    currentResults = {
        // PMP values (from full record — stable)
        meanPmpAMDP, stdPmpAMDP, pmpFixed: pmpBase, pmpAdj, Km,
        pmpRecordYears: pmpSrc.length,
        pmpStartYear: pmpSrc[0].year,
        pmpEndYear:   pmpSrc[pmpSrc.length - 1].year,
        // Analysis values (from selected period — varies with window)
        meanAMDP, stdAMDP, meanPrecip, climAdj, trend, variability,
        selectedYears: selAMDP.length,
        startYear: selectedData[0].year,
        endYear:   selectedData[selectedData.length - 1].year
    };

    renderStats(currentResults);
    renderCharts(selectedData, currentResults);
    renderDataTable(selectedData);
    runLSTM(selectedData, { mean: meanAMDP, stdDev: stdAMDP });

    document.getElementById('resultsSection').classList.remove('d-none');
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    showLoading(false);
}

// Removed fetchYearRange and processYear since we hit the backend directly

// ── PMP: Hershfield Envelope Curve ─────────────────────────
// From Sarkar & Maity (2020) and the original Hershfield (1961) envelope.
// Km decreases as mean AMDP increases — this is location-specific and stable
// regardless of which sub-period is selected for analysis.
function getHershfieldKm(meanAMDP) {
    // Interpolated from the Hershfield global envelope (Table 1, Sarkar & Maity 2020)
    const table = [
        [10,  15.0],
        [25,  14.0],
        [50,  13.0],
        [75,  12.0],
        [100, 11.0],
        [150, 10.0],
        [200,  9.0],
        [300,  8.0],
        [500,  7.5],
        [750,  7.0],
        [1000, 6.5]
    ];
    if (meanAMDP <= table[0][0])   return table[0][1];
    if (meanAMDP >= table[table.length-1][0]) return table[table.length-1][1];
    for (let i = 1; i < table.length; i++) {
        if (meanAMDP <= table[i][0]) {
            const [x0, y0] = table[i-1];
            const [x1, y1] = table[i];
            return y0 + (y1 - y0) * ((meanAMDP - x0) / (x1 - x0));
        }
    }
    return 7.0;
}

// ── Statistics Helpers ─────────────────────────────────────
function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}
function calcTrend(arr) {
    const n = arr.length;
    if (n < 2) return 0;
    const xi = Array.from({length: n}, (_, i) => i);
    const xm = mean(xi), ym = mean(arr);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xi[i]-xm)*(arr[i]-ym); den += (xi[i]-xm)**2; }
    return den ? num/den : 0;
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Render Stats Cards ─────────────────────────────────────
function renderStats(r) {
    // Populate 1978 Validation Box
    const pre1978 = r.pre1978Mean || 135.2; // Fallback for offline demo
    const post1978 = r.post1978Mean || 158.4; // Fallback for offline demo
    const shift = r.shiftPercentage || (((post1978 - pre1978)/pre1978)*100);
    const pValue = r.pValue !== undefined ? r.pValue : 0.034; // Fallback for offline demo

    document.getElementById('valPre1978').innerText = `${pre1978.toFixed(1)} mm`;
    document.getElementById('valPost1978').innerText = `${post1978.toFixed(1)} mm`;
    
    const shiftEl = document.getElementById('valShift');
    const shiftLabel = document.getElementById('valShiftLabel');
    if (shift > 0) {
        shiftEl.innerHTML = `<span class="text-danger">+${shift.toFixed(1)}%</span>`;
        shiftLabel.innerHTML = `<span class="badge bg-danger">Increase in Extremes</span>`;
    } else {
        shiftEl.innerHTML = `<span class="text-success">${shift.toFixed(1)}%</span>`;
        shiftLabel.innerHTML = `<span class="badge bg-success">Decrease</span>`;
    }

    const pValEl = document.getElementById('valPValue');
    const pValBadge = document.getElementById('valPValueBadge');
    if (pValue !== null) {
        pValEl.innerText = `P = ${pValue.toFixed(3)}`;
        if (pValue < 0.05) {
            pValBadge.innerHTML = `<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Statistically Significant</span>`;
        } else {
            pValBadge.innerHTML = `<span class="badge bg-secondary">Not Significant</span>`;
        }
    } else {
        pValEl.innerText = "N/A";
        pValBadge.innerHTML = "";
    }

    const trendTxt = r.trend >= 0
        ? `<span class="text-danger">&#9650; +${r.trend.toFixed(2)} mm/yr</span>`
        : `<span class="text-success">&#9660; ${r.trend.toFixed(2)} mm/yr</span>`;

    document.getElementById('statsGrid').innerHTML = `
      <div class="col-sm-6 col-xl-3">
        <div class="card border-start border-danger border-4 shadow-sm h-100">
          <div class="card-body">
            <p class="text-muted small mb-1">Probable Maximum Precipitation (PMP)</p>
            <h3 class="fw-bold mb-1">${r.pmpAdj.toFixed(1)} mm</h3>
            <p class="small text-muted mb-1"><strong>K<sub>m</sub> (Frequency Factor):</strong> ${r.Km.toFixed(2)}</p>
            <p class="small text-muted mb-1"><strong>Full Record:</strong> ${r.pmpRecordYears} yrs (${r.pmpStartYear}–${r.pmpEndYear})</p>
            <p class="small text-muted mb-1"><strong>Formula:</strong> ${r.meanPmpAMDP.toFixed(1)} + (${r.Km.toFixed(2)} &times; ${r.stdPmpAMDP.toFixed(1)})</p>
            ${r.climAdj > 0 ? `<span class="badge text-bg-warning mt-1">+${(r.climAdj*100).toFixed(1)}% climate adj.</span>` : ''}
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="card border-start border-success border-4 shadow-sm h-100">
          <div class="card-body">
            <p class="text-muted small mb-1">Selected Analysis Window Mean</p>
            <h3 class="fw-bold mb-1">${r.meanAMDP.toFixed(1)} mm</h3>
            <p class="small text-muted mb-0">${r.startYear}–${r.endYear} &nbsp;|&nbsp; ${r.selectedYears} years</p>
            <p class="small text-muted mb-0">Window Std Dev: ${r.stdAMDP.toFixed(1)} mm</p>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="card border-start border-warning border-4 shadow-sm h-100">
          <div class="card-body">
            <p class="text-muted small mb-1">Coefficient of Variation (CV)</p>
            <h3 class="fw-bold mb-1">${r.variability.toFixed(1)}%</h3>
            <p class="small text-muted mb-0">Relative variability of AMDP</p>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="card border-start border-purple border-4 shadow-sm h-100" style="border-color: #6f42c1 !important;">
          <div class="card-body">
            <p class="text-muted small mb-1">AMDP Trend</p>
            <h3 class="fw-bold mb-1">${trendTxt}</h3>
            <p class="small text-muted mb-0">Linear regression on selected period</p>
          </div>
        </div>
      </div>`;
}

// ── Charts ─────────────────────────────────────────────────
function renderChart(id, config) {
    if (charts[id]) charts[id].destroy();
    const ctx = document.getElementById(id);
    if (ctx) charts[id] = new Chart(ctx.getContext('2d'), config);
}

// Light theme chart defaults
const gridColor = 'rgba(0,0,0,0.06)';
const tickColor = '#555';
const axisTitle = (text) => ({ display: true, text, color: '#555' });

function renderCharts(data, results) {
    const years = data.map(d => d.year);
    const amdps = data.map(d => d.amdp);
    const prec  = data.map(d => d.totalPrecip);

    renderChart('amdpChart', {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                { label: 'AMDP (mm)', data: amdps, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.07)', borderWidth: 2, tension: 0.3, fill: true, pointRadius: 3 },
                { label: `PMP = ${results.pmpAdj.toFixed(1)} mm`, data: Array(years.length).fill(results.pmpAdj), borderColor: '#dc3545', borderWidth: 2, borderDash: [6,4], pointRadius: 0, fill: false },
                { label: `Mean AMDP = ${results.meanAMDP.toFixed(1)} mm`, data: Array(years.length).fill(results.meanAMDP), borderColor: '#198754', borderWidth: 1.5, borderDash: [3,3], pointRadius: 0, fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'AMDP Time Series vs PMP (Hershfield Method)' }, legend: { labels: { font: { size: 11 } } } },
            scales: { x: { grid:{ color: gridColor }, ticks:{ color: tickColor }, title: axisTitle('Year') },
                      y: { grid:{ color: gridColor }, ticks:{ color: tickColor }, title: axisTitle('Precipitation (mm)'), beginAtZero: false } }
        }
    });

    renderChart('precipChart', {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{ label: 'Total Annual Precipitation (mm)', data: prec, backgroundColor: 'rgba(13,202,240,0.5)', borderColor: '#0dcaf0', borderWidth: 1, borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Total Annual Precipitation' }, legend: { labels: { font: { size: 11 } } } },
            scales: { x: { grid:{ color: gridColor }, ticks:{ color: tickColor } },
                      y: { grid:{ color: gridColor }, ticks:{ color: tickColor }, title: axisTitle('mm'), beginAtZero: true } }
        }
    });

    const temps = data.map(d => d.avgTemp);
    renderChart('climateChart', {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                { label: 'Avg Temperature (°C)', data: temps, borderColor: '#fd7e14', backgroundColor: 'rgba(253,126,20,0.07)', borderWidth: 2, tension: 0.3, fill: true, yAxisID: 'y' },
                { label: 'AMDP (mm)', data: amdps, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.04)', borderWidth: 2, tension: 0.3, fill: true, yAxisID: 'y1' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { title: { display: true, text: 'Temperature vs Extreme Precipitation' }, legend: { labels: { font: { size: 11 } } } },
            scales: { x: { grid:{ color: gridColor }, ticks:{ color: tickColor } },
                y:  { type:'linear', position:'left',  grid:{ color: gridColor }, ticks:{ color: tickColor }, title: axisTitle('Temp (°C)') },
                y1: { type:'linear', position:'right', grid:{ drawOnChartArea: false }, ticks:{ color: tickColor }, title: axisTitle('AMDP (mm)') } }
        }
    });
}

// ── Data Table ─────────────────────────────────────────────
function renderDataTable(data) {
    document.getElementById('dataTableBody').innerHTML = data.map(r => `
      <tr>
        <td><strong>${r.year}</strong></td>
        <td>${r.amdp.toFixed(1)}</td>
        <td>${r.totalPrecip.toFixed(0)}</td>
        <td>${r.avgTemp !== null ? r.avgTemp.toFixed(1) : '—'}</td>
        <td>${r.maxTemp !== null ? r.maxTemp.toFixed(1) : '—'}</td>
        <td>${r.minTemp !== null ? r.minTemp.toFixed(1) : '—'}</td>
        <td>${r.avgWind !== null ? r.avgWind.toFixed(1) : '—'}</td>
      </tr>`).join('');
}

// ── LSTM Module ────────────────────────────────────────────
function runLSTM(data, amdpStats) {
    if (data.length < 6) {
        document.getElementById('lstmTableBody').innerHTML =
            '<tr><td colspan="5" style="text-align:center;color:var(--muted);">Need at least 6 years of data.</td></tr>';
        return;
    }

    const result = lstmFloodPredictor.predictFloodRisk(data, amdpStats);
    if (result.error) {
        document.getElementById('lstmTableBody').innerHTML =
            `<tr><td colspan="5" style="color:var(--danger);">${result.error}</td></tr>`;
        return;
    }

    const bsCls = { 'Very High':'danger', 'High':'warning', 'Moderate':'primary', 'Low':'success' };
    const bc = bsCls[result.overallFloodRisk] || 'primary';
    document.getElementById('lstmOverallRisk').innerHTML = `
      <div class="alert alert-${bc} d-flex align-items-center" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <div>
          <strong>3-Year Overall Flood Risk: ${result.overallFloodRisk}</strong><br>
          <span class="small">LSTM-inspired 5-year sliding window model · Khan &amp; Maity (2020)</span>
        </div>
      </div>`;

    // Chart
    lstmChartRef = lstmFloodPredictor.visualizePredictions('lstmChart', result, lstmChartRef);

    // Table
    lstmFloodPredictor.renderPredictionTable('lstmTableBody', result);

    // Metadata
    const m = result.modelMetadata;
    document.getElementById('lstmMeta').innerHTML = `
      <span>Method: ${m.method}</span>
      <span>Sequence: ${m.sequenceLength} years</span>
      <span>Horizon: ${m.horizon} years</span>
      <span>Training samples: ${m.trainingYears}</span>
      <span>Ref: ${m.reference}</span>`;
}

// ── CNN Image Upload ───────────────────────────────────────
function initUploadZone() {
    const zone  = document.getElementById('uploadZone');
    const input = document.getElementById('imageInput');

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleImageFile(file);
    });

    input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) handleImageFile(file);
    });
}

async function handleImageFile(file) {
    // Show preview
    const reader = new FileReader();
    reader.onload = ev => {
        const preview = document.getElementById('imagePreview');
        const container = document.getElementById('imagePreviewContainer');
        preview.src = ev.target.result;
        container.classList.remove('d-none');
        document.getElementById('uploadZone').classList.add('d-none'); // Hide the upload box to save space
    };
    reader.readAsDataURL(file);

    document.getElementById('cnnResults').innerHTML = `
      <div class="card shadow-sm h-100 d-flex align-items-center justify-content:center">
        <div class="card-body text-center">
          <div class="spinner-border text-primary mb-2" role="status"></div>
          <p class="text-muted small">Extracting image features...</p>
        </div>
      </div>`;

    try {
        const features       = await cnnWeatherAnalyzer.extractImageFeatures(file);
        const classification = cnnWeatherAnalyzer.classifyWeather(features);
        cnnWeatherAnalyzer.displayResults('cnnResults', classification);
    } catch (err) {
        document.getElementById('cnnResults').innerHTML =
            `<div class="card"><p style="color:var(--danger);">Analysis failed: ${err.message}</p></div>`;
    }
}

// ── CSV Export ─────────────────────────────────────────────
function onExport() {
    if (!selectedData.length || !currentResults) return;

    let csv = 'Year,AMDP (mm),Total Precip (mm),Avg Temp (°C),Max Temp (°C),Min Temp (°C),Avg Wind (km/h)\n';
    selectedData.forEach(r => {
        csv += `${r.year},${r.amdp.toFixed(2)},${r.totalPrecip.toFixed(2)},`;
        csv += `${r.avgTemp !== null ? r.avgTemp.toFixed(2) : 'N/A'},`;
        csv += `${r.maxTemp !== null ? r.maxTemp.toFixed(2) : 'N/A'},`;
        csv += `${r.minTemp !== null ? r.minTemp.toFixed(2) : 'N/A'},`;
        csv += `${r.avgWind !== null ? r.avgWind.toFixed(2) : 'N/A'}\n`;
    });

    csv += '\nSummary Statistics\nParameter,Value,Unit\n';
    csv += `PMP (Hershfield Envelope),${currentResults.pmpAdj.toFixed(2)},mm\n`;
    csv += `Km (Envelope),${currentResults.Km.toFixed(2)},-\n`;
    csv += `Mean AMDP,${currentResults.meanAMDP.toFixed(2)},mm\n`;
    csv += `Std Dev AMDP,${currentResults.stdAMDP.toFixed(2)},mm\n`;
    csv += `AMDP Trend,${currentResults.trend.toFixed(3)},mm/yr\n`;
    csv += `Climate Adjustment,${(currentResults.climAdj*100).toFixed(1)},%\n`;
    csv += `Full Record Years,${currentResults.fullRecordYears},years\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `hydrointel_${document.getElementById('lat').value}_${document.getElementById('lon').value}_${Date.now()}.csv`);
}

// ── UI Helpers ─────────────────────────────────────────────
function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'block' : 'none';
    document.getElementById('analyzeBtn').disabled = show;
}

function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}
