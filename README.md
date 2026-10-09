# CityPulse Pune 🏙️

> **Explore smarter. Travel safer. Experience Pune better.**  
> A smart city exploration and safety navigation web application prototype built for hackathon demonstration.

---

## 📌 Problem Statement

> *"City Life: Exploring, Experiencing & Navigating the Chaos We Call Home."*

Pune is a vibrant metropolis blending rich Peshwa-era history, thriving academic corridors, and bustling IT corridors with complex traffic bottlenecks and monsoon transit challenges. **CityPulse Pune** is a human-centric smart city web application that empowers residents, students, and tourists to discover landmarks, evaluate safety conditions, track live weather insights, report real-time civic issues, and generate tailored day itineraries tailored to individual budgets.

---

## ✨ Features

1. **Live Pune Weather Widget:**
   - Real-time weather data fetched from the Open-Meteo API for Pune (`18.5204° N, 73.8567° E`).
   - Dynamic temperature, humidity, and precipitation monitoring.
   - Intelligent status badges (*"Rain alert"*, *"Heat alert"*, or *"Good time to explore"*).
   - Graceful fallback mechanism in case of network disruptions without breaking the application.

2. **Interactive Explore Dashboard:**
   - Multi-category map navigation (Heritage, Food, Hotels, Attractions, Safety Zones).
   - Custom color-coded pins:
     - Heritage: **Red**
     - Food: **Orange**
     - Hotels: **Purple**
     - Attractions: **Blue**
     - Safety Zones: **Dark Red**
   - Instant search with dynamic substring matching across place names, categories, and descriptions.
   - Interactive budget slider (from ₹0 free entry to luxury brackets).
   - Coordinated dual-state interaction: clicking an item on the sidebar list focuses the map pin and opens popups, and vice versa.
   - Detailed scorecards showcasing Rating, Safety, Cleanliness, Affordability, and Accessibility.

3. **Head-to-Head Compare Matrix:**
   - Interactive selection grid (select 2 or 3 Pune locations).
   - Side-by-side comparison matrix covering Rating, Safety, Cleanliness, Affordability, Accessibility, and Average Price.
   - **Automated Color Benchmarking:** Best score highlighted in **Green**, worst score highlighted in **Red** (for average price, lower cost is identified as superior).
   - Automated composite scoring ranking the *Best Places Overall*.
   - Cautionary highlight cards listing sample bottleneck zones.

4. **Safety Awareness & Straight-Line Route Helper:**
   - Red circular warning buffers (1.2 km radius) on Leaflet map indicating sample high-traffic/accident junctions (e.g. Swargate and Yerawada Junctions).
   - Straight-line corridor proximity tester between any chosen starting point and destination.
   - Instant collision detection flagging paths that intersect caution zones with clear advisory guidance.
   - Curated Pune safety advisories (monsoon hill precautions, late-night transit, emergency hotline contacts).

5. **Community Citizen Reports & Client-Side Rule-Based NLP Analysis:**
   - Interactive map location picker allowing users to tap on the map to pin precise incident coordinates.
   - Categorized reporting for *Unsafe areas*, *Accident hazards*, *Traffic bottlenecks*, and *Cleanliness/sanitation issues*.
   - **Client-Side Rule-Based NLP Screening:** Automated keyword detection across English, Hindi, and Marathi terms (e.g., *fire*, *blood*, *accident*, *pothole*, *खड्डा*, *कचरा*).
   - Generates compact report tags (e.g., `🚨 Critical`, `🚧 High Priority`, `🛠️ Needs Attention`), rule confidence percentages (e.g., `94%`), and status labeled as *“Needs human verification”*.
   - **Citizen Report Analytics Dashboard:** Compact visual progress breakdown showing Total reports, Top category, Urgent/Critical counts, and percentage distribution.
   - Multimodal photo attachment and native microphone voice note recording (`MediaRecorder`).
   - Client-side persistence utilizing browser `localStorage` under the key `citypulseReports`.
   - Real-time map pins for all submitted reports with input sanitization and XSS protection.

6. **Plan My Day (Rule-Based Itinerary Generator):**
   - Pure algorithmic, zero-external-AI day planner.
   - Inputs for per-person budget in INR and multi-select interest categories.
   - Automatically filters out unsafe caution zones and places exceeding the user budget.
   - Sorts candidate destinations by visitor ratings to recommend up to 5 curated stops with total cost calculations and direct "View on Map" links.

---

## 🛠️ Tech Stack & Architecture

- **Frontend:** Pure semantic HTML5, modern CSS3 (Custom Properties, Flexbox, CSS Grid), Vanilla ES6+ JavaScript.
- **Mapping Engine:** [Leaflet.js](https://leafletjs.com/) (v1.9.4 CDN) with [OpenStreetMap](https://www.openstreetmap.org/) tile layers.
- **Weather API:** [Open-Meteo](https://open-meteo.com/) Forecast API (free, open-access, **no API key required**).
- **Data Store:** Static `places.json` + Browser `localStorage`.
- **Zero Build Tools:** No React, Vue, Angular, Tailwind, Bootstrap, Node.js, or build pipeline. Runs out of the box as a static web application.

---

## 📁 File Structure

```text
CityPulse-Pune/
├── index.html       # Semantic HTML layout, CDN tags, 5 tab views & modal layouts
├── style.css        # Clean responsive styling, color palette, custom pin styles
├── app.js           # Core state management, Leaflet handlers, Open-Meteo integration
├── places.json      # Curated dataset of 13 realistic Pune landmarks and junctions
└── README.md        # Comprehensive documentation, run instructions, and disclaimers
```

---

## 🚀 How to Run Locally

You can launch CityPulse Pune using Python's built-in HTTP server:

```bash
# Navigate to the project folder and run:
python -m http.server 5500
```

Then open your browser and navigate to:

```text
http://localhost:5500
```

*(Alternatively, you can open `index.html` directly or use any static web server such as VS Code Live Server or `npx serve`)*.

---

## 🌐 How to Deploy on Vercel

Because CityPulse Pune is a 100% static project with no backend, database, or build steps, deployment to [Vercel](https://vercel.com/) is effortless:

### Method A: Deploy via Vercel CLI
```bash
# In the project root directory:
npm i -g vercel   # if not already installed
vercel
```
Follow the interactive prompts:
- Set project root to `./`
- No build command required (leave empty)
- Output directory: `./`

### Method B: Deploy via GitHub & Vercel Dashboard
1. Push this repository to GitHub or GitLab.
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import the repository.
4. Leave **Framework Preset** as **Other**.
5. Click **Deploy**. Vercel will instantly generate a live URL.

---

## ⚠️ Important Notices & Disclaimers

> [!IMPORTANT]
> **No API Key Required:**  
> The application uses the public Open-Meteo endpoint and open-access OpenStreetMap tiles. No environment variables or credentials are required.

> [!WARNING]
> **Demo Data Disclaimer:**  
> Safety scores, accident-prone tags, traffic bottleneck classifications, cleanliness ratings, and citizen reports in this prototype are **simulated demo values** crafted for hackathon demonstration. They do **not** reflect official Pune Municipal Corporation (PMC) or Pune City Police incident logs.

> [!CAUTION]
> **Straight-Line Route Helper Notice:**  
> The "Safer route helper" uses Euclidean/Haversine proximity line geometry across points for situational awareness demonstration. It is **not** an official GPS turn-by-turn navigation engine or emergency dispatch system. For real-life emergencies in Pune, contact **112** (Police/Emergency) or **108** (Ambulance).

---

## 🤝 Attributions & Credits

- **Leaflet.js:** Open-source JavaScript library for interactive maps ([leafletjs.com](https://leafletjs.com/))
- **OpenStreetMap:** Map data &copy; [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- **Open-Meteo:** Open-source weather API ([open-meteo.com](https://open-meteo.com/))
- **Pune Landmarks Data:** Inspired by historical Peshwa heritage, FC Road culinary culture, and key urban transit junctions in Pune, Maharashtra, India.
