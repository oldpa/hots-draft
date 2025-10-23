"""Map hero slugs to their image IDs by checking which ID appears in their context"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re

# Load heroes list
with open("heroes.json", "r") as f:
    heroes = json.load(f)

BASE_URL = "https://www.heroescounters.com"
session = requests.Session()
session.headers.update(
    {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
)

hero_to_image_id = {}

print("=" * 70)
print("MAPPING HEROES TO IMAGE IDs")
print("=" * 70)
print(f"\nAnalyzing {len(heroes)} heroes...")
print("Strategy: Find the most frequent image ID on each hero's page\n")

# Sample just first 5 heroes for testing
test_heroes = heroes[:5]

for i, hero in enumerate(test_heroes):
    slug = hero["slug"]
    name = hero["name"]

    print(f"[{i+1}/{len(test_heroes)}] {name} ({slug})...")

    try:
        # Get hero page
        url = f"{BASE_URL}/hero/{slug}"
        response = session.get(url)
        response.raise_for_status()

        # Find all image IDs mentioned on the page
        # Pattern: /images/heroes/92/NUMBER.jpg
        image_ids = re.findall(r"/images/heroes/\d+/(\d+)\.jpg", response.text)

        if image_ids:
            # Count frequency of each ID
            from collections import Counter

            id_counts = Counter(image_ids)

            # The hero's own ID should appear frequently (in different sections)
            # But OTHER heroes also appear frequently in matchups
            # The trick: the page title/heading should help us identify the main hero

            soup = BeautifulSoup(response.content, "html.parser")

            # Strategy: Look at the FIRST image that appears OUTSIDE of matchup lists
            # Or: Find the ID that appears in a special "hero-portrait" or "hero-header" section

            # For now, let's just show the frequency distribution
            print(f"    Found {len(image_ids)} image references")
            print(f"    Top 3 IDs: {id_counts.most_common(3)}")

            # Try to find a pattern - maybe check CSS background-image or special containers
            # Look for any element that might be a hero portrait
            portrait_patterns = [
                ("div", {"class": re.compile(r"hero.*portrait", re.I)}),
                ("div", {"class": re.compile(r"hero.*header", re.I)}),
                ("div", {"class": re.compile(r"hero.*avatar", re.I)}),
            ]

            for tag, attrs in portrait_patterns:
                elements = soup.find_all(tag, attrs)
                if elements:
                    print(f"    Found potential portrait container: {tag} with {attrs}")
                    for el in elements[:1]:
                        style = el.get("style", "")
                        if "background" in style:
                            print(f"      Style: {style[:100]}")
        else:
            print("    No image IDs found")

        time.sleep(0.3)  # Be nice to server

    except Exception as e:
        print(f"    Error: {e}")

print("\n" + "=" * 70)
print("NOTE: The website likely uses CSS sprites or a different method")
print("Let's try a different approach...")
print("=" * 70)
