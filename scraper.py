"""
Heroes of the Storm Data Scraper
Fetches hero data from heroescounters.com
"""

import requests
from bs4 import BeautifulSoup
import json
from typing import List, Dict
import re


class HeroScraper:
    """Scraper for Heroes of the Storm data from heroescounters.com"""

    BASE_URL = "https://www.heroescounters.com"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )

    def fetch_hero_list(self) -> List[Dict[str, str]]:
        """
        Fetch the list of all heroes from the homepage

        Returns:
            List of dictionaries containing hero information
        """
        print("Fetching hero list from homepage...")
        response = self.session.get(self.BASE_URL)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Find all links to hero pages
        hero_links = soup.find_all("a", href=re.compile(r"^/hero/"))

        heroes = []
        seen_slugs = set()

        for link in hero_links:
            href = link.get("href")
            if not href:
                continue

            slug = href.replace("/hero/", "")

            # Skip duplicates (e.g., Cho and Gall both link to chogall)
            if slug in seen_slugs:
                continue
            seen_slugs.add(slug)

            # Extract hero name from link text
            text = link.get_text(strip=True)
            hero_name = text.replace(" counterpicks", "")

            # Format the name properly if it's empty or unclear
            if not hero_name:
                hero_name = self._format_hero_name(slug)

            heroes.append(
                {"name": hero_name, "slug": slug, "url": f"{self.BASE_URL}{href}"}
            )

        print(f"Found {len(heroes)} heroes")
        return heroes

    def _format_hero_name(self, slug: str) -> str:
        """
        Convert a slug to a properly formatted hero name

        Args:
            slug: The URL slug (e.g., 'li-ming', 'anubarak')

        Returns:
            Formatted hero name (e.g., 'Li-Ming', 'Anub\'arak')
        """
        # Special cases
        special_cases = {
            "anubarak": "Anub'arak",
            "chogall": "Cho'gall",
            "dva": "D.Va",
            "etc": "E.T.C.",
            "guldan": "Gul'dan",
            "kaelthas": "Kael'thas",
            "kelthuzad": "Kel'Thuzad",
            "li-ming": "Li-Ming",
            "lili": "Li Li",
            "ltmorales": "Lt. Morales",
            "lucio": "Lúcio",
            "malganis": "Mal'Ganis",
            "sgthammer": "Sgt. Hammer",
            "thebutcher": "The Butcher",
            "thelostvikings": "The Lost Vikings",
            "zuljin": "Zul'jin",
        }

        if slug in special_cases:
            return special_cases[slug]

        # Default: capitalize first letter of each word
        return slug.replace("-", " ").title()

    def save_to_json(self, data: List[Dict], filename: str = "heroes.json"):
        """
        Save hero data to a JSON file

        Args:
            data: List of hero dictionaries
            filename: Output filename
        """
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(data)} heroes to {filename}")


def main():
    """Main function to run the scraper"""
    scraper = HeroScraper()

    # Fetch hero list
    heroes = scraper.fetch_hero_list()

    # Save to JSON
    scraper.save_to_json(heroes)

    # Print summary
    print("\nSample heroes:")
    for hero in heroes[:10]:
        print(f"  - {hero['name']} ({hero['slug']})")
    print(f"  ... and {len(heroes) - 10} more")


if __name__ == "__main__":
    main()
