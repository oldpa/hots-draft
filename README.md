# Heroes of the Storm Hero Picker Tool

A comprehensive data scraping tool and dataset for Heroes of the Storm based on data from [heroescounters.com](https://www.heroescounters.com/).

## 📊 Dataset

**Complete datasets available:**

### Hero Matchup Data

`all_heroes_data.json` (3.0 MB)

- **85 heroes** with full matchup data
- **5,603** "strong against" matchups
- **5,605** "weak against" matchups
- **5,250** "good team with" synergies
- **2,718** map rankings per hero

### Map Performance Data

`all_maps_data.json` (233 KB)

- **16 maps** with hero performance rankings
- **1,359** hero performance entries
- **~85 heroes** ranked per map
- Community vote data for each hero-map combination

See [DATA_SUMMARY.md](DATA_SUMMARY.md) for detailed documentation.

## 🚀 Features

### Data Scraping

- ✅ Scrape complete hero list from heroescounters.com
- ✅ Scrape detailed matchup data for individual heroes
- ✅ Scrape all 85 heroes automatically with progress tracking
- ✅ Scrape all 16 maps with hero performance rankings
- ✅ Download hero portrait images (92x92px)
- ✅ Store data in structured JSON format
- ✅ Error handling and resume capability
- ✅ Rate limiting to be respectful to the server

### Web App

- ✅ Interactive team picker interface
- ✅ Map selection
- ✅ Ban phase (3 bans per team)
- ✅ Pick phase (5 picks per team)
- ✅ Hero search and filtering
- ✅ Modern, responsive UI
- ✅ Ready for GitHub Pages deployment

## 📦 Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

## 🔧 Usage

### Option 1: Use Pre-Scraped Data (Recommended)

The complete dataset is already available in `all_heroes_data.json`. Just load and use it:

```python
import json

with open('all_heroes_data.json', 'r') as f:
    heroes = json.load(f)

# Get Abathur's counters
abathur = heroes['abathur']
print(f"Top counter: {abathur['weak_against'][0]['hero']}")
```

### Option 2: Re-scrape Data

#### Scrape Hero List

```bash
python scraper.py
```

Creates `heroes.json` with all 85 hero names and URLs.

#### Scrape Single Hero

```bash
python scrape_hero_details.py
```

Creates `abathur_matchups.json` as an example.

#### Scrape All Heroes

```bash
python scrape_all_heroes.py --delay 1.0 --output all_heroes_data.json
```

Options:

- `--delay` / `-d`: Seconds between requests (default: 1.0)
- `--output` / `-o`: Output filename (default: all_heroes_data.json)
- `--resume` / `-r`: Resume from a specific hero slug

Example with resume:

```bash
python scrape_all_heroes.py --resume muradin
```

#### Scrape All Maps

```bash
python scrape_maps.py --delay 0.5 --output all_maps_data.json
```

Options:

- `--delay` / `-d`: Seconds between requests (default: 0.5)
- `--output` / `-o`: Output filename (default: all_maps_data.json)

#### Download Hero Images

```bash
python download_hero_images.py --output images/heroes
```

This downloads 92x92px portrait images for all 85 heroes from the team picker page.

Options:

- `--output` / `-o`: Output directory (default: images/heroes)

### Run the Web App

Start a local web server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

See [WEB_APP_README.md](WEB_APP_README.md) for detailed web app documentation and GitHub Pages deployment instructions.

## 📁 Project Structure

```
hots/
├── scraper.py                  # Scrapes hero list
├── scrape_hero_details.py      # Scrapes individual hero matchup data
├── scrape_all_heroes.py        # Scrapes all heroes (batch)
├── scrape_maps.py              # Scrapes all maps (batch)
├── download_hero_images.py     # Downloads hero portrait images
├── index.html                  # ⭐ Web app - Main HTML
├── styles.css                  # ⭐ Web app - Styling
├── app.js                      # ⭐ Web app - JavaScript logic
├── all_heroes_data.json        # Complete hero dataset (3.0 MB)
├── all_maps_data.json          # Complete map dataset (233 KB)
├── heroes.json                 # List of all 85 heroes
├── abathur_matchups.json       # Example single hero data
├── images/
│   └── heroes/                 # Hero portrait images (85 x 92x92px JPG)
├── requirements.txt            # Python dependencies
├── README.md                   # This file
├── WEB_APP_README.md           # Web app documentation
└── DATA_SUMMARY.md             # Dataset documentation
```

## 📖 Data Structure

### Hero Data

Each hero in `all_heroes_data.json` contains:

```json
{
  "heroSlug": {
    "name": "Abathur",
    "slug": "abathur",
    "strong_against": [
      {
        "hero": "Tracer",
        "score": 62,
        "agree": 452,
        "disagree": 237,
        "total_votes": 689,
        "agreement_percentage": 65.6
      }
    ],
    "weak_against": [...],
    "good_team_with": [...],
    "best_maps": [...]
  }
}
```

### Map Data

Each map in `all_maps_data.json` contains:

```json
{
  "mapSlug": {
    "name": "Battlefield of Eternity",
    "slug": "battlefieldofeternity",
    "total_heroes": 85,
    "heroes": [
      {
        "hero": "Valla",
        "score": 93,
        "agree": 2193,
        "disagree": 137,
        "total_votes": 2330,
        "agreement_percentage": 94.1
      }
    ]
  }
}
```

## 💡 Use Cases

1. **Counter-Pick Tool**: Build a draft helper that suggests counters
2. **Team Synergy Analyzer**: Find heroes that work well together
3. **Map-Specific Recommendations**: Suggest heroes for specific maps
4. **Win Prediction**: Estimate matchup advantages
5. **Data Analysis**: Analyze hero meta and community trends
6. **Draft Strategy**: Combine hero matchups with map performance for optimal picks

## 🎯 Example Applications

### Find Best Counter for Enemy Pick

```python
def find_counters(enemy_hero_slug, heroes_data, min_score=75):
    """Find heroes that counter the enemy hero"""
    counters = []
    for hero_slug, hero_data in heroes_data.items():
        for matchup in hero_data['strong_against']:
            if matchup['hero'].lower() == heroes_data[enemy_hero_slug]['name'].lower():
                if matchup['score'] >= min_score:
                    counters.append({
                        'hero': hero_data['name'],
                        'score': matchup['score'],
                        'votes': matchup['total_votes']
                    })
    return sorted(counters, key=lambda x: x['score'], reverse=True)
```

### Find Team Synergies

```python
def find_synergies(picked_heroes, heroes_data, min_score=80):
    """Find heroes that synergize with picked heroes"""
    synergies = {}
    for picked_slug in picked_heroes:
        picked_data = heroes_data[picked_slug]
        for matchup in picked_data['good_team_with']:
            if matchup['score'] >= min_score:
                hero_name = matchup['hero']
                if hero_name not in synergies:
                    synergies[hero_name] = []
                synergies[hero_name].append(matchup['score'])

    # Calculate average synergy score
    avg_synergies = {
        hero: sum(scores) / len(scores)
        for hero, scores in synergies.items()
    }
    return sorted(avg_synergies.items(), key=lambda x: x[1], reverse=True)
```

## ⚠️ Notes

- Data is community-driven from heroescounters.com
- Scraped data represents player opinions, not official statistics
- Game balance changes may affect accuracy over time
- Higher vote counts indicate more reliable data
- Be respectful to the source website (use rate limiting)

## 🔮 Future Enhancements

- [ ] Real-time data updates
- [ ] Historical data tracking
- [ ] Professional match statistics
- [ ] Hero role classifications
- [ ] Talent build recommendations
- [ ] Interactive web interface
- [ ] API endpoint for easy access

## 📄 License

Data sourced from [heroescounters.com](https://www.heroescounters.com/).

Heroes of the Storm™ is a trademark or registered trademark of Blizzard Entertainment, Inc.

This project is for educational and development purposes only.
