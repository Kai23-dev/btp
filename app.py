from flask import Flask, render_template, request, jsonify
import requests
from math import sqrt
from scipy.stats import ttest_ind
from datetime import datetime

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

from datetime import datetime
from collections import defaultdict

def fetch_yearly_data(lat, lon, start_year, end_year):
    start_date = f"{start_year}-01-01"
    end_date = f"{end_year}-12-31"
    
    url = (
        "https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lon}&"
        f"start_date={start_date}&end_date={end_date}&"
        "daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,windspeed_10m_max&"
        "timezone=auto"
    )
    
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code != 200:
            return None
            
        data = resp.json()
        if not data.get('daily'):
            return None
            
        return process_multi_year_data(data['daily'])
    except Exception as e:
        print("Error fetching data:", e)
        return None

def process_multi_year_data(daily):
    time_arr = daily.get('time', [])
    precip_arr = daily.get('precipitation_sum', [])
    tmax_arr = daily.get('temperature_2m_max', [])
    tmin_arr = daily.get('temperature_2m_min', [])
    tmean_arr = daily.get('temperature_2m_mean', [])
    wind_arr = daily.get('windspeed_10m_max', [])
    
    # Group by year
    yearly_groups = defaultdict(lambda: {
        'precip': [], 'tmax': [], 'tmin': [], 'tmean': [], 'wind': []
    })
    
    for i in range(len(time_arr)):
        year = int(time_arr[i][:4])
        
        # Only add valid values
        if precip_arr[i] is not None and precip_arr[i] >= 0:
            yearly_groups[year]['precip'].append(precip_arr[i])
        if tmax_arr[i] is not None:
            yearly_groups[year]['tmax'].append(tmax_arr[i])
        if tmin_arr[i] is not None:
            yearly_groups[year]['tmin'].append(tmin_arr[i])
        if tmean_arr[i] is not None:
            yearly_groups[year]['tmean'].append(tmean_arr[i])
        if wind_arr[i] is not None:
            yearly_groups[year]['wind'].append(wind_arr[i])
            
    annual_data = []
    for year in sorted(yearly_groups.keys()):
        group = yearly_groups[year]
        if not group['precip']:
            continue
            
        annual_data.append({
            'year': year,
            'amdp': max(group['precip']),
            'totalPrecip': sum(group['precip']),
            'avgTemp': calculate_mean(group['tmean']) if group['tmean'] else None,
            'maxTemp': max(group['tmax']) if group['tmax'] else None,
            'minTemp': min(group['tmin']) if group['tmin'] else None,
            'avgWind': calculate_mean(group['wind']) if group['wind'] else None,
            'dataPoints': len(group['precip'])
        })
        
    return annual_data


# Removed unused process_yearly_data


def calculate_local_hershfield_km(amdp_values):
    # Calculate station-specific local Hershfield Km using an empirical envelope
    mean = calculate_mean(amdp_values)
    
    # In academic literature (e.g., Hershfield 1965, Sarkar & Maity 2020), Km is an envelope curve 
    # that decreases exponentially as the mean AMDP increases. 
    # This prevents Km from collapsing to the station's raw observed maximum, 
    # providing a true theoretical upper limit for PMP.
    # We use a standard exponential decay bounded between 5 and 20.
    
    import math
    km_envelope = 5.0 + 15.0 * math.exp(-0.015 * mean)
    
    return max(5.0, min(20.0, km_envelope))




def calculate_hydrological_parameters(full_data, selected_data, climate_factor):
    # PMP is calculated on the full historical record using localized Hershfield method
    pmp_amdp_values = [d['amdp'] for d in full_data]
    mean_pmp_amdp = calculate_mean(pmp_amdp_values)
    std_pmp_amdp = calculate_std(pmp_amdp_values)

    frequency_factor = calculate_local_hershfield_km(pmp_amdp_values)
    pmp = mean_pmp_amdp + frequency_factor * std_pmp_amdp
    
    # Fix the percentage multiplier bug (climate_factor is passed as a whole number, e.g., 7 for 7%)
    adjusted_pmp = pmp * (1 + (climate_factor / 100)) if climate_factor > 0 else pmp

    # Analysis metrics are calculated on the user's selected period
    sel_amdp_values = [d['amdp'] for d in selected_data]
    sel_total_precip_vals = [d['totalPrecip'] for d in selected_data]

    mean_amdp = calculate_mean(sel_amdp_values)
    std_amdp = calculate_std(sel_amdp_values)
    mean_annual_precip = calculate_mean(sel_total_precip_vals)

    # 1978 Climate Shift Validation (Sarkar & Maity, 2021)
    pre_1978 = [d['amdp'] for d in full_data if d['year'] < 1978]
    post_1978 = [d['amdp'] for d in full_data if d['year'] >= 1978]
    
    pre_1978_mean = calculate_mean(pre_1978) if pre_1978 else 0
    post_1978_mean = calculate_mean(post_1978) if post_1978 else 0
    
    shift_percentage = 0
    p_value = None
    if pre_1978_mean > 0 and len(pre_1978) > 1 and len(post_1978) > 1:
        shift_percentage = ((post_1978_mean - pre_1978_mean) / pre_1978_mean) * 100
        # Perform Welch's t-test (assuming unequal variances)
        t_stat, p_val = ttest_ind(pre_1978, post_1978, equal_var=False)
        p_value = p_val

    trend = calculate_trend(sel_amdp_values)
    variability = (std_amdp / mean_amdp) * 100 if mean_amdp != 0 else 0

    warning = None
    if len(selected_data) < 15:
        warning = 'Warning: less than 15 years of data selected for analysis.'

    return {
        'meanPmpAMDP': mean_pmp_amdp,
        'stdPmpAMDP': std_pmp_amdp,
        'meanAMDP': mean_amdp,
        'stdAMDP': std_amdp,
        'meanAnnualPrecip': mean_annual_precip,
        'pmp': adjusted_pmp,
        'pmpUnadjusted': pmp,
        'frequencyFactor': frequency_factor,
        'climateAdjustment': climate_factor,
        'trend': trend,
        'variability': variability,
        'pre1978Mean': pre_1978_mean,
        'post1978Mean': post_1978_mean,
        'shiftPercentage': shift_percentage,
        'pValue': p_value,
        'dataPoints': len(selected_data),
        'yearsCovered': len(full_data),
        'confidenceInterval': {
            'lower': adjusted_pmp - 1.96 * (std_amdp / (sqrt(len(sel_amdp_values)) if len(sel_amdp_values) > 0 else 1)),
            'upper': adjusted_pmp + 1.96 * (std_amdp / (sqrt(len(sel_amdp_values)) if len(sel_amdp_values) > 0 else 1))
        },
        'yearWarning': warning
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

    # Fetch full record for PMP (1950 to present) to capture the 1970s climate shift
    current_year = datetime.now().year
    full_data = fetch_yearly_data(lat, lon, 1950, current_year - 1)
    
    if not full_data:
        return jsonify({'error': 'Failed to fetch live data from Open-Meteo. Please try again or check your internet connection.'}), 500

    # Extract the user's selected period for charts
    selected_data = [d for d in full_data if start_year <= d['year'] <= end_year]
    
    if not selected_data:
        return jsonify({'error': 'No data available for the requested specific years', 'annualData': []}), 500

    analysis_results = calculate_hydrological_parameters(full_data, selected_data, climate_factor)

    return jsonify({'annualData': selected_data, 'fullData': full_data, 'analysisResults': analysis_results})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
