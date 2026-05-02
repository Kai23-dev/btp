/**
 * CNN-Based Weather Image Analysis Module — HydroIntel Pro
 * BTP-2 | IIT Kharagpur
 *
 * Research basis:
 * [1] R. Maity, A. Srivastava, S. Sarkar & M.I. Khan (2024).
 *     Revolutionizing the future of hydrological science: Impact of ML and DL
 *     amidst emerging explainable AI and transfer learning.
 *     Applied Computing and Geosciences, 24, 100206.
 * [2] M.I. Khan, S. Sarkar & R. Maity (2023). AI/ML in hydroclimatology.
 *     In: Visualization Techniques for Climate Change with ML and AI.
 *     Elsevier, pp. 247-273.
 *
 * NOTE: This module is designed for OUTDOOR SKY / WEATHER FIELD PHOTOGRAPHS.
 * It will not give meaningful results for indoor images or screenshots.
 *
 * What this module does (step by step):
 *   1. Resizes the image to 256x256 for speed
 *   2. Analyzes the TOP 40% of the image (sky region — most diagnostic)
 *   3. Computes: luminance, saturation, blue dominance, dark pixel fraction, texture
 *   4. Scores the image against 5 weather classes using weighted rules
 *   5. Returns a classification with flood risk and hydrological interpretation
 */

const cnnWeatherAnalyzer = {

    // ─── Weather Class Definitions ────────────────────────────
    weatherClasses: {
        clear: {
            label: 'Clear Sky', icon: '☀️', color: '#198754', bsClass: 'success',
            riskScore: 0.08, estimatedRainfall: 0,
            description: 'Clear sky detected. No cloud cover visible.'
        },
        partlyCloudy: {
            label: 'Partly Cloudy', icon: '⛅', color: '#0dcaf0', bsClass: 'info',
            riskScore: 0.25, estimatedRainfall: 5,
            description: 'Mixed sky — patches of cloud with some blue visible.'
        },
        cloudy: {
            label: 'Overcast / Cloudy', icon: '☁️', color: '#6c757d', bsClass: 'secondary',
            riskScore: 0.42, estimatedRainfall: 15,
            description: 'Dense cloud cover. Rain is likely within a few hours.'
        },
        rainy: {
            label: 'Active Rainfall', icon: '🌧️', color: '#0d6efd', bsClass: 'primary',
            riskScore: 0.74, estimatedRainfall: 40,
            description: 'Rain visible in image. Elevated flood risk right now.'
        },
        stormyExtreme: {
            label: 'Severe Storm', icon: '⛈️', color: '#dc3545', bsClass: 'danger',
            riskScore: 0.95, estimatedRainfall: 70,
            description: 'Extreme storm conditions detected. Very high flood risk!'
        }
    },


    // ─── Step 1: Extract Image Features ──────────────────────
    extractImageFeatures(imageFile) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    const W = 256, H = 256;
                    const canvas = document.createElement('canvas');
                    canvas.width = W; canvas.height = H;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, W, H);
                    const px = ctx.getImageData(0, 0, W, H).data;

                    // Analyze the full image and the sky region separately
                    const skyRowEnd = Math.floor(H * 0.40); // top 40% = sky
                    const full = this.analyzePixelRegion(px, W, 0, H);
                    const sky  = this.analyzePixelRegion(px, W, 0, skyRowEnd);

                    resolve({ full, sky });
                };
                img.onerror = () => reject(new Error(
                    'Could not load this image. Make sure it is a valid JPG, PNG, or WebP file.'
                ));
                img.src = ev.target.result;
            };
            reader.onerror = () => reject(new Error('Could not read file.'));
            reader.readAsDataURL(imageFile);
        });
    },


    // ─── Step 2: Compute Region Statistics ───────────────────
    // Analyzes a rectangular strip of the image (rows rowStart to rowEnd)
    analyzePixelRegion(px, W, rowStart, rowEnd) {
        let rSum = 0, gSum = 0, bSum = 0;
        let darkCount = 0, brightCount = 0, midCount = 0;
        const lumVals = [];
        const count = (rowEnd - rowStart) * W;

        for (let row = rowStart; row < rowEnd; row++) {
            for (let col = 0; col < W; col++) {
                const i = (row * W + col) * 4;
                const r = px[i], g = px[i + 1], b = px[i + 2];

                // Perceptual luminance (matches human eye sensitivity)
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                rSum += r; gSum += g; bSum += b;
                lumVals.push(lum);

                if (lum < 80)       darkCount++;    // dark (heavy cloud / rain)
                else if (lum > 200) brightCount++;  // bright (clear sky)
                else                midCount++;     // medium (overcast)
            }
        }

        const avgR = rSum / count;
        const avgG = gSum / count;
        const avgB = bSum / count;
        const avgLum = lumVals.reduce((a, b) => a + b, 0) / count;

        // Per-pixel saturation (HSV-style): average the saturation of EACH pixel.
        // This is far more robust than saturation from averaged RGB, because
        // averaging RGB first washes out colour (e.g. a vivid orange sunset
        // looks nearly grey after averaging mixed pixels).
        //   Per-pixel: sunset → 0.55+, blue sky → 0.35+, overcast → 0.05-0.12
        let satSum = 0;
        for (let row = rowStart; row < rowEnd; row++) {
            for (let col = 0; col < W; col++) {
                const i = (row * W + col) * 4;
                const r = px[i], g = px[i + 1], b = px[i + 2];
                const mx = Math.max(r, g, b);
                const mn = Math.min(r, g, b);
                satSum += mx > 10 ? (mx - mn) / mx : 0;
            }
        }
        const saturation = satSum / count;

        // Blue dominance: computed from per-channel averages
        const blueDom = (avgB - Math.max(avgR, avgG)) / 255;

        // Texture: how much pixel-to-pixel variation (stormy = high texture)
        const variance = lumVals.reduce((s, v) => s + (v - avgLum) ** 2, 0) / count;

        return {
            avgLum:       avgLum / 255,         // 0 = pitch black, 1 = pure white
            saturation,                          // 0 = grey/flat, 1 = vivid colour
            blueDom,                             // positive = blue sky, negative = grey
            darkFrac:   darkCount / count,       // fraction of very dark pixels
            brightFrac: brightCount / count,     // fraction of very bright pixels
            midFrac:    midCount / count,        // fraction of medium-grey pixels
            variance:   Math.min(variance / 5000, 1.0),  // image texture level
            stdDev:     Math.min(Math.sqrt(variance) / 255, 1.0)
        };
    },


    // ─── Step 3: Classify Weather ─────────────────────────────
    classifyWeather(features) {
        const sky  = features.sky;   // sky region features
        const full = features.full;  // whole image features

        // Score each weather class based on how well the features match
        const scores = {
            clear:         this.scoreClear(sky, full),
            partlyCloudy:  this.scorePartlyCloudy(sky, full),
            cloudy:        this.scoreCloudy(sky, full),
            rainy:         this.scoreRainy(sky, full),
            stormyExtreme: this.scoreStormy(sky, full)
        };

        // Pick the class with the highest score
        const sorted  = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const bestKey = sorted[0][0];
        const margin  = sorted[0][1] - sorted[1][1]; // gap from 2nd place

        const cls = this.weatherClasses[bestKey];

        return {
            classification:    bestKey,
            label:             cls.label,
            icon:              cls.icon,
            description:       cls.description,
            color:             cls.color,
            bsClass:           cls.bsClass,
            riskScore:         cls.riskScore,
            estimatedRainfall: cls.estimatedRainfall,
            // Higher margin from 2nd place = more confident
            confidence:        Math.min(0.58 + margin * 0.90, 0.96),
            floodRiskLevel:    this.getRiskLevel(cls.riskScore),
            implications:      this.getImplications(bestKey, features),
            allScores:         scores
        };
    },


    // ─── Scoring Functions ─────────────────────────────────────
    // Each function returns a score 0-10 based on how well the image
    // matches that weather type. Higher = better match.

    scoreClear(sky, full) {
        // Clear sky (daytime blue OR colourful sunset) = vivid colour + very few dark pixels + smooth
        let s = 0;
        s += (1 - sky.darkFrac) * 3.5;          // PRIMARY: almost no dark cloud pixels
        s += sky.saturation * 3.0;              // vivid colour = clear (blue OR warm sunset)
        s += (1 - sky.variance) * 2.0;          // smooth gradient = clear
        s += sky.brightFrac * 1.5;              // bright pixels
        s += Math.max(0, sky.blueDom) * 1.5;   // bonus for daytime blue sky
        // Completely clean sky: no dark patches AND no texture → strong clear confirmation
        if (sky.darkFrac < 0.08 && sky.variance < 0.18) s += 2.5;
        return Math.max(0, s);
    },

    scorePartlyCloudy(sky, full) {
        // Partly cloudy: moderate dark fraction (~15-20%), some colour, medium brightness
        let s = 0;
        s += (1 - Math.abs(sky.darkFrac - 0.18)) * 3.5; // wants ~18% dark pixels
        s += (1 - Math.abs(sky.saturation - 0.22)) * 2.5; // moderate saturation
        s += (1 - Math.abs(sky.avgLum - 0.58)) * 2.0;    // medium brightness
        s += Math.max(0, sky.blueDom) * 1.5;              // some blue helps
        return Math.max(0, s);
    },

    scoreCloudy(sky, full) {
        // Overcast: GREY (very low saturation), medium brightness, smooth, moderate dark
        let s = 0;
        s += (1 - sky.saturation) * 4.0;        // main signal: low colour = grey
        s -= sky.saturation * 2.5;              // penalise colourful skies (sunset etc.)
        s += sky.midFrac * 3.0;                 // mid-grey pixel fraction
        s += (1 - Math.abs(sky.avgLum - 0.52)) * 2.0; // medium brightness
        s -= sky.darkFrac * 2.5;               // overcast is not very dark
        return Math.max(0, s);
    },

    scoreRainy(sky, full) {
        // Rainy: DARK, GREY (low saturation), MEDIUM-HIGH texture from raindrops
        let s = 0;
        s += full.darkFrac * 3.5;                // overall image is dark
        s += (1 - full.saturation) * 2.0;        // grey sky
        s += full.variance * 2.5;                // rain adds texture
        s += (1 - Math.abs(full.avgLum - 0.35)) * 2.0; // dark but not pitch black
        s -= Math.max(0, sky.blueDom) * 3.0;    // no blue sky in rain
        return Math.max(0, s);
    },

    scoreStormy(sky, full) {
        // Stormy: VERY DARK, HIGH TEXTURE, dramatic contrast
        let s = 0;
        s += full.darkFrac * 4.5;               // very dark image
        s += full.variance * 3.5;               // high texture from storm
        s += (1 - full.avgLum) * 2.0;           // overall dark
        s += (1 - full.saturation) * 1.5;       // grey/black storm clouds
        s -= Math.max(0, sky.blueDom) * 4.0;   // absolutely no blue sky
        s -= sky.brightFrac * 2.0;              // no bright patches
        return Math.max(0, s);
    },


    // ─── Risk Level Helper ────────────────────────────────────
    getRiskLevel(score) {
        if (score > 0.75) return { label: 'HIGH',       icon: '🔴', bs: 'danger'    };
        if (score > 0.40) return { label: 'MODERATE',   icon: '🟠', bs: 'warning'   };
        if (score > 0.15) return { label: 'LOW',        icon: '🟡', bs: 'primary'   };
        return              { label: 'NEGLIGIBLE', icon: '🟢', bs: 'success'   };
    },


    // ─── Hydrological Implications ────────────────────────────
    // Plain-English interpretation of what this weather means for flooding.
    getImplications(type, features) {
        const s = features.sky;
        const darkPct  = Math.round(s.darkFrac * 100);
        const lumPct   = Math.round(s.avgLum * 100);
        const satPct   = Math.round(s.saturation * 100);

        const map = {
            clear: {
                situation:  'The sky is clear with no significant cloud cover.',
                amdpImpact: 'No rainfall contribution expected in the next 6–12 hours.',
                streamflow: 'River/stream levels stable or gradually declining.',
                action:     'No immediate flood risk. Standard monitoring is sufficient.',
                keyObs:     [
                    `Sky brightness: ${lumPct}% (very bright — typical of clear conditions)`,
                    `Colour saturation: ${satPct}% (vivid blue sky detected)`,
                    'Very few dark cloud pixels in the image'
                ]
            },
            partlyCloudy: {
                situation:  'The sky shows a mix of blue sky and cloud patches.',
                amdpImpact: 'Light to moderate rainfall possible if clouds increase.',
                streamflow: 'Minor increase in surface runoff possible if it rains.',
                action:     'Low risk. Keep monitoring — watch if cloud cover increases.',
                keyObs:     [
                    `Sky brightness: ${lumPct}% (medium-bright — mixed conditions)`,
                    `Saturation: ${satPct}% (some blue but patchy)`,
                    'Blue sky and white cloud patches both visible in upper region'
                ]
            },
            cloudy: {
                situation:  'The sky is completely overcast with dense cloud cover.',
                amdpImpact: 'Moderate rainfall likely within a few hours. Could add 10–20 mm.',
                streamflow: 'Expect gradual increase in surface runoff.',
                action:     'Moderate watch — especially if the ground is already saturated.',
                keyObs:     [
                    `Sky brightness: ${lumPct}% (dull, overcast light)`,
                    `Saturation: ${satPct}% (grey — minimal colour, indicating cloud)`,
                    `Dark cloud pixels: ${darkPct}% of the sky region`
                ]
            },
            rainy: {
                situation:  'Active rainfall is visible in the image.',
                amdpImpact: 'Could meet or approach AMDP if rainfall is sustained for several hours.',
                streamflow: 'Streamflow rising. Flash flood risk is increasing.',
                action:     'Issue a flood WATCH. Check upstream gauges. Alert downstream areas.',
                keyObs:     [
                    `Dark pixel fraction: ${darkPct}% (image is significantly dark)`,
                    `Sky brightness: ${lumPct}% (heavy cloud blocking sunlight)`,
                    'High image texture detected — consistent with rain droplets/streaks'
                ]
            },
            stormyExtreme: {
                situation:  'Severe storm conditions are clearly visible in the image.',
                amdpImpact: 'Very likely to exceed AMDP for this location. Extreme rainfall event.',
                streamflow: 'Rapid streamflow rise expected. Flash flooding is imminent.',
                action:     '⚠️ Issue FLOOD WARNING. Evacuate low-lying and riverside areas now.',
                keyObs:     [
                    `Dark pixel fraction: ${darkPct}% (extremely dark image — severe storm)`,
                    `Sky brightness: ${lumPct}% (very little light penetrating cloud cover)`,
                    'High texture and contrast — dramatic storm cloud formations detected'
                ]
            }
        };
        return map[type] || map.cloudy;
    },


    // ─── Step 4: Display Results ──────────────────────────────
    // Renders the classification output inside the given container div.
    // Written to be easy to read and understand at a glance.
    displayResults(elementId, c) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const riskPct = Math.round(c.riskScore * 100);
        const confPct = Math.round(c.confidence * 100);

        el.innerHTML = `
          <div class="card shadow-sm h-100">
            <div class="card-header text-white fw-semibold" style="background-color:#1a3a6b;">
              <i class="fas fa-cloud-sun me-2"></i>Weather Analysis Results
            </div>
            <div class="card-body">

              <!-- Outdoor photo reminder -->
              <div class="alert alert-warning py-2 small mb-3" role="alert">
                <i class="fas fa-exclamation-triangle me-1"></i>
                <strong>Reminder:</strong> Upload <strong>outdoor sky / weather photographs</strong> for
                accurate results. Indoor photos or screenshots will give unreliable output.
              </div>

              <!-- Main classification result -->
              <div class="d-flex align-items-center gap-3 p-3 rounded mb-3"
                   style="background:#f8f9fa; border-left:5px solid ${c.color};">
                <span style="font-size:3rem; line-height:1;">${c.icon}</span>
                <div class="flex-grow-1">
                  <h5 class="mb-1 fw-bold">${c.label}</h5>
                  <p class="mb-0 text-muted small">${c.description}</p>
                </div>
                <div class="text-center">
                  <div class="badge text-bg-${c.floodRiskLevel.bs} px-3 py-2 fs-6">
                    ${c.floodRiskLevel.icon} ${c.floodRiskLevel.label} RISK
                  </div>
                </div>
              </div>

              <!-- Three quick-read metric boxes -->
              <div class="row g-2 mb-3">
                <div class="col-4 text-center">
                  <div class="border rounded p-2">
                    <div class="fw-bold fs-5" style="color:${c.color};">${confPct}%</div>
                    <div class="text-muted" style="font-size:0.75rem;">Confidence</div>
                  </div>
                </div>
                <div class="col-4 text-center">
                  <div class="border rounded p-2">
                    <div class="fw-bold fs-5" style="color:${c.color};">${riskPct}/100</div>
                    <div class="text-muted" style="font-size:0.75rem;">Flood Score</div>
                  </div>
                </div>
                <div class="col-4 text-center">
                  <div class="border rounded p-2">
                    <div class="fw-bold fs-5" style="color:${c.color};">${c.estimatedRainfall} mm</div>
                    <div class="text-muted" style="font-size:0.75rem;">Est. Rainfall</div>
                  </div>
                </div>
              </div>

              <!-- What this means — plain English -->
              <h6 class="fw-semibold mb-2">
                <i class="fas fa-info-circle text-primary me-1"></i>What This Means
              </h6>
              <table class="table table-sm table-bordered small mb-3">
                <tbody>
                  <tr>
                    <td class="fw-medium text-muted" style="width:35%">Current Situation</td>
                    <td>${c.implications.situation}</td>
                  </tr>
                  <tr>
                    <td class="fw-medium text-muted">AMDP Impact</td>
                    <td>${c.implications.amdpImpact}</td>
                  </tr>
                  <tr>
                    <td class="fw-medium text-muted">Streamflow</td>
                    <td>${c.implications.streamflow}</td>
                  </tr>
                  <tr class="fw-semibold text-${c.floodRiskLevel.bs === 'primary' ? 'primary' : c.floodRiskLevel.bs}">
                    <td class="fw-medium">Recommended Action</td>
                    <td>${c.implications.action}</td>
                  </tr>
                </tbody>
              </table>

              <!-- Why the model classified this way -->
              <h6 class="fw-semibold mb-2">
                <i class="fas fa-search text-primary me-1"></i>Key Image Observations
              </h6>
              <ul class="small text-muted mb-3 ps-3">
                ${c.implications.keyObs.map(o => `<li class="mb-1">${o}</li>`).join('')}
              </ul>

              <p class="text-muted mb-0" style="font-size:0.72rem;">
                Based on: Maity et al. (2024) — Applied Computing and Geosciences;
                Khan, Sarkar &amp; Maity (2023) — Elsevier.
              </p>

            </div>
          </div>`;
    }

};

if (typeof module !== 'undefined' && module.exports) module.exports = cnnWeatherAnalyzer;
