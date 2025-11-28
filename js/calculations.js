/**
 * Hydrological calculations module
 * Contains functions for calculating AMDP, PMP, and other hydrological parameters
 * 
 * Author: Hydrological Research Team
 * Date: 2023
 */

/**
 * Calculate hydrological parameters for a given location and time period
 * @param {number} latitude - Latitude of location
 * @param {number} longitude - Longitude of location
 * @param {number} startYear - Start year of analysis
 * @param {number} endYear - End year of analysis
 * @returns {Object} - Object containing all calculated parameters
 */
function calculateHydrologicalParameters(latitude, longitude, startYear, endYear) {
    // Generate mock data (in real app, this would fetch data from an API)
    const data = generateMockData(latitude, longitude, startYear, endYear);
    
    // Calculate AMDP statistics
    const amdpStats = calculateAmdpStatistics(data);
    
    // Calculate PMP using Hershfield method
    const pmpData = calculatePMP(data, amdpStats);
    
    // Calculate climate statistics
    const climateStats = calculateClimateStatistics(data);
    
    // Determine climate zone
    const climateZone = determineClimateZone(climateStats.avgAnnualPrecip, latitude);
    
    // Store analysis data
    appState.analysisData = {
        latitude,
        longitude,
        startYear,
        endYear,
        data,
        amdpStats,
        pmpData,
        climateStats,
        climateZone
    };
    
    // Update UI with results
    updateResultsUI(latitude, longitude, amdpStats, pmpData, climateStats, climateZone);
    
    // Populate data table
    populateDataTable(data);
    
    // Create all charts
    createAllCharts(data, amdpStats, pmpData, climateStats);
    
    return appState.analysisData;
}

/**
 * Generate mock data for demonstration purposes
 * In a real application, this would fetch data from a climate API
 * 
 * @param {number} latitude - Latitude of location
 * @param {number} longitude - Longitude of location
 * @param {number} startYear - Start year of analysis
 * @param {number} endYear - End year of analysis
 * @returns {Array} - Array of yearly data
 */
function generateMockData(latitude, longitude, startYear, endYear) {
    const basePrecip = 1000 + (Math.abs(latitude) < 30 ? 500 : 0) + (Math.random() - 0.5) * 500;
    const baseTemp = 25 - Math.abs(latitude) * 0.5 + (Math.random() - 0.5) * 5;
    const baseHumidity = 60 + (Math.abs(latitude) < 30 ? 20 : 0) + (Math.random() - 0.5) * 20;
    const baseWind = 3 + (Math.random() - 0.5) * 2;
    
    const data = [];
    const years = endYear - startYear + 1;
    
    for (let i = 0; i < years; i++) {
        const year = startYear + i;
        
        // Add climate shift effect after 1978
        const shiftFactor = year > 1978 ? 1.15 : 1.0;
        
        // Generate annual precipitation with some randomness
        const annualPrecip = basePrecip * shiftFactor * (0.8 + Math.random() * 0.4);
        
        // Generate AMDP (typically 5-15% of annual precipitation)
        const amdpRatio = 0.05 + Math.random() * 0.1;
        const amdp = annualPrecip * amdpRatio * shiftFactor;
        
        // Generate climate variables
        const avgTemp = baseTemp + (Math.random() - 0.5) * 3 + (year > 1978 ? 0.5 : 0);
        const avgHumidity = baseHumidity + (Math.random() - 0.5) * 10;
        const avgWindSpeed = baseWind + (Math.random() - 0.5) * 1;
        
        data.push({
            year,
            amdp,
            annualPrecip,
            avgTemp,
            avgHumidity,
            avgWindSpeed
        });
    }
    
    return data;
}

/**
 * Calculate AMDP statistics from data
 * @param {Array} data - Array of yearly data
 * @returns {Object} - Object containing AMDP statistics
 */
function calculateAmdpStatistics(data) {
    const amdpValues = data.map(d => d.amdp);
    const meanAmdp = calculateMean(amdpValues);
    const stdAmdp = calculateStandardDeviation(amdpValues, meanAmdp);
    const minAmdp = Math.min(...amdpValues);
    const maxAmdp = Math.max(...amdpValues);
    
    return {
        values: amdpValues,
        mean: meanAmdp,
        stdDev: stdAmdp,
        min: minAmdp,
        max: maxAmdp
    };
}

/**
 * Calculate PMP using Hershfield method
 * @param {Array} data - Array of yearly data
 * @param {Object} amdpStats - AMDP statistics
 * @returns {Object} - Object containing PMP data
 */
function calculatePMP(data, amdpStats) {
    // Calculate frequency factors for each year
    const kValues = [];
    
    for (let i = 0; i < data.length; i++) {
        // Create array without current value
        const withoutCurrent = [...data.slice(0, i), ...data.slice(i + 1)];
        const amdpWithoutCurrent = withoutCurrent.map(d => d.amdp);
        const meanWithout = calculateMean(amdpWithoutCurrent);
        const stdWithout = calculateStandardDeviation(amdpWithoutCurrent, meanWithout);
        
        if (stdWithout > 0) {
            // Calculate frequency factor using Hershfield method
            const k = (data[i].amdp - meanWithout) / stdWithout;
            kValues.push(k);
        }
    }
    
    // Find maximum frequency factor (Km)
    const km = Math.max(...kValues);
    
    // Determine envelope type based on mean AMDP
    let envelopeType;
    if (amdpStats.mean < 50) {
        envelopeType = "Low Precipitation Envelope";
    } else if (amdpStats.mean < 100) {
        envelopeType = "Moderate Precipitation Envelope";
    } else {
        envelopeType = "High Precipitation Envelope";
    }
    
    // Calculate PMP using Hershfield method
    const pmp = amdpStats.mean + km * amdpStats.stdDev;
    
    return {
        value: pmp,
        km: km,
        envelopeType: envelopeType
    };
}

/**
 * Calculate climate statistics from data
 * @param {Array} data - Array of yearly data
 * @returns {Object} - Object containing climate statistics
 */
function calculateClimateStatistics(data) {
    const avgTemp = calculateMean(data.map(d => d.avgTemp));
    const avgHumidity = calculateMean(data.map(d => d.avgHumidity));
    const avgWindSpeed = calculateMean(data.map(d => d.avgWindSpeed));
    const totalPrecip = data.reduce((sum, d) => sum + d.annualPrecip, 0);
    const avgAnnualPrecip = totalPrecip / data.length;
    
    return {
        avgTemp,
        avgHumidity,
        avgWindSpeed,
        avgAnnualPrecip
    };
}

/**
 * Determine climate zone based on precipitation and latitude
 * @param {number} avgPrecip - Average annual precipitation
 * @param {number} latitude - Latitude of location
 * @returns {string} - Climate zone description
 */
function determineClimateZone(avgPrecip, latitude) {
    const absLat = Math.abs(latitude);
    
    if (absLat < 23.5) {
        return avgPrecip > 2000 ? 'Tropical Rainforest' : 'Tropical Seasonal';
    } else if (absLat < 35) {
        return avgPrecip < 500 ? 'Arid/Semi-Arid' : 'Subtropical';
    } else if (absLat < 60) {
        return avgPrecip > 1000 ? 'Temperate Oceanic' : 'Temperate Continental';
    } else {
        return 'Polar/Subpolar';
    }
}

/**
 * Update UI with calculation results
 * @param {number} latitude - Latitude of location
 * @param {number} longitude - Longitude of location
 * @param {Object} amdpStats - AMDP statistics
 * @param {Object} pmpData - PMP data
 * @param {Object} climateStats - Climate statistics
 * @param {string} climateZone - Climate zone description
 */
function updateResultsUI(latitude, longitude, amdpStats, pmpData, climateStats, climateZone) {
    // Update main result elements
    if (elements.locationResult) {
        elements.locationResult.textContent = `${latitude.toFixed(4)}°${latitude >= 0 ? 'N' : 'S'}, ${longitude.toFixed(4)}°${longitude >= 0 ? 'E' : 'W'}`;
    }
    if (elements.avgPrecipResult) {
        elements.avgPrecipResult.textContent = `${climateStats.avgAnnualPrecip.toFixed(2)} mm/year`;
    }
    if (elements.meanAmdpResult) {
        elements.meanAmdpResult.textContent = `${amdpStats.mean.toFixed(2)} mm`;
    }
    if (elements.stdAmdpResult) {
        elements.stdAmdpResult.textContent = `${amdpStats.stdDev.toFixed(2)} mm`;
    }
    if (elements.pmpResult) {
        elements.pmpResult.textContent = `${pmpData.value.toFixed(2)} mm`;
    }
    if (elements.climateZoneResult) {
        elements.climateZoneResult.textContent = climateZone;
    }
    
    // Update PMP parameters
    if (elements.kmResult) {
        elements.kmResult.textContent = pmpData.km.toFixed(2);
    }
    if (elements.envelopeType) {
        elements.envelopeType.textContent = pmpData.envelopeType;
    }
    
    // Update climate variables
    if (elements.avgTempResult) {
        elements.avgTempResult.textContent = `${climateStats.avgTemp.toFixed(2)}°C`;
    }
    if (elements.avgHumidityResult) {
        elements.avgHumidityResult.textContent = `${climateStats.avgHumidity.toFixed(2)}%`;
    }
    if (elements.avgWindResult) {
        elements.avgWindResult.textContent = `${climateStats.avgWindSpeed.toFixed(2)} m/s`;
    }
    
    // Update AMDP statistics if elements exist
    if (elements.amdpMeanStat) {
        elements.amdpMeanStat.textContent = `${amdpStats.mean.toFixed(2)} mm`;
    }
    if (elements.amdpStdStat) {
        elements.amdpStdStat.textContent = `${amdpStats.stdDev.toFixed(2)} mm`;
    }
    if (elements.amdpMinStat) {
        elements.amdpMinStat.textContent = `${amdpStats.min.toFixed(2)} mm`;
    }
    if (elements.amdpMaxStat) {
        elements.amdpMaxStat.textContent = `${amdpStats.max.toFixed(2)} mm`;
    }
}

/**
 * Populate data table
 * @param {Array} data - Array of yearly data
 */
function populateDataTable(data) {
    if (!elements.dataTableBody) {
        console.warn('Data table body element not found');
        return;
    }
    
    // Clear existing table rows
    elements.dataTableBody.innerHTML = '';
    
    // Add new rows
    data.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        // Add fade-in animation with delay
        tr.style.opacity = '0';
        tr.style.transform = 'translateY(20px)';
        tr.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        tr.innerHTML = `
            <td>${row.year}</td>
            <td>${row.amdp.toFixed(2)}</td>
            <td>${row.annualPrecip.toFixed(2)}</td>
            <td>${row.avgTemp.toFixed(2)}</td>
            <td>${row.avgHumidity.toFixed(2)}</td>
            <td>${row.avgWindSpeed.toFixed(2)}</td>
        `;
        
        elements.dataTableBody.appendChild(tr);
        
        // Trigger animation after adding to DOM
        setTimeout(() => {
            tr.style.opacity = '1';
            tr.style.transform = 'translateY(0)';
        }, 50 * index);
    });
}

/**
 * Calculate mean of an array
 * @param {Array} values - Array of numbers
 * @returns {number} - Mean value
 */
function calculateMean(values) {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}

/**
 * Calculate standard deviation
 * @param {Array} values - Array of numbers
 * @param {number} mean - Mean value (optional, will calculate if not provided)
 * @returns {number} - Standard deviation
 */
function calculateStandardDeviation(values, mean = null) {
    if (values.length === 0) return 0;
    
    const avg = mean !== null ? mean : calculateMean(values);
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / (values.length - 1);
    
    return Math.sqrt(variance);
}

/**
 * Create all charts for visualization
 * @param {Array} data - Array of yearly data
 * @param {Object} amdpStats - AMDP statistics
 * @param {Object} pmpData - PMP data
 * @param {Object} climateStats - Climate statistics
 */
function createAllCharts(data, amdpStats, pmpData, climateStats) {
    // Create AMDP time series chart
    createAmdpTimeSeriesChart(data);
    
    // Create precipitation chart
    createPrecipitationChart(data);
    
    // Create climate variables chart
    createClimateVariablesChart(data);
    
    // Create AMDP distribution chart
    createAmdpDistributionChart(amdpStats);
}

/**
 * Create AMDP time series chart
 * @param {Array} data - Array of yearly data
 */
function createAmdpTimeSeriesChart(data) {
    const ctx = document.getElementById('amdpChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (appState.charts.amdpChart) {
        appState.charts.amdpChart.destroy();
    }
    
    appState.charts.amdpChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.year),
            datasets: [{
                label: 'AMDP (mm)',
                data: data.map(d => d.amdp),
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Annual Maximum Daily Precipitation (AMDP) Time Series'
                },
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'AMDP (mm)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Year'
                    }
                }
            }
        }
    });
}

/**
 * Create precipitation chart
 * @param {Array} data - Array of yearly data
 */
function createPrecipitationChart(data) {
    const ctx = document.getElementById('precipChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (appState.charts.precipChart) {
        appState.charts.precipChart.destroy();
    }
    
    appState.charts.precipChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.year),
            datasets: [{
                label: 'Annual Precipitation (mm)',
                data: data.map(d => d.annualPrecip),
                backgroundColor: 'rgba(13, 202, 240, 0.6)',
                borderColor: '#0dcaf0',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Annual Precipitation'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Precipitation (mm)'
                    }
                }
            }
        }
    });
}

/**
 * Create climate variables chart
 * @param {Array} data - Array of yearly data
 */
function createClimateVariablesChart(data) {
    const ctx = document.getElementById('climateChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (appState.charts.climateChart) {
        appState.charts.climateChart.destroy();
    }
    
    appState.charts.climateChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.year),
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: data.map(d => d.avgTemp),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    yAxisID: 'y'
                },
                {
                    label: 'Humidity (%)',
                    data: data.map(d => d.avgHumidity),
                    borderColor: '#0dcaf0',
                    backgroundColor: 'rgba(13, 202, 240, 0.1)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Climate Variables Over Time'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

/**
 * Create AMDP distribution chart
 * @param {Object} amdpStats - AMDP statistics
 */
function createAmdpDistributionChart(amdpStats) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (appState.charts.distributionChart) {
        appState.charts.distributionChart.destroy();
    }
    
    // Create histogram bins
    const bins = 10;
    const min = amdpStats.min;
    const max = amdpStats.max;
    const binWidth = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    const labels = [];
    
    for (let i = 0; i < bins; i++) {
        labels.push(`${(min + i * binWidth).toFixed(0)}-${(min + (i + 1) * binWidth).toFixed(0)}`);
    }
    
    amdpStats.values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
        histogram[binIndex]++;
    });
    
    appState.charts.distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency',
                data: histogram,
                backgroundColor: 'rgba(25, 135, 84, 0.6)',
                borderColor: '#198754',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'AMDP Distribution'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'AMDP Range (mm)'
                    }
                }
            }
        }
    });
}

/**
 * Generate CSV content from analysis data
 * @param {Object} analysisData - Complete analysis data object
 * @returns {string} - CSV formatted string
 */
function generateCSVContent(analysisData) {
    let csv = 'Year,AMDP (mm),Annual Precipitation (mm),Temperature (°C),Humidity (%),Wind Speed (m/s)\n';
    
    analysisData.data.forEach(row => {
        csv += `${row.year},${row.amdp.toFixed(2)},${row.annualPrecip.toFixed(2)},${row.avgTemp.toFixed(2)},${row.avgHumidity.toFixed(2)},${row.avgWindSpeed.toFixed(2)}\n`;
    });
    
    csv += '\n\nSummary Statistics\n';
    csv += `Parameter,Value,Unit\n`;
    csv += `Location,"${analysisData.latitude.toFixed(4)}°, ${analysisData.longitude.toFixed(4)}°",-\n`;
    csv += `Mean AMDP,${analysisData.amdpStats.mean.toFixed(2)},mm\n`;
    csv += `Std Dev AMDP,${analysisData.amdpStats.stdDev.toFixed(2)},mm\n`;
    csv += `PMP,${analysisData.pmpData.value.toFixed(2)},mm\n`;
    csv += `Km,${analysisData.pmpData.km.toFixed(2)},-\n`;
    csv += `Climate Zone,${analysisData.climateZone},-\n`;
    csv += `Average Temperature,${analysisData.climateStats.avgTemp.toFixed(2)},°C\n`;
    csv += `Average Humidity,${analysisData.climateStats.avgHumidity.toFixed(2)},%\n`;
    csv += `Average Wind Speed,${analysisData.climateStats.avgWindSpeed.toFixed(2)},m/s\n`;
    
    return csv;
}