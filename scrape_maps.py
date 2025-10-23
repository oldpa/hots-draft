"""
Script to scrape map data and hero performance on each map from heroescounters.com
"""

import requests
from bs4 import BeautifulSoup
import json
import re
from typing import Dict, List
import time


class MapScraper:
    """Scraper for map data from heroescounters.com"""

    BASE_URL = "https://www.heroescounters.com"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )

    def fetch_map_list(self) -> List[Dict[str, str]]:
        """
        Fetch the list of all maps from the maps page

        Returns:
            List of dictionaries containing map information
        """
        url = f"{self.BASE_URL}/map"
        print(f"Fetching map list from {url}...")

        response = self.session.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Find all links to map pages
        # Pattern: href="/map/mapname"
        map_links = soup.find_all("a", href=re.compile(r"^/map/[^/]+$"))

        maps = []
        seen_slugs = set()

        for link in map_links:
            href = link.get("href")
            if not href or href == "/map":
                continue

            slug = href.replace("/map/", "")

            # Skip duplicates
            if slug in seen_slugs:
                continue
            seen_slugs.add(slug)

            # Extract map name from link text or slug
            map_name = link.get_text(strip=True)
            # Remove "View best heroes" suffix if present
            map_name = re.sub(
                r"\s*View best heroes\s*$", "", map_name, flags=re.IGNORECASE
            )

            if not map_name:
                map_name = self._format_map_name(slug)

            maps.append(
                {"name": map_name, "slug": slug, "url": f"{self.BASE_URL}{href}"}
            )

        print(f"Found {len(maps)} maps")
        return maps

    def _format_map_name(self, slug: str) -> str:
        """
        Convert a slug to a properly formatted map name

        Args:
            slug: The URL slug (e.g., 'battlefieldofeternity')

        Returns:
            Formatted map name (e.g., 'Battlefield of Eternity')
        """
        # Special cases
        special_cases = {
            "blackheartssbay": "Blackheart's Bay",
            "dragonshire": "Dragon Shire",
        }

        if slug in special_cases:
            return special_cases[slug]

        # Split camelCase or run-together words and capitalize
        # Simple approach: insert space before capitals
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", slug)
        return name.title()

    def scrape_map_heroes(self, map_slug: str) -> Dict:
        """
        Scrape hero performance data for a specific map

        Args:
            map_slug: The map's URL slug (e.g., 'battlefieldofeternity')

        Returns:
            Dictionary containing map and hero performance data
        """
        url = f"{self.BASE_URL}/map/{map_slug}"
        print(f"  Fetching data from {url}...")

        response = self.session.get(url)
        response.raise_for_status()

        html_text = response.text
        soup = BeautifulSoup(response.content, "html.parser")

        # Extract map name from page
        map_name = self._extract_map_name(soup)

        # Extract hero performance data
        heroes = self._extract_map_hero_data(html_text)

        return {
            "slug": map_slug,
            "name": map_name,
            "heroes": heroes,
            "total_heroes": len(heroes),
        }

    def _extract_map_name(self, soup: BeautifulSoup) -> str:
        """Extract the map name from the page"""
        # Look for the main heading
        heading = soup.find("h1")
        if heading:
            return heading.get_text(strip=True)
        return "Unknown"

    def _extract_map_hero_data(self, html_text: str) -> List[Dict]:
        """
        Extract hero performance data from the map page

        Args:
            html_text: Raw HTML text of the page

        Returns:
            List of hero performance dictionaries
        """
        heroes = []
        seen = set()

        # Pattern: <strong>SCORE</strong>points ... href="/hero/X">HERO_NAME</a> ... Agree (X) Disagree (Y)
        # Similar to hero matchups but for maps
        pattern = r'<strong>(\d+)</strong>points.*?href="/hero/[^"]+">([^<]+)</a>.*?Agree\s*\((\d+)\).*?Disagree\s*\((\d+)\)'

        # Find all hero entries on the page
        for match in re.finditer(pattern, html_text, re.IGNORECASE | re.DOTALL):
            score = int(match.group(1))
            hero_name = match.group(2).strip()
            agree = int(match.group(3))
            disagree = int(match.group(4))

            # Clean up hero name
            hero_name = re.sub(r"<[^>]+>", "", hero_name)
            hero_name = hero_name.strip()

            # Filter out invalid entries
            if len(hero_name) > 0 and len(hero_name) < 50:
                # Use hero name + score as unique key
                key = f"{hero_name}_{score}_{agree}_{disagree}"
                if key not in seen:
                    seen.add(key)
                    heroes.append(
                        {
                            "hero": hero_name,
                            "score": score,
                            "agree": agree,
                            "disagree": disagree,
                            "total_votes": agree + disagree,
                            "agreement_percentage": (
                                round(agree / (agree + disagree) * 100, 1)
                                if (agree + disagree) > 0
                                else 0
                            ),
                        }
                    )

        # Sort by score descending
        heroes.sort(key=lambda x: x["score"], reverse=True)

        print(f"    Found {len(heroes)} heroes")
        return heroes

    def save_to_json(self, data: Dict, filename: str):
        """Save map data to JSON file"""
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved data to {filename}")


def scrape_all_maps(output_file: str = "all_maps_data.json", delay: float = 0.5):
    """
    Scrape all maps and their hero performance data

    Args:
        output_file: Output filename
        delay: Delay between requests in seconds
    """
    scraper = MapScraper()

    # Fetch the list of maps
    maps_list = scraper.fetch_map_list()

    # Storage for all map data
    all_maps_data = {}
    failed_maps = []

    total = len(maps_list)

    # Scrape each map
    for idx, map_info in enumerate(maps_list):
        map_slug = map_info["slug"]
        map_name = map_info["name"]

        print(f"\n[{idx+1}/{total}] Scraping {map_name} ({map_slug})...")

        try:
            # Scrape the map data
            map_data = scraper.scrape_map_heroes(map_slug)

            # Store in our collection
            all_maps_data[map_slug] = map_data

            print(f"  ✓ Successfully scraped {map_name}")

            # Save progress after each map
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(all_maps_data, f, indent=2, ensure_ascii=False)

            # Be nice to the server
            if idx < total - 1:
                time.sleep(delay)

        except Exception as e:
            print(f"  ✗ Failed to scrape {map_name}: {str(e)}")
            failed_maps.append({"slug": map_slug, "name": map_name, "error": str(e)})
            continue

    # Final save
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_maps_data, f, indent=2, ensure_ascii=False)

    # Print summary
    print("\n" + "=" * 70)
    print("SCRAPING COMPLETE!")
    print("=" * 70)
    print(f"Successfully scraped: {len(all_maps_data)} maps")
    print(f"Failed: {len(failed_maps)} maps")
    print(f"Output file: {output_file}")

    if failed_maps:
        print("\nFailed maps:")
        for map_data in failed_maps:
            print(f"  - {map_data['name']} ({map_data['slug']}): {map_data['error']}")

    # Generate statistics
    print_statistics(all_maps_data)


def print_statistics(data: Dict):
    """Print statistics about the scraped map data"""
    print("\n" + "=" * 70)
    print("STATISTICS")
    print("=" * 70)

    total_maps = len(data)
    total_hero_entries = sum(len(m.get("heroes", [])) for m in data.values())

    print(f"Total maps scraped: {total_maps}")
    print(f"Total hero performance entries: {total_hero_entries}")

    avg_heroes = total_hero_entries / total_maps if total_maps > 0 else 0
    print(f"Average heroes per map: {avg_heroes:.1f}")

    # Show sample data
    if data:
        print("\nSample map data:")
        sample_map = list(data.values())[0]
        print(f"  Map: {sample_map['name']}")
        print(f"  Total heroes: {sample_map['total_heroes']}")
        if sample_map["heroes"]:
            top_hero = sample_map["heroes"][0]
            print(f"  Top hero: {top_hero['hero']} ({top_hero['score']} pts)")


def main():
    """Main function to run the map scraper"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Scrape all Heroes of the Storm map data"
    )
    parser.add_argument(
        "--output",
        "-o",
        default="all_maps_data.json",
        help="Output filename (default: all_maps_data.json)",
    )
    parser.add_argument(
        "--delay",
        "-d",
        type=float,
        default=0.5,
        help="Delay between requests in seconds (default: 0.5)",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("HEROES OF THE STORM - SCRAPING ALL MAPS")
    print("=" * 70)
    print(f"Output file: {args.output}")
    print(f"Delay between requests: {args.delay}s")
    print()

    # Run the scraper
    scrape_all_maps(output_file=args.output, delay=args.delay)


if __name__ == "__main__":
    main()
