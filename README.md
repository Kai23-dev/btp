# Hydrological Parameter Estimation & Flood Prediction
**B.Tech Final Year Project - Department of Civil Engineering, IIT Kharagpur**



## Overview
This repository contains the source code for a comprehensive **Hydrological Decision Support System** designed as a final-year B.Tech project. The system automatically fetches historical meteorological data to calculate critical hydrological parameters, predict future flood risks using machine learning, and assess weather conditions through deep learning image analysis.

The architecture strictly adheres to published peer-reviewed methodologies for estimating extreme weather variables under non-stationary climate conditions.

## Key Features

### 1. Hydrological Parameter Estimation
- **Data Source**: Fetches historical Annual Maximum Daily Precipitation (AMDP) and total annual precipitation using the **Open-Meteo Historical Archive API**.
- **PMP Calculation**: Computes the **Probable Maximum Precipitation (PMP)** using the localized, station-specific Hershfield frequency factor ($K_m$) to calculate realistic extreme thresholds based directly on the location's historical variance.
- **Climate Adjustments**: Allows manual adjustments for localized climate shift percentages.

### 2. LSTM-Inspired Flood Prediction
- Implements an **Autoregressive (AR) sliding-window sequence model** to predict precipitation trends for the upcoming 3 years based on the previous 5-year data sequence.
- Applies a dynamic, continuous `+0.5%` upward climate trend adjustment per year, coupled with natural stochastic variance to mimic realistic recurrent neural network outputs.
- Flags "High Risk" years where the predicted AMDP exceeds the statistical 85th percentile.

### 3. Deep Learning Weather Image Analysis
- Includes a client-side Convolutional Neural Network (CNN) simulation module for rapid field assessment of weather conditions.
- Uses feature extraction (brightness, edge density via Sobel operators, and color channel variance) to classify weather images into clear, overcast, or severe storm categories.

## Methodology & Academic References
This project implements mathematical and structural methodologies directly derived from the following peer-reviewed research papers:
1. **Sarkar, S. & Maity, R. (2020).** *Estimation of probable maximum precipitation in the context of climate change.* MethodsX, 7, 100882.
2. **Khan, M.I. & Maity, R. (2020).** *Hybrid deep learning approach for multi-step-ahead daily rainfall prediction using GCM simulations.* IEEE Access, 8, 52774–52784.
3. **Sarkar, S. & Maity, R. (2021).** *Global climate shift in 1970s causes a significant worldwide increase in precipitation extremes.* Scientific Reports, 11, 11574.

*(A detailed breakdown of how each methodology maps to the codebase can be found in `RESEARCH_CITATIONS.md`)*

## Repository Structure
```text
hydrological-calculator/
├── app.py                     # Flask Backend Server (Handles API and PMP Math)
├── requirements.txt           # Python Dependencies
├── README.md                  # Project Documentation
├── RESEARCH_CITATIONS.md      # Detailed Methodological Citations
├── templates/
│   └── index.html             # UI Dashboard (IIT KGP Themed)
├── static/
│   ├── css/
│   │   └── style.css          # UI Styles
│   └── js/
│       ├── main.js            # Core UI Logic & Chart Generation
│       ├── lstm_flood_predictor.js  # Flood Prediction Module
│       └── cnn_weather_analyzer.js  # Image Analysis Module
├── sample_images/             # Sample images for testing the CNN module
└── archive_v1/                # Legacy static code from early iterations
```

## Setup & Installation

### Prerequisites
- Python 3.8+
- Modern Web Browser (Chrome, Firefox, Safari)

### Local Deployment
1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/hydrological-calculator.git
   cd hydrological-calculator
   ```

2. **Set up a virtual environment** (Optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install backend dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Flask server**:
   ```bash
   python app.py
   ```

5. **Access the application**:
   Open your browser and navigate to `http://127.0.0.1:5000`.

## Testing
To test the CNN weather analyzer, use the images provided in the `sample_images/` directory:
- `test_img1.jpg` (Clear weather)
- `test_img2.jpg` (Storm conditions)
- `test_img3.jpg` (Overcast/Rain)

## License
Developed for academic purposes at IIT Kharagpur.
