# HikePal:  Hiking AI Assistant

[cite_start]**HikePal** is a proactive, AI-driven platform that evolves traditional outdoor tools from passive maps into empathetic companions[cite: 6]. [cite_start]Designed for the smart tourism landscape of Hong Kong, it addresses gaps in group planning friction, dynamic safety risks, and passive community engagement[cite: 9, 86].

## 🌟 Core Functional Pillars

* [cite_start]**AI-Driven Pre-hike Planning**: Decodes natural language preferences into structured emotional vectors to provide personalized route recommendations with AI-generated rationales[cite: 7].
* [cite_start]**In-hike Protection & AI Companion**: Features an "Ask AI" interface for adaptive safety guidance and context-aware risk shields that alert users to hazards like steep cliffs or low-signal areas[cite: 7, 51].
* [cite_start]**Ecosystem Community**: A dedicated space where hikers transform from passive users into active contributors by sharing geo-tagged "Emotion Notes" and routes[cite: 7, 81].
* [cite_start]**Sustainable ESG Events**: The platform hosts curated events such as "Dragon’s Back Trash Clean-up" and "Sir Cecil’s Ride Photography Tour" to foster environmental stewardship and long-term social engagement[cite: 7, 52, 83].

## 🏗️ System Architecture

[cite_start]HikePal adopts a modular three-tier architecture optimized for real-time collaboration and geospatial rendering[cite: 11]:

| Layer | Technology Stack | Key Responsibilities |
| :--- | :--- | :--- |
| **Presentation** | React 18, TypeScript, Tailwind CSS, Zustand | [cite_start]Responsive interfaces, type-safety, and team state synchronization[cite: 13, 14, 19]. |
| **Application** | Python/FastAPI, modular services | [cite_start]Preference aggregation, route matching (cosine similarity), and coordinate normalization[cite: 14, 15, 25]. |
| **Data & Geo** | Supabase (PostgreSQL + PostGIS), Leaflet.js | [cite_start]Spatial indexing, real-time subscriptions, and offline-friendly tile loading[cite: 15, 16, 21]. |

## 📊 Data Methodology

* [cite_start]**Hierarchical Modeling**: Routes are decomposed into discrete "Segments," allowing the AI to reassemble them into official paths or "Generative Routes" based on specific user moods[cite: 36, 38].
* [cite_start]**Proactive Reminders**: A spatial database (reminder_info) contains over 100 curated Points of Interest (POIs), including facilities (restrooms/shelters), cultural landmarks, and safety hazards[cite: 48, 49, 50, 51].
* [cite_start]**Geospatial Preprocessing**: Raw GPS data from Wikiloc and 2Bulu was manually refined, standardized into GeoJSON, and enriched with elevation profiles and slope analysis[cite: 29, 31, 32, 33].

## 🚀 System Workflow

1.  [cite_start]**Planning**: Users select Solo or Group mode and submit preferences; captains share a link for real-time team preference aggregation[cite: 61, 62].
2.  [cite_start]**Navigation**: Tracking via Live GPS or manual simulation with toggleable map layers for safety reminders[cite: 71, 72].
3.  [cite_start]**Interaction**: Users log "Emotion Notes" (photos + mood tags) at specific waypoints during the hike[cite: 74, 77].
4.  [cite_start]**Community**: Completed tracks are saved to a personal library and can be published to the community for peers to explore[cite: 81].

## 📈 Future Evolution

* [cite_start]**IoT Integration**: Incorporating biometric sensors for real-time fatigue monitoring[cite: 89].
* [cite_start]**Multimodal AI**: Moving beyond text-based inputs for richer affective computing and emotional analysis[cite: 89].
* [cite_start]**Geographic Expansion**: Extending the scope beyond Hong Kong Island to encompass a wider variety of regional trails[cite: 88].

---

**Live Demo**: [https://hikepal-ai.netlify.app/](https://hikepal-ai.netlify.app/)

*This project was developed as a Capstone for HK POLYU GAH Capstone project [cite: 165]。* created by ERZHUO NIE and JUNYU MAO.
