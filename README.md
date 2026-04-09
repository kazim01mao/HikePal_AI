# HikePal: Hiking AI Assistant

**HikePal** is a proactive, AI-driven platform that evolves traditional outdoor tools from passive maps into empathetic companions. Designed for the smart tourism landscape of Hong Kong, it addresses gaps in group planning friction, dynamic safety risks, and passive community engagement.

## 🌟 Core Functional Pillars

* **AI-Driven Pre-hike Planning**: Decodes natural language preferences into structured emotional vectors to provide personalized route recommendations with AI-generated rationales.
* **In-hike Protection & AI Companion**: Features an "Ask AI" interface for adaptive safety guidance and context-aware risk shields that alert users to hazards like steep cliffs or low-signal areas.
* **Ecosystem Community**: A dedicated space where hikers transform from passive users into active contributors by sharing geo-tagged "Emotion Notes" and routes.
* **Sustainable ESG Events**: The platform hosts curated events such as "Dragon’s Back Trash Clean-up" and "Sir Cecil’s Ride Photography Tour" to foster environmental stewardship and long-term social engagement.

## 🏗️ System Architecture

HikePal adopts a modular three-tier architecture optimized for real-time collaboration and geospatial rendering:

| Layer | Technology Stack | Key Responsibilities |
| :--- | :--- | :--- |
| **Presentation** | React 18, TypeScript, Tailwind CSS, Zustand | Responsive interfaces, type-safety, and team state synchronization. |
| **Application** | Python/FastAPI, modular services | Preference aggregation, route matching (cosine similarity), and coordinate normalization. |
| **Data & Geo** | Supabase (PostgreSQL + PostGIS), Leaflet.js | Spatial indexing, real-time subscriptions, and offline-friendly tile loading. |

## 📊 Data Methodology

* **Hierarchical Modeling**: Routes are decomposed into discrete "Segments," allowing the AI to reassemble them into official paths or "Generative Routes" based on specific user moods.
* **Proactive Reminders**: A spatial database (reminder_info) contains over 100 curated Points of Interest (POIs), including facilities (restrooms/shelters), cultural landmarks, and safety hazards.
* **Geospatial Preprocessing**: Raw GPS data from Wikiloc and 2Bulu was manually refined, standardized into GeoJSON, and enriched with elevation profiles and slope analysis.

## 🚀 System Workflow

1.  **Planning**: Users select Solo or Group mode and submit preferences; captains share a link for real-time team preference aggregation.
2.  **Navigation**: Tracking via Live GPS or manual simulation with toggleable map layers for safety reminders.
3.  **Interaction**: Users log "Emotion Notes" (photos + mood tags) at specific waypoints during the hike.
4.  **Community**: Completed tracks are saved to a personal library and can be published to the community for peers to explore.

## 📈 Future Evolution

* **IoT Integration**: Incorporating biometric sensors for real-time fatigue monitoring.
* **Multimodal AI**: Moving beyond text-based inputs for richer affective computing and emotional analysis.
* **Geographic Expansion**: Extending the scope beyond Hong Kong Island to encompass a wider variety of regional trails.

---

**Live Demo**: [https://hikepal-ai.netlify.app/](https://hikepal-ai.netlify.app/)

*This project was developed as a Capstone for HK POLYU GAH.* Created by **ERZHUO NIE** and **JUNYU MAO**.
