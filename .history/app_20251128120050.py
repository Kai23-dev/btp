from flask import Flask, render_template, request, jsonify
import requests
from math import sqrt

app = Flask(__name__)


def calculate_mean(values):
    if not values:
        return 0
    return sum(values) / len(values)


def calculate_std(values):
    n = len(values)
    if n < 2:
        return 0
    mean = calculate_mean(values)
    squared = [(v - mean) ** 2 for v in values]
    variance = sum(squared) / (n - 1)
    return sqrt(variance)


def calculate_trend(values):
    n = len(values)
    if n < 2:
        return 0
    x = list(range(n))
    x_mean = calculate_mean(x)
    y_mean = calculate_mean(values)
    num = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    den = sum((x[i] - x_mean) ** 2 for i in range(n))
    return num / den if den != 0 else 0


def process_yearly_data(daily, year):
    time = daily.get('time', [])
    precipitation_sum = daily.get('precipitation_sum', [])
    temp_max = daily.get('temperature_2m_max', [])
    temp_min = daily.get('temperature_2m_min', [])
    temp_mean = daily.get('temperature_2m_mean', [])
    wind_max = daily.get('windspeed_10m_max', [])

    valid_precip = [v for v in precipitation_sum if v is not None and v >= 0]
    valid_tmax = [v for v in temp_max if v is not None]
    valid_tmin = [v for v in temp_min if v is not None]
    valid_tmean = [v for v in temp_mean if v is not None]
    valid_wind = [v for v in wind_max if v is not None]

    if not valid_precip:
        return None

    amdp = max(valid_precip)
    total_precip = sum(valid_precip)
    avg_temp = calculate_mean(valid_tmean) if valid_tmean else None
    max_temp = max(valid_tmax) if valid_tmax else None
    min_temp = min(valid_tmin) if valid_tmin else None
    avg_wind = calculate_mean(valid_wind) if valid_wind else None

    return {
        'year': int(year),
        'amdp': amdp,
        'totalPrecip': total_precip,
        'avgTemp': avg_temp,
        'maxTemp': max_temp,
        'minTemp': min_temp,
        'avgWind': avg_wind,
        'dataPoints': len(valid_precip)
    }


def calculate_pmp_with_eva(amdp_values):
    # basic stats
    mean = calculate_mean(amdp_values)
    std = calculate_std(amdp_values)

    # maximum observed AMDP
    Xmax = max(amdp_values)

    # remove only one occurrence of Xmax to handle duplicates
    rest = amdp_values.copy()
    try:
        rest.remove(Xmax)
    except ValueError:
        rest = amdp_values[:]

    # small epsilon to avoid division by zero
    eps = 1e-6

    if rest:
        Xmean = calculate_mean(rest)
        S = max(calculate_std(rest), eps)
    else:
        Xmean = mean
        S = max(std, eps)

    # two candidate frequency factors for robustness
    km_a = (Xmax - Xmean) / S
    km_b = (Xmax - mean) / max(std, eps)

    # pick a location-sensitive conservative factor
    frequency_factor_raw = max(km_a, km_b)

    # sensible bounds (allow variation by location)
    frequency_factor = max(1.0, min(25.0, frequency_factor_raw))
    frequency_factor = float(round(frequency_factor, 2))

    # PMP heuristic
    pmp = mean + frequency_factor * std

    # simple CI using standard error (pragmatic approximation)
    n = len(amdp_values)
    standard_error = std / (sqrt(n) if n > 0 else 1)
    confidence_interval = {
        'lower': pmp - 1.96 * standard_error,
        'upper': pmp + 1.96 * standard_error
    }

    return {'pmp': pmp, 'frequencyFactor': frequency_factor, 'confidenceInterval': confidence_interval}

def calculate_hydrological_parameters(annual_data, climate_factor):
    amdp_values = [d['amdp'] for d in annual_data]
    total_precip_vals = [d['totalPrecip'] for d in annual_data]

    mean_amdp = calculate_mean(amdp_values)
    std_amdp = calculate_std(amdp_values)
    mean_annual_precip = calculate_mean(total_precip_vals)

    eva_results = calculate_pmp_with_eva(amdp_values)

    adjusted_pmp = eva_results['pmp'] * (1 + climate_factor) if climate_factor > 0 else eva_results['pmp']

    trend = calculate_trend(amdp_values)
    variability = (std_amdp / mean_amdp) * 100 if mean_amdp != 0 else 0

    return {
        'meanAMDP': mean_amdp,
        'stdAMDP': std_amdp,
        'meanAnnualPrecip': mean_annual_precip,
        'pmp': adjusted_pmp,
        'pmpUnadjusted': eva_results['pmp'],
        'frequencyFactor': eva_results['frequencyFactor'],
        'climateAdjustment': climate_factor,
        'trend': trend,
        'variability': variability,
        'dataPoints': len(annual_data),
        'yearsCovered': len(annual_data),
        'confidenceInterval': eva_results['confidenceInterval']
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/analyze', methods=['POST'])
def analyze():
    payload = request.get_json() or {}
    lat = payload.get('lat')
    lon = payload.get('lon')
    start_year = int(payload.get('startYear'))
    end_year = int(payload.get('endYear'))
    climate_factor = float(payload.get('climateFactor', 0))

    annual_data = []

    for year in range(start_year, end_year + 1):
        try:
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            url = (
                "https://archive-api.open-meteo.com/v1/archive?"
                f"latitude={lat}&longitude={lon}&"
                f"start_date={start_date}&end_date={end_date}&"
                "daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,windspeed_10m_max&"
                "timezone=auto"
            )
            resp = requests.get(url, timeout=30)
            if resp.status_code != 200:
                continue
            data = resp.json()
            if not data.get('daily'):
                continue
            year_data = process_yearly_data(data['daily'], year)
            if year_data:
                annual_data.append(year_data)
        except Exception:
            continue

    annual_data = sorted(annual_data, key=lambda x: x['year'])

    if not annual_data:
        return jsonify({'error': 'No valid data received for the selected location and time period', 'annualData': []}), 400

    analysis_results = calculate_hydrological_parameters(annual_data, climate_factor)

    return jsonify({'annualData': annual_data, 'analysisResults': analysis_results})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
