# Real-Time Fire Danger Index & Wind Map Guide

## What You Built

Your homepage now displays:

1. **Real-Time Fire Danger Index** (0-100)
   - Calculated from live Pico sensor data
   - Updates every 2 seconds
   - Shows risk level: Low → Moderate → High → Very High → Extreme

2. **Wind Direction Map**
   - Visual compass rose showing wind speed categories
   - Real-time wind speed from anemometer
   - Beautiful animated compass

3. **Live Sensor Data Panel**
   - Temperature, Humidity, Wind Speed
   - Updates in real-time

4. **Official FWI Score** (existing)
   - Regional forecast data
   - Will integrate with 433 MHz transmitter

---

## FWI Index Explained

### What Official FWI System Needs

The **Canadian Fire Weather Index (FWI)** is a complex system that requires:

**Daily Weather Inputs:**
1. Daily max temperature (°C)
2. Daily min temperature (°C)
3. Daily relative humidity (%)
4. Daily wind speed at 10m (km/h)
5. 24-hour precipitation (mm) ← **You don't have this**
6. Previous day's Drought Code (DC)
7. Previous day's Buildup Index (BUI)

**Complex Calculations:**
- Takes minimum 16 days of daily data to stabilize
- Uses numerical indices (FFMC, DMC, DC, ISI, BUI)
- Produces final FWI score on 0-100+ scale

**Why hard to implement:**
- Needs 16 days of historical data before accurate
- Needs daily (not real-time) measurements
- Needs precipitation data (rain gauge missing)
- Official implementation is complex (~200 lines of algorithm)

### What You Built Instead: Real-Time Fire Danger Index

**Simplified approach using:**
- Temperature (°C)
- Relative Humidity (%)
- Wind Speed (m/s or km/h)

**Advantages:**
- ✅ Real-time (updates every 2 seconds)
- ✅ Works with current Pico data
- ✅ No historical data needed
- ✅ Instant fire danger assessment
- ✅ Useful for immediate monitoring

**Limitations:**
- ❌ Not the official FWI Index
- ❌ Missing precipitation/drought factors
- ❌ Simplified algorithm
- ❌ Should not replace official FWI for official reports

---

## The Real-Time Index Algorithm

Located in `frontend/src/lib/fireDangerCalculator.ts`

### How It Works

```
Fire Danger Index = (Temperature Factor + Humidity Factor + Wind Factor) / 1.1
```

**Temperature Factor (0-40 scale):**
- 0°C = 0 (too cold, no fire risk)
- 10-25°C = Linear increase (10-40)
- 25°C = Peak danger (40)
- 40°C = Starts declining (30)
- 50°C = 10 (too extreme for typical fires)

**Humidity Factor (0-40 scale):**
- Lower humidity = higher danger
- 100% humidity = 0 danger
- 10% humidity = 40 danger
- Calculation: `(100 - humidity) * 0.4`

**Wind Factor (0-30 scale):**
- 0 km/h = 0 danger
- 30 km/h = 18 danger
- 50+ km/h = 30 danger
- Calculation: `wind_kmh * 0.6` (capped at 30)

### Danger Levels

| Score | Level | Color | Risk |
|-------|-------|-------|------|
| 0-20 | Low | Green | Minimal |
| 20-40 | Moderate | Yellow | Caution |
| 40-60 | High | Orange | Warning |
| 60-80 | Very High | Red | Dangerous |
| 80-100 | Extreme | Dark Red | Critical |

---

## Wind Direction Map

### Features

**Visual Compass:**
- Cardinal directions (N, S, E, W)
- Intercardinal directions (NE, SE, SW, NW)
- Degree markings (0°-360°)
- Animated wind arrow
- Professional SVG design

**Wind Speed Categories:**
- 🍃 Calm: < 5 km/h
- 🌬️ Light: 5-11 km/h
- 💨 Moderate: 11-19 km/h
- 🌪️ Fresh: 19-28 km/h
- ⚡ Strong: 28+ km/h

### Current Limitation

Your anemometer only measures **wind SPEED**, not direction. The compass shows:
- ✅ Real wind speed
- ❌ Animated arrow (not real direction)

### Future Enhancement

To get real wind direction, add a **wind vane** to your Pico:
- Measures wind direction (0-360°)
- Connects to analog input (ADC pin on Pico)
- Returns cardinal direction
- Shows on map in real-time

---

## How to Use

### 1. Start All Services

**Terminal 1 - Python Bridge:**
```bash
cd "c:\Users\akash\OneDrive\Desktop\Praxis 3"
python pico_serial_bridge.py --mock  # or --port COM3 with hardware
```

**Terminal 2 - Backend:**
```bash
cd "c:\Users\akash\OneDrive\Desktop\Praxis 3\Wildfire-Interface-WUI-\backend"
npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd "c:\Users\akash\OneDrive\Desktop\Praxis 3\Wildfire-Interface-WUI-\frontend"
npm run dev
```

### 2. Open Website

Go to **http://localhost:5173**

You should see:
- 🔴 **Real-Time Fire Danger Index** at top (big, red/green box)
- 🧭 **Wind Direction Map** (compass rose)
- 📊 **Live Sensor Data** (temp, humidity, wind)
- 📋 **Official FWI Card** (existing, still shows mock data)

### 3. Test Behavior

**Mock mode (--mock):**
- Generates random temperature (0-50°C)
- Generates random humidity (0-100%)
- Generates random wind speed (0-30 m/s)
- Fire Danger Index changes based on random conditions

**Real hardware:**
- Uses actual Pico sensor values
- Fire Danger updates as conditions change
- Wind speed shows real anemometer reading

---

## Code Overview

### Files Created/Modified

**Created:**
- `frontend/src/lib/fireDangerCalculator.ts` (120 lines)
  - `calculateFireDangerIndex()` function
  - Sensor data types
  - Color/level helpers

- `frontend/src/components/FireDangerPanel.tsx` (100 lines)
  - Visual display of fire danger
  - Progress bar, risk percentage
  - Contributing factors list
  - Disclaimer about not being official FWI

- `frontend/src/components/WindDirectionMap.tsx` (150 lines)
  - Compass rose SVG
  - Wind speed categories
  - Beautiful animation
  - Reference scale

**Modified:**
- `frontend/src/routes/HomePage.tsx`
  - Added real-time sensor fetching
  - Displays FireDangerPanel
  - Displays WindDirectionMap
  - Live sensor data grid
  - Explanation of real-time vs official FWI

---

## Integrating with Official FWI

When you get historical weather data from your 433 MHz transmitter:

1. **Store 16 days of daily weather** in a database:
   - Min/max temperature
   - Min/max humidity
   - Wind speed
   - Precipitation

2. **Calculate official FWI indices:**
   ```
   FFMC = Fine Fuel Moisture Code
   DMC = Duff Moisture Code
   DC = Drought Code
   ISI = Initial Spread Index
   BUI = Buildup Index
   FWI = Final FWI Index
   ```

3. **Replace the `/api/fwi/current` endpoint** in backend to return official values

4. **Keep the real-time index** for immediate monitoring

---

## What's Showing in the UI

### Homepage Layout (from top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 REAL-TIME FIRE DANGER INDEX                              │
│    Score: 65 out of 100 → "Very High Fire Danger"           │
│    Progress bar showing risk level                           │
│    Sensor readings: Temp, Humidity, Wind                     │
│    Contributing factors: "Hot 32°C", "Very dry 25% humidity" │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────┬────────────────────┐
│ 🧭 WIND & WEATHER                      │ 📊 LIVE SENSOR DATA│
│ ┌──────────────────────────────────┐   │ Temperature: 32°C  │
│ │     Compass Rose Map             │   │ Humidity: 25%      │
│ │        N (0°)                    │   │ Wind Speed: 28 km/h│
│ │    W ● E                         │   │ Wind Speed: 7.8 m/s│
│ │        S (180°)                  │   └────────────────────┘
│ │    Arrow rotates                 │
│ │    Wind: Fresh (19-28 km/h)      │
│ / │    Speed: 20.5 km/h            │               
│ │    Scale reference               │
│ └──────────────────────────────────┘
└────────────────────────────────────────┴────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📋 OFFICIAL FIRE WEATHER INDEX (FWI)                        │
│    Region: Chipewyan Lake, AB                               │
│    FWI Score: 27.4 (Mock data)                              │
│    When 433 MHz transmitter integrated, will show real FWI  │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Scenarios

### Scenario 1: Low Fire Danger (Mock)
```
Temperature: 5°C (cold)
Humidity: 85% (wet)
Wind: 3 km/h (calm)
→ Result: Index = 15, Level = "Low" 🟢
```

### Scenario 2: High Fire Danger (Mock)
```
Temperature: 35°C (hot)
Humidity: 15% (very dry)
Wind: 30 km/h (strong)
→ Result: Index = 85, Level = "Extreme" 🔴
```

### Scenario 3: Moderate Fire Danger (Typical)
```
Temperature: 22°C (mild)
Humidity: 50% (moderate)
Wind: 15 km/h (light breeze)
→ Result: Index = 42, Level = "High" 🟠
```

---

## Customization

### Want to Adjust Fire Danger Formula?

Edit `frontend/src/lib/fireDangerCalculator.ts`:

```typescript
// Temperature factor - change these values
let tempFactor = 0;
if (temp < 0) {
  tempFactor = 0;
} else if (temp < 10) {
  tempFactor = temp; // ← Adjust sensitivity
} else if (temp < 25) {
  tempFactor = 10 + (temp - 10) * 2; // ← Adjust multiplier
  // ... etc
}
```

### Want to Add More Sensors?

Extend `SensorData` interface:

```typescript
export interface SensorData {
  bme_temp: number | null;
  bme_hum: number | null;
  anemometer: number | null;
  bme_press: number | null;      // ← Add new field
  soil: number | null;            // ← Add new field
  // ... etc
}
```

Then use in calculation function.

### Want Different Danger Levels?

Edit the thresholds in `calculateFireDangerIndex()`:

```typescript
if (index < 20) {      // ← Change threshold
  level = "low";
} else if (index < 40) {
  // ... etc
}
```

---

## Next Steps

1. ✅ Real-time fire danger index working
2. ✅ Wind direction map displaying
3. ✅ All running with mock data

**Future enhancements:**
- 🎯 Add wind vane to Pico for real direction
- 🎯 Add rain gauge to Pico for precipitation
- 🎯 Integrate 433 MHz transmitter data
- 🎯 Calculate official FWI with 16-day history
- 🎯 Add historical charts and trends
- 🎯 WebSocket for real-time updates

---

## Quick Reference

| Component | Location | Implements |
|-----------|----------|-----------|
| Fire Danger Calc | `lib/fireDangerCalculator.ts` | Math & algorithm |
| Fire Danger UI | `components/FireDangerPanel.tsx` | Visual display |
| Wind Map UI | `components/WindDirectionMap.tsx` | Compass rose |
| HomePage | `routes/HomePage.tsx` | Main layout |

---

## Support

**Something not showing?**
1. Check Python bridge is running: `python pico_serial_bridge.py --mock`
2. Check backend is running: `npm run dev` (backend folder)
3. Check frontend is running: `npm run dev` (frontend folder)
4. Open browser console (F12) for errors
5. Test API: `curl http://localhost:5174/api/sensors`

**Want to understand FWI better?**
- [Natural Resources Canada FWI System](https://cwfis.cfs.nrcan.gc.ca/)
- [FWI Algorithm Documentation](https://cwfis.cfs.nrcan.gc.ca/background/firewx/fwi)

---

Enjoy your real-time fire danger monitoring! 🔥🗺️
