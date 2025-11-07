"""
Script to fetch hero data from Heroes Profile API and merge with existing data.
Usage: python scrape_heroes_profile.py --api-token YOUR_API_TOKEN
"""

import json
import argparse
import sys
from typing import List, Dict, Optional
import requests


class HeroesProfileScraper:
    """Scraper for Heroes Profile API"""

    BASE_URL = "https://api.heroesprofile.com/api"

    def __init__(self, api_token: str):
        """
        Initialize the scraper with API token

        Args:
            api_token: Your Heroes Profile API token
        """
        self.api_token = api_token
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )

    def fetch_heroes(self) -> List[Dict]:
        """
        Fetch all heroes from the Heroes Profile API

        Returns:
            List of hero dictionaries from the API
        """
        print("Fetching heroes from Heroes Profile API...")

        url = f"{self.BASE_URL}/Heroes"
        params = {"api_token": self.api_token}

        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()

            data = response.json()

            # Debug: Print the structure of the response
            print(f"\n[DEBUG] Response type: {type(data)}")
            if isinstance(data, dict):
                print(
                    f"[DEBUG] Dict keys: {list(data.keys())[:5]}..."
                )  # Show first 5 keys
                print(f"[DEBUG] Total keys in dict: {len(data)}")
                # Show a sample entry
                if data:
                    first_key = list(data.keys())[0]
                    print(f"[DEBUG] Sample entry [{first_key}]: {data[first_key]}")
            elif isinstance(data, list):
                print(f"[DEBUG] List length: {len(data)}")
                if data:
                    print(f"[DEBUG] First item: {data[0]}")

            # Parse the response based on its structure
            heroes = []

            if isinstance(data, list):
                # Direct list of heroes
                heroes = data
            elif isinstance(data, dict):
                # Check for common wrapper keys
                if "heroes" in data:
                    heroes_data = data["heroes"]
                    if isinstance(heroes_data, list):
                        heroes = heroes_data
                    elif isinstance(heroes_data, dict):
                        # Convert dict to list
                        heroes = list(heroes_data.values())
                elif "data" in data:
                    heroes_data = data["data"]
                    if isinstance(heroes_data, list):
                        heroes = heroes_data
                    elif isinstance(heroes_data, dict):
                        # Convert dict to list
                        heroes = list(heroes_data.values())
                else:
                    # The dict itself might be a map of hero_name/id -> hero_data
                    # Check if the values look like hero objects
                    if data:
                        first_value = next(iter(data.values()))
                        # If the first value is a dict (likely a hero object), treat as hero map
                        if isinstance(first_value, dict):
                            print(
                                "[DEBUG] Detected dict of heroes, converting to list..."
                            )
                            heroes = list(data.values())
                        else:
                            # Single hero object?
                            heroes = [data]

            print(f"\n✓ Successfully fetched {len(heroes)} heroes from API")
            return heroes

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                print("✗ Authentication failed. Please check your API token.")
                print("  Get your API token from: https://api.heroesprofile.com/")
            else:
                print(f"✗ HTTP error occurred: {e}")
            sys.exit(1)
        except requests.exceptions.RequestException as e:
            print(f"✗ Error fetching data from API: {e}")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"✗ Error parsing API response: {e}")
            sys.exit(1)

    def load_existing_heroes(self, filename: str = "heroes.json") -> List[Dict]:
        """
        Load existing heroes from JSON file

        Args:
            filename: Path to the heroes JSON file

        Returns:
            List of existing hero dictionaries
        """
        try:
            with open(filename, "r", encoding="utf-8") as f:
                heroes = json.load(f)
                print(f"Loaded {len(heroes)} heroes from existing {filename}")
                return heroes
        except FileNotFoundError:
            print(f"No existing {filename} found. Starting fresh.")
            return []
        except json.JSONDecodeError as e:
            print(f"✗ Error parsing existing {filename}: {e}")
            return []

    def merge_heroes(
        self, api_heroes: List[Dict], existing_heroes: List[Dict]
    ) -> List[Dict]:
        """
        Merge API heroes with existing heroes data

        Strategy:
        - Keep all existing hero data
        - Add new heroes from API that don't exist in the current list
        - Update existing heroes with new fields from API (but preserve existing fields)

        Args:
            api_heroes: Heroes fetched from the API
            existing_heroes: Existing heroes from JSON file

        Returns:
            Merged list of heroes
        """
        print("\nMerging hero data...")

        # Create a lookup dict for existing heroes (by slug and name)
        existing_by_slug = {}
        existing_by_name = {}

        for hero in existing_heroes:
            slug = hero.get("slug", "").lower()
            name = hero.get("name", "").lower()
            if slug:
                existing_by_slug[slug] = hero
            if name:
                existing_by_name[name] = hero

        # Track what we add
        added_heroes = []
        updated_heroes = []

        # Process API heroes
        for api_hero in api_heroes:
            # Extract identifying information from API hero
            # API might use different field names
            api_name = (
                api_hero.get("name")
                or api_hero.get("hero_name")
                or api_hero.get("hero")
                or ""
            ).strip()

            api_slug = (
                api_hero.get("slug")
                or api_hero.get("hero_slug")
                or self._name_to_slug(api_name)
            ).lower()

            if not api_name or not api_slug:
                continue

            # Check if hero exists
            existing_hero = existing_by_slug.get(api_slug) or existing_by_name.get(
                api_name.lower()
            )

            if existing_hero:
                # Hero exists - merge new fields
                merged = existing_hero.copy()

                # Add any new fields from API that don't exist
                for key, value in api_hero.items():
                    if key not in merged and value is not None:
                        merged[key] = value
                        updated_heroes.append(api_name)

                # Update the entry
                if api_slug in existing_by_slug:
                    existing_by_slug[api_slug] = merged
                elif api_name.lower() in existing_by_name:
                    existing_by_name[api_name.lower()] = merged
            else:
                # New hero - add it
                new_hero = {
                    "name": api_name,
                    "slug": api_slug,
                }

                # Add all other fields from API
                for key, value in api_hero.items():
                    if key not in ["name", "slug"] and value is not None:
                        new_hero[key] = value

                # Add to existing collections
                existing_by_slug[api_slug] = new_hero
                existing_by_name[api_name.lower()] = new_hero
                added_heroes.append(api_name)
                print(f"  + Adding new hero: {api_name}")

        # Merge and deduplicate
        merged_heroes = list(existing_by_slug.values())

        # Sort by name
        merged_heroes.sort(key=lambda h: h.get("name", "").lower())

        print(f"\n✓ Merge complete!")
        print(f"  Total heroes: {len(merged_heroes)}")
        print(f"  New heroes added: {len(added_heroes)}")
        if added_heroes:
            for name in added_heroes:
                print(f"    - {name}")

        return merged_heroes

    def _name_to_slug(self, name: str) -> str:
        """
        Convert a hero name to a slug

        Args:
            name: Hero name

        Returns:
            Slug version of the name
        """
        # Remove special characters and convert to lowercase
        slug = name.lower()
        slug = slug.replace("'", "")
        slug = slug.replace(".", "")
        slug = slug.replace(" ", "")

        # Special cases
        slug_map = {
            "dva": "dva",
            "etc": "etc",
            "choGall": "chogall",
            "liming": "li-ming",
            "lili": "lili",
            "ltmorales": "ltmorales",
            "sgthammer": "sgthammer",
            "thebutcher": "thebutcher",
            "thelostvikings": "thelostvikings",
        }

        return slug_map.get(slug, slug)

    def save_to_json(self, data: List[Dict], filename: str = "heroes.json"):
        """
        Save hero data to a JSON file

        Args:
            data: List of hero dictionaries
            filename: Output filename
        """
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Saved {len(data)} heroes to {filename}")


def main():
    """Main function to run the scraper"""
    parser = argparse.ArgumentParser(
        description="Fetch heroes from Heroes Profile API and merge with existing data"
    )
    parser.add_argument(
        "--api-token",
        "-t",
        type=str,
        help="Your Heroes Profile API token (get it from https://api.heroesprofile.com/)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="heroes.json",
        help="Output filename (default: heroes.json)",
    )
    parser.add_argument(
        "--input",
        "-i",
        default="heroes.json",
        help="Input filename to merge with (default: heroes.json)",
    )

    args = parser.parse_args()

    # Check for API token
    if not args.api_token:
        env_token = None
        try:
            from dotenv import load_dotenv

            load_dotenv()
        except ImportError:
            pass  # If python-dotenv isn't installed, just skip loading .env file

        import os

        env_token = os.environ.get("HEROES_PROFILE_TOKEN")
        if env_token and not args.api_token:
            args.api_token = env_token

    print("=" * 70)
    print("HEROES PROFILE API - HEROES SCRAPER")
    print("=" * 70)

    # Initialize scraper
    scraper = HeroesProfileScraper(args.api_token)

    # Fetch from API
    api_heroes = scraper.fetch_heroes()

    # Load existing data
    existing_heroes = scraper.load_existing_heroes(args.input)

    # Merge
    merged_heroes = scraper.merge_heroes(api_heroes, existing_heroes)

    # Save
    scraper.save_to_json(merged_heroes, args.output)

    print("\n" + "=" * 70)
    print("COMPLETE!")
    print("=" * 70)


if __name__ == "__main__":
    main()
