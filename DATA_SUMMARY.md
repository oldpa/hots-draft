# Heroes of the Storm - Complete Dataset Summary

## Overview

This dataset contains comprehensive matchup and map data for all **85 Heroes of the Storm heroes** scraped from [heroescounters.com](https://www.heroescounters.com/).

**Last Updated:** October 23, 2025

## Files

- **`all_heroes_data.json`** (3.0 MB) - Complete dataset with all hero matchup data
- **`heroes.json`** (22 KB) - List of all 85 heroes with names and slugs
- **`abathur_matchups.json`** (108 KB) - Example single hero data (Abathur)

## Dataset Statistics

| Metric                          | Count  |
| ------------------------------- | ------ |
| Total Heroes                    | 85     |
| Total "Strong Against" Matchups | 5,603  |
| Total "Weak Against" Matchups   | 5,605  |
| Total "Good Team With" Matchups | 5,250  |
| Total Map Rankings              | 2,718  |
| File Size                       | 3.0 MB |

### Averages Per Hero

- **Strong Against:** 65.9 matchups per hero
- **Weak Against:** 65.9 matchups per hero
- **Good Team With:** 61.8 matchups per hero
- **Map Rankings:** 32.0 maps per hero

## Data Structure

### Hero Entry Format

```json
{
  "heroSlug": {
    "slug": "abathur",
    "name": "Abathur",
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
    "best_maps": [
      {
        "map": "Cursed Hollow",
        "score": 89,
        "agree": 1208,
        "disagree": 130
      }
    ]
  }
}
```

### Field Descriptions

#### Hero Object

- **`slug`** (string): URL-friendly hero identifier (e.g., "abathur")
- **`name`** (string): Display name of the hero (e.g., "Abathur")
- **`strong_against`** (array): List of heroes this hero counters well
- **`weak_against`** (array): List of heroes that counter this hero
- **`good_team_with`** (array): List of heroes that synergize well with this hero
- **`best_maps`** (array): List of maps where this hero performs best

#### Matchup Object

- **`hero`** (string): Name of the matchup hero
- **`score`** (integer): Matchup score from 0-100 (higher = stronger relationship)
- **`agree`** (integer): Number of community votes agreeing with this matchup
- **`disagree`** (integer): Number of community votes disagreeing
- **`total_votes`** (integer): Total votes (agree + disagree)
- **`agreement_percentage`** (float): Percentage of votes that agree

#### Map Object

- **`map`** (string): Name of the map
- **`score`** (integer): Performance score from 0-100 (higher = better performance)
- **`agree`** (integer): Number of community votes agreeing
- **`disagree`** (integer): Number of community votes disagreeing

## Usage Examples

### Python

```python
import json

# Load all hero data
with open('all_heroes_data.json', 'r') as f:
    heroes_data = json.load(f)

# Get Abathur's data
abathur = heroes_data['abathur']

# Find who counters Abathur the most
top_counter = abathur['weak_against'][0]
print(f"{top_counter['hero']} counters Abathur with a score of {top_counter['score']}")

# Find Abathur's best map
best_map = abathur['best_maps'][0]
print(f"Abathur's best map is {best_map['map']} (score: {best_map['score']})")

# Get all heroes that Tracer is strong against
tracer = heroes_data['tracer']
countered_heroes = [m['hero'] for m in tracer['strong_against'] if m['score'] > 70]
print(f"Tracer strongly counters: {', '.join(countered_heroes)}")
```

### JavaScript

```javascript
// Load the data
const heroesData = require("./all_heroes_data.json");

// Get a specific hero
const illidan = heroesData.illidan;

// Find synergies with high agreement
const strongSynergies = illidan.good_team_with
  .filter((m) => m.agreement_percentage > 90)
  .map((m) => m.hero);

console.log("Illidan works well with:", strongSynergies);

// Find matchups with high vote counts (reliable data)
const reliableCounters = illidan.weak_against
  .filter((m) => m.total_votes > 500)
  .sort((a, b) => b.score - a.score);

console.log("Most reliable counters to Illidan:", reliableCounters.slice(0, 5));
```

## Data Quality Notes

### Vote Reliability

- Higher `total_votes` indicates more reliable community consensus
- `agreement_percentage` shows how much the community agrees on a matchup
- Matchups with low vote counts (< 50) may be less reliable

### Score Interpretation

- **Strong Against / Weak Against:**

  - 90-100: Very strong relationship
  - 75-89: Strong relationship
  - 60-74: Moderate relationship
  - 50-59: Slight advantage
  - < 50: Weak or uncertain relationship

- **Good Team With:**
  - Similar scale, but represents synergy rather than counters

### Map Scores

- Represents community opinion on hero performance on specific maps
- Higher scores indicate better performance
- Useful for draft strategies and map-specific hero picks

## Use Cases

### Hero Counter-Pick Tool

Build a tool that suggests counter-picks during draft:

- Input: Enemy team picks hero X
- Output: Show heroes from `X.weak_against` sorted by score

### Team Synergy Analyzer

Analyze team composition synergies:

- Input: Your team has picked heroes A, B, C
- Output: Show heroes with high scores in `good_team_with` for A, B, and C

### Map-Specific Recommendations

Suggest heroes based on the map:

- Input: Map is "Cursed Hollow"
- Output: Show heroes with high scores for that map

### Win Rate Predictor

Use matchup scores to predict team fight outcomes:

- Compare counter scores between two teams
- Factor in synergy scores within each team
- Calculate expected advantage

## Limitations

1. **Static Data**: Data is from heroescounters.com and represents community opinion at scraping time
2. **Community-Driven**: Scores are based on player votes, not official stats
3. **Patch Dependent**: Game balance changes over patches may affect accuracy
4. **No Build Data**: Does not include talent builds or specific strategies

## Future Enhancements

Potential additions to the dataset:

- Hero roles and classifications
- Individual talent builds
- Professional match statistics
- Historical data tracking
- Win rate correlations
- Difficulty ratings

## License & Attribution

Data sourced from [heroescounters.com](https://www.heroescounters.com/).

Heroes of the Storm™ is a trademark or registered trademark of Blizzard Entertainment, Inc.

This dataset is for educational and development purposes only.

## Support

For issues or questions about the data:

1. Check data structure matches the examples above
2. Verify vote counts for reliability
3. Cross-reference with current game patch notes
4. Consider agreement percentage for controversial matchups
