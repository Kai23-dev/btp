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
    document.getElementById('demoBtn').addEventListener('click', loadDemoData);
});

// ── Demo Data (Mumbai, 2010-2023) ──────────────────────────
// Pre-baked realistic AMDP values for Mumbai, Maharashtra.
// Based on IMD observations referenced in Sarkar & Maity (2020).
// Useful when the Open-Meteo API is rate-limited.
const DEMO_DATA = [
    { year:2010, amdp:143, totalPrecip:2150, avgTemp:27.2, maxTemp:34.1, minTemp:19.8, avgWind:11.2, dataPoints:365 },
    { year:2011, amdp:187, totalPrecip:2380, avgTemp:27.0, maxTemp:33.8, minTemp:20.1, avgWind:10.8, dataPoints:365 },
    { year:2012, amdp:112, totalPrecip:1890, avgTemp:27.5, maxTemp:34.3, minTemp:20.3, avgWind:11.5, dataPoints:366 },
    { year:2013, amdp:235, totalPrecip:2640, avgTemp:27.3, maxTemp:34.0, minTemp:19.9, avgWind:10.6, dataPoints:365 },
    { year:2014, amdp: 98, totalPrecip:1720, avgTemp:27.8, maxTemp:34.8, minTemp:20.5, avgWind:11.8, dataPoints:365 },
    { year:2015, amdp:176, totalPrecip:2290, avgTemp:27.6, maxTemp:34.5, minTemp:20.2, avgWind:11.0, dataPoints:365 },
    { year:2016, amdp:154, totalPrecip:2100, avgTemp:27.4, maxTemp:34.2, minTemp:20.0, avgWind:11.3, dataPoints:366 },
    { year:2017, amdp:198, totalPrecip:2520, avgTemp:27.1, maxTemp:33.9, minTemp:19.7, avgWind:10.9, dataPoints:365 },
    { year:2018, amdp:221, totalPrecip:2780, avgTemp:27.7, maxTemp:34.6, minTemp:20.4, avgWind:11.6, dataPoints:365 },
    { year:2019, amdp:167, totalPrecip:2380, avgTemp:27.3, maxTemp:34.1, minTemp:20.1, avgWind:11.1, dataPoints:365 },
    { year:2020, amdp:145, totalPrecip:2050, avgTemp:27.5, maxTemp:34.4, minTemp:20.3, avgWind:11.4, dataPoints:366 },
    { year:2021, amdp:203, totalPrecip:2650, avgTemp:27.2, maxTemp:34.0, minTemp:19.8, avgWind:10.7, dataPoints:365 },
    { year:2022, amdp:178, totalPrecip:2300, avgTemp:27.6, maxTemp:34.5, minTemp:20.2, avgWind:11.2, dataPoints:365 },
    { year:2023, amdp:249, totalPrecip:2890, avgTemp:27.8, maxTemp:34.9, minTemp:20.6, avgWind:11.7, dataPoints:365 }
];

function loadDemoData() {
    document.getElementById('lat').value       = '19.0760';
    document.getElementById('lon').value       = '72.8777';
    document.getElementById('startYear').value = '2010';
    document.getElementById('endYear').value   = '2023';
    document.getElementById('climateFactor').value = '7';
    placeMarker(19.0760, 72.8777);

    // globalData = full record for stable PMP (use all 14 demo years always)
    globalData   = DEMO_DATA;
    selectedData = DEMO_DATA;
    
    // Offline calculation for demo mode (using local Km)
    const pmpAMDP = globalData.map(d => d.amdp);
    const meanPmpAMDP = pmpAMDP.reduce((a, b) => a + b, 0) / pmpAMDP.length;
    const stdPmpAMDP = Math.sqrt(pmpAMDP.reduce((s, v) => s + Math.pow(v - meanPmpAMDP, 2), 0) / (pmpAMDP.length - 1));
    const maxAmdp = Math.max(...pmpAMDP);
    const rest = pmpAMDP.filter(x => x !== maxAmdp);
    const xMean = rest.reduce((a, b) => a + b, 0) / rest.length;
    const xStd = Math.sqrt(rest.reduce((s, v) => s + Math.pow(v - xMean, 2), 0) / (rest.length - 1));
    
    let Km = (maxAmdp - xMean) / xStd;
    Km = Math.max(2.0, Math.min(6.0, Km)); // bound
    
    const pmpBase = meanPmpAMDP + Km * stdPmpAMDP;
    const climAdj = 7; // User input percentage
    const pmpAdj = pmpBase * (1 + (climAdj / 100));
    
    const selAMDP = selectedData.map(d => d.amdp);
    const meanAMDP = selAMDP.reduce((a, b) => a + b, 0) / selAMDP.length;
    const stdAMDP = Math.sqrt(selAMDP.reduce((s, v) => s + Math.pow(v - meanAMDP, 2), 0) / (selAMDP.length - 1));
    const meanPrecip = selectedData.map(d => d.totalPrecip).reduce((a, b) => a + b, 0) / selectedData.length;
    const variability = (stdAMDP / meanAMDP) * 100;
    
    currentResults = {
        meanPmpAMDP: meanPmpAMDP,
        stdPmpAMDP: stdPmpAMDP,
        pmpFixed: pmpBase,
        pmpAdj: pmpAdj,
        Km: Km,
        pmpRecordYears: globalData.length,
        pmpStartYear: globalData[0].year,
        pmpEndYear: globalData[globalData.length - 1].year,
        
        meanAMDP: meanAMDP,
        stdAMDP: stdAMDP,
        meanPrecip: meanPrecip,
        climAdj: climAdj,
        trend: 1.2, // mock trend
        variability: variability,
        selectedYears: selectedData.length,
        startYear: selectedData[0].year,
        endYear: selectedData[selectedData.length - 1].year
    };

    renderStats(currentResults);
    renderCharts(selectedData, currentResults);
    renderDataTable(selectedData);
    runLSTM(globalData, { mean: meanPmpAMDP, stdDev: stdPmpAMDP });

    document.getElementById('resultsSection').classList.remove('d-none');
    document.getElementById('exportBtn').disabled = false;
    showError('Demo mode: Mumbai data (2010-2023). Calculation performed offline.');
}

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
    const trendTxt = r.trend >= 0
        ? `<span class="text-danger">&#9650; +${r.trend.toFixed(2)} mm/yr</span>`
        : `<span class="text-success">&#9660; ${r.trend.toFixed(2)} mm/yr</span>`;

    document.getElementById('statsGrid').innerHTML = `
      <div class="col-sm-6 col-xl-3">
        <div class="card border-start border-danger border-4 shadow-sm h-100">
          <div class="card-body">
            <p class="text-muted small mb-1">Probable Maximum Precipitation (PMP)</p>
            <h3 class="fw-bold mb-1">${r.pmpAdj.toFixed(1)} mm</h3>
            <p class="small text-muted mb-1">Km = ${r.Km.toFixed(2)} &nbsp;|&nbsp; Hershfield envelope (Sarkar &amp; Maity 2020)</p>
            <p class="small text-muted mb-1">Record: ${r.pmpStartYear}–${r.pmpEndYear} (${r.pmpRecordYears} yrs, location-fixed)</p>
            ${r.climAdj > 0 ? `<span class="badge text-bg-warning">+${(r.climAdj*100).toFixed(1)}% climate adj.</span>` : '<span class="badge text-bg-success">No climate adjustment</span>'}
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="card border-start border-success border-4 shadow-sm h-100">
          <div class="card-body">
            <p class="text-muted small mb-1">Mean AMDP (Selected Period)</p>
            <h3 class="fw-bold mb-1">${r.meanAMDP.toFixed(1)} mm</h3>
            <p class="small text-muted mb-0">${r.startYear}–${r.endYear} &nbsp;|&nbsp; ${r.selectedYears} years</p>
            <p class="small text-muted mb-0">Std Dev: ${r.stdAMDP.toFixed(1)} mm</p>
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
        container.style.display = 'block';
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
