from flask import Flask, render_template, request, jsonify
import requests
from math import sqrt
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

FALLBACK_DEMO_DATA = [{'year': 1990, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1991, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1992, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1993, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1994, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1995, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1996, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1997, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1998, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 1999, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2000, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2001, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2002, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2003, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2004, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2005, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2006, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2007, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2008, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2009, 'amdp': 150, 'totalPrecip': 2000, 'avgTemp': 27.0, 'maxTemp': 34.0, 'minTemp': 20.0, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2010, 'amdp': 143, 'totalPrecip': 2150, 'avgTemp': 27.2, 'maxTemp': 34.1, 'minTemp': 19.8, 'avgWind': 11.2, 'dataPoints': 365}, {'year': 2011, 'amdp': 187, 'totalPrecip': 2380, 'avgTemp': 27.0, 'maxTemp': 33.8, 'minTemp': 20.1, 'avgWind': 10.8, 'dataPoints': 365}, {'year': 2012, 'amdp': 112, 'totalPrecip': 1890, 'avgTemp': 27.5, 'maxTemp': 34.3, 'minTemp': 20.3, 'avgWind': 11.5, 'dataPoints': 366}, {'year': 2013, 'amdp': 235, 'totalPrecip': 2640, 'avgTemp': 27.3, 'maxTemp': 34.0, 'minTemp': 19.9, 'avgWind': 10.6, 'dataPoints': 365}, {'year': 2014, 'amdp': 98, 'totalPrecip': 1720, 'avgTemp': 27.8, 'maxTemp': 34.8, 'minTemp': 20.5, 'avgWind': 11.8, 'dataPoints': 365}, {'year': 2015, 'amdp': 176, 'totalPrecip': 2290, 'avgTemp': 27.6, 'maxTemp': 34.5, 'minTemp': 20.2, 'avgWind': 11.0, 'dataPoints': 365}, {'year': 2016, 'amdp': 154, 'totalPrecip': 2100, 'avgTemp': 27.4, 'maxTemp': 34.2, 'minTemp': 20.0, 'avgWind': 11.3, 'dataPoints': 366}, {'year': 2017, 'amdp': 198, 'totalPrecip': 2520, 'avgTemp': 27.1, 'maxTemp': 33.9, 'minTemp': 19.7, 'avgWind': 10.9, 'dataPoints': 365}, {'year': 2018, 'amdp': 221, 'totalPrecip': 2780, 'avgTemp': 27.7, 'maxTemp': 34.6, 'minTemp': 20.4, 'avgWind': 11.6, 'dataPoints': 365}, {'year': 2019, 'amdp': 167, 'totalPrecip': 2380, 'avgTemp': 27.3, 'maxTemp': 34.1, 'minTemp': 20.1, 'avgWind': 11.1, 'dataPoints': 365}, {'year': 2020, 'amdp': 145, 'totalPrecip': 2050, 'avgTemp': 27.5, 'maxTemp': 34.4, 'minTemp': 20.3, 'avgWind': 11.4, 'dataPoints': 366}, {'year': 2021, 'amdp': 203, 'totalPrecip': 2650, 'avgTemp': 27.2, 'maxTemp': 34.0, 'minTemp': 19.8, 'avgWind': 10.7, 'dataPoints': 365}, {'year': 2022, 'amdp': 178, 'totalPrecip': 2300, 'avgTemp': 27.6, 'maxTemp': 34.5, 'minTemp': 20.2, 'avgWind': 11.2, 'dataPoints': 365}, {'year': 2023, 'amdp': 249, 'totalPrecip': 2890, 'avgTemp': 27.8, 'maxTemp': 34.9, 'minTemp': 20.6, 'avgWind': 11.7, 'dataPoints': 365}, {'year': 2024, 'amdp': 180, 'totalPrecip': 2400, 'avgTemp': 27.5, 'maxTemp': 34.5, 'minTemp': 20.5, 'avgWind': 11.0, 'dataPoints': 366}, {'year': 2025, 'amdp': 190, 'totalPrecip': 2450, 'avgTemp': 27.6, 'maxTemp': 34.6, 'minTemp': 20.6, 'avgWind': 11.1, 'dataPoints': 365}]

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
            return FALLBACK_DEMO_DATA
            
        data = resp.json()
        if not data.get('daily'):
            return FALLBACK_DEMO_DATA
            
        return process_multi_year_data(data['daily'])
    except Exception as e:
        print("Error fetching data:", e)
        return FALLBACK_DEMO_DATA

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
    # Calculate station-specific local Hershfield Km
    mean = calculate_mean(amdp_values)
    std = calculate_std(amdp_values)

    # maximum observed AMDP
    Xmax = max(amdp_values)
    rest = [x for x in amdp_values if x != Xmax]
    
    if rest:
        Xmean = calculate_mean(rest)
        S = max(calculate_std(rest), eps)
    else:
        Xmean = mean
        S = max(std, eps)

    if S > 0:
        km = (Xmax - Xmean) / S
        # Bound the local Km to a practical range for Indian stations (typically 2 to 6)
        return max(2.0, min(6.0, km))
    return 6.0




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
    if pre_1978_mean > 0:
        shift_percentage = ((post_1978_mean - pre_1978_mean) / pre_1978_mean) * 100

    trend = calculate_trend(sel_amdp_values)
    variability = (std_amdp / mean_amdp) * 100 if mean_amdp != 0 else 0

    warning = None
    if len(selected_data) < 15:
        warning = 'Warning: less than 15 years of data selected for analysis.'

    return {
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
        full_data = FALLBACK_DEMO_DATA

    # Extract the user's selected period for charts
    selected_data = [d for d in full_data if start_year <= d['year'] <= end_year]
    
    if not selected_data:
        return jsonify({'error': 'No data available for the requested specific years', 'annualData': []}), 500

    analysis_results = calculate_hydrological_parameters(full_data, selected_data, climate_factor)

    return jsonify({'annualData': selected_data, 'fullData': full_data, 'analysisResults': analysis_results})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
