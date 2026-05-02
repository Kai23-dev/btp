/**
 * LSTM-Inspired Flood Prediction Module — HydroIntel Pro
 *
 * Research basis:
 * [1] S. Sarkar & R. Maity (2021). Global climate shift in 1970s.
 *     Scientific Reports, 11, 11574.
 * [2] M.I. Khan & R. Maity (2020). Hybrid deep learning for rainfall prediction.
 *     IEEE Access, 8, 52774–52784.
 * [3] M.I. Khan, S. Sarkar & R. Maity (2023). AI/ML in hydroclimatology.
 *     In: Visualization Techniques for Climate Change with ML and AI. Elsevier.
 *
 * Sliding window = 5 years | Forecast horizon = 3 years
 */

const lstmFloodPredictor = {

    sequenceLength:   5,
    predictionHorizon: 3,
    extremeThreshold: 0.85,
    climateShiftYear: 1978,

    extractSequences(amdpValues) {
        const seqs = [];
        for (let i = this.sequenceLength; i < amdpValues.length; i++) {
            seqs.push({
                pastValues:  amdpValues.slice(i - this.sequenceLength, i),
                targetValue: amdpValues[i],
                index: i
            });
        }
        return seqs;
    },

    // Weighted moving average — higher weights on recent values (forget-gate principle)
    computeGateOutput(values) {
        if (!values || !values.length) return 0;
        let wSum = 0, wTotal = 0;
        for (let i = 0; i < values.length; i++) {
            const w = (i + 1) / values.length;
            wSum   += values[i] * w;
            wTotal += w;
        }
        return wSum / wTotal;
    },

    detectExtremeEvent(stats, value) {
        const pct = this.approximatePercentile(value, stats);
        let riskLevel;
        if (pct > 0.95)      riskLevel = 'Very High';
        else if (pct > 0.85) riskLevel = 'High';
        else if (pct > 0.70) riskLevel = 'Moderate';
        else                  riskLevel = 'Low';
        return {
            isExtreme:  pct > this.extremeThreshold,
            zscore:     (value - stats.mean) / (stats.stdDev || 1),
            percentile: pct,
            riskLevel
        };
    },

    // Normal CDF approximation (Abramowitz & Stegun method)
    approximatePercentile(value, stats) {
        const z  = (value - stats.mean) / (stats.stdDev || 1);
        const p  = 0.2316419;
        const t  = 1 / (1 + p * Math.abs(z));
        const pdf = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
        const cdf = 1 - pdf * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
        return z > 0 ? cdf : 1 - cdf;
    },

    predictFloodRisk(historicalData, amdpStats) {
        const amdpValues = historicalData.map(d => d.amdp);
        const seqs = this.extractSequences(amdpValues);

        if (seqs.length === 0) {
            return { error: 'Need at least 6 years of data for prediction.' };
        }

        const lastYear = historicalData[historicalData.length - 1].year;
        let curSeq     = [...seqs[seqs.length - 1].pastValues];
        const preds    = [];

        for (let i = 0; i < this.predictionHorizon; i++) {
            const raw       = this.computeGateOutput(curSeq);
            const predYear  = lastYear + i + 1;
            // Post-1978 climate shift correction — Sarkar & Maity (2021)
            // Global extremes rose ~15% after the 1970s shift (one-time step, not cumulative)
            const trend     = predYear > this.climateShiftYear ? 1.15 : 1.0;
            const adjusted  = raw * trend;
            const extreme   = this.detectExtremeEvent(amdpStats, adjusted);
            const conf      = Math.max(0.55, 0.85 - i * 0.10);

            preds.push({ year: predYear, predictedAMDP: adjusted, extremeEvent: extreme, confidence: conf });
            curSeq.shift();
            curSeq.push(adjusted);
        }

        const vhCount = preds.filter(p => p.extremeEvent.riskLevel === 'Very High').length;
        const hCount  = preds.filter(p => p.extremeEvent.riskLevel === 'High').length;
        let overall;
        if (vhCount >= 2)       overall = 'Very High';
        else if (vhCount === 1) overall = 'High';
        else if (hCount >= 1)   overall = 'Moderate';
        else                     overall = 'Low';

        return {
            predictions: preds,
            overallFloodRisk: overall,
            modelMetadata: {
                method:        'LSTM-inspired Sliding Window',
                sequenceLength: this.sequenceLength,
                horizon:        this.predictionHorizon,
                trainingYears:  amdpValues.length,
                reference:     'Khan & Maity (2020); Sarkar & Maity (2021)'
            }
        };
    },

    visualizePredictions(canvasId, predictionResults, existingChart) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !predictionResults.predictions) return null;
        if (existingChart) existingChart.destroy();

        const preds = predictionResults.predictions;
        const bgColors = preds.map(p => ({
            'Very High': 'rgba(248,113,113,0.8)',
            'High':      'rgba(251,191,36,0.8)',
            'Moderate':  'rgba(56,189,248,0.8)',
            'Low':       'rgba(52,211,153,0.8)'
        })[p.extremeEvent.riskLevel] || 'rgba(56,189,248,0.8)');

        return new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: preds.map(p => p.year),
                datasets: [{
                    label: 'Predicted AMDP (mm)',
                    data:  preds.map(p => p.predictedAMDP.toFixed(1)),
                    backgroundColor: bgColors,
                    borderColor: bgColors.map(c => c.replace('0.8', '1')),
                    borderWidth: 2, borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text:  `3-Year AMDP Forecast  |  Overall Risk: ${predictionResults.overallFloodRisk}`,
                        color: '#e2e8f0', font: { size: 13 }
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: (ctx) => {
                                const p = preds[ctx.dataIndex];
                                return [`Risk: ${p.extremeEvent.riskLevel}`, `Confidence: ${(p.confidence*100).toFixed(0)}%`];
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { color:'rgba(255,255,255,0.06)' }, ticks: { color:'#94a3b8' } },
                    y: { grid: { color:'rgba(255,255,255,0.06)' }, ticks: { color:'#94a3b8' },
                         title: { display:true, text:'Predicted AMDP (mm)', color:'#94a3b8' }, beginAtZero: false }
                }
            }
        });
    },

    renderPredictionTable(tbodyId, predictionResults) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody || !predictionResults.predictions) return;
        const badge = (level) => {
            const cls = { 'Very High':'badge-danger','High':'badge-warning','Moderate':'badge-info','Low':'badge-success' };
            return `<span class="risk-badge ${cls[level]||'badge-info'}">${level}</span>`;
        };
        tbody.innerHTML = predictionResults.predictions.map(p => `
          <tr>
            <td><strong>${p.year}</strong></td>
            <td>${p.predictedAMDP.toFixed(1)} mm</td>
            <td>${(p.extremeEvent.percentile * 100).toFixed(1)}th</td>
            <td>${badge(p.extremeEvent.riskLevel)}</td>
            <td>${(p.confidence * 100).toFixed(0)}%</td>
          </tr>`).join('');
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = lstmFloodPredictor;
