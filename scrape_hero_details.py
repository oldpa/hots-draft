"""
Script to scrape detailed hero matchup data from heroescounters.com
"""

import requests
from bs4 import BeautifulSoup
import json
import re
from typing import Dict, List, Optional


class HeroDetailsScraper:
    """Scraper for detailed hero matchup data"""

    BASE_URL = "https://www.heroescounters.com"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )

    def scrape_hero_matchups(self, hero_slug: str) -> Dict:
        """
        Scrape matchup data for a specific hero

        Args:
            hero_slug: The hero's URL slug (e.g., 'abathur')

        Returns:
            Dictionary containing matchup data
        """
        url = f"{self.BASE_URL}/hero/{hero_slug}"
        print(f"Fetching data for {hero_slug} from {url}...")

        response = self.session.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Extract hero name from page title or heading
        hero_name = self._extract_hero_name(soup)

        # Extract all matchups at once and then separate them
        # Use raw HTML text instead of BeautifulSoup string conversion
        all_matchups = self._extract_all_matchups(response.text)

        # Extract map rankings (bonus data)
        best_maps = self._extract_map_rankings(soup)

        return {
            "slug": hero_slug,
            "name": hero_name,
            "strong_against": all_matchups.get("strong_against", []),
            "weak_against": all_matchups.get("weak_against", []),
            "good_team_with": all_matchups.get("good_team_with", []),
            "best_maps": best_maps,
        }

    def _extract_hero_name(self, soup: BeautifulSoup) -> str:
        """Extract the hero name from the page"""
        # Look for the main hero heading
        heading = soup.find("h1")
        if heading:
            return heading.get_text(strip=True)
        return "Unknown"

    def _extract_all_matchups(self, html_text: str) -> Dict[str, List[Dict]]:
        """
        Extract all matchup data and separate by category

        Args:
            html_text: Raw HTML text of the page

        Returns:
            Dictionary with keys: strong_against, weak_against, good_team_with
        """
        result = {"strong_against": [], "weak_against": [], "good_team_with": []}

        # The page has TWO complete sets of data (All time votes vs Last patch votes)
        # We need to extract only the FIRST set to avoid duplicates

        # Find ALL occurrences of each section
        import re

        strong_positions = [
            m.start() for m in re.finditer(r"strong against", html_text)
        ]
        weak_positions = [m.start() for m in re.finditer(r"weak against", html_text)]
        team_positions = [m.start() for m in re.finditer(r"good team with", html_text)]

        # Use the FIRST occurrence of each section
        # And limit each section to end BEFORE the SECOND occurrence of the same type
        # or at the start of the next section type

        pattern = r'<strong>(\d+)</strong>points.*?href="/hero/[^"]+">([^<]+)</a>.*?Agree\s*\((\d+)\).*?Disagree\s*\((\d+)\)'

        # Extract strong_against (first occurrence until first weak_against)
        if len(strong_positions) > 0 and len(weak_positions) > 0:
            strong_section = html_text[strong_positions[0] : weak_positions[0]]
            result["strong_against"] = self._parse_matchup_section(
                strong_section, pattern
            )

        # Extract weak_against (first occurrence until first good_team_with)
        if len(weak_positions) > 0 and len(team_positions) > 0:
            weak_section = html_text[weak_positions[0] : team_positions[0]]
            result["weak_against"] = self._parse_matchup_section(weak_section, pattern)

        # Extract good_team_with (first occurrence until second strong_against OR map section)
        if len(team_positions) > 0:
            # End at the second strong_against (start of second tab), or map section
            if len(strong_positions) > 1:
                team_end = strong_positions[1]  # Second tab starts here
            else:
                # Fallback to map section or reasonable chunk
                map_marker = html_text.find("Best maps for", team_positions[0])
                team_end = map_marker if map_marker > 0 else team_positions[0] + 50000

            team_section = html_text[team_positions[0] : team_end]
            result["good_team_with"] = self._parse_matchup_section(
                team_section, pattern
            )

        print(f"  Found {len(result['strong_against'])} strong against matchups")
        print(f"  Found {len(result['weak_against'])} weak against matchups")
        print(f"  Found {len(result['good_team_with'])} good team with matchups")

        return result

    def _parse_matchup_section(self, html_section: str, pattern: str) -> List[Dict]:
        """Parse matchups from an HTML section"""
        matchups = []
        seen = set()

        # Find all matches in this section - use DOTALL so . matches newlines
        for match in re.finditer(pattern, html_section, re.IGNORECASE | re.DOTALL):
            score = int(match.group(1))
            hero_name = match.group(2).strip()
            agree = int(match.group(3))
            disagree = int(match.group(4))

            # Clean up hero name - remove HTML tags
            hero_name = re.sub(r"<[^>]+>", "", hero_name)
            hero_name = hero_name.strip()

            # Filter out invalid entries
            if (
                len(hero_name) > 0
                and len(hero_name) < 50
                and not re.search(
                    r"Vote|points|can be|Best maps", hero_name, re.IGNORECASE
                )
            ):

                # Use hero name + score as unique key
                key = f"{hero_name}_{score}_{agree}_{disagree}"
                if key not in seen:
                    seen.add(key)
                    matchups.append(
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
        matchups.sort(key=lambda x: x["score"], reverse=True)

        return matchups

    def _extract_map_rankings(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract map rankings for the hero"""
        maps = []

        # Find the "Best maps for" section
        headers = soup.find_all(string=re.compile(r"Best maps for", re.IGNORECASE))

        if not headers:
            return maps

        for header in headers:
            parent = header.find_parent()
            if parent:
                container = parent.find_next_sibling()
                if container:
                    maps = self._parse_map_container(container)
                    if maps:
                        break

        print(f"  Found {len(maps)} map rankings")
        return maps

    def _parse_map_container(self, container) -> List[Dict]:
        """Parse map ranking data from a container element"""
        maps = []

        items = container.find_all(["li", "div"], recursive=True)

        for item in items:
            text = item.get_text(strip=True)

            # Pattern: "89points Cursed Hollow Agree (1208) Disagree (130)"
            score_match = re.search(r"(\d+)\s*points?", text)
            agree_match = re.search(r"Agree\s*\((\d+)\)", text)
            disagree_match = re.search(r"Disagree\s*\((\d+)\)", text)

            if score_match and agree_match and disagree_match:
                score = int(score_match.group(1))
                agree = int(agree_match.group(1))
                disagree = int(disagree_match.group(1))

                # Extract map name
                name_text = re.sub(r"\d+\s*points?", "", text)
                name_match = re.search(r"(.+?)\s*Agree", name_text)
                if name_match:
                    map_name = name_match.group(1).strip()

                    maps.append(
                        {
                            "map": map_name,
                            "score": score,
                            "agree": agree,
                            "disagree": disagree,
                        }
                    )

        # Sort by score (descending)
        maps.sort(key=lambda x: x["score"], reverse=True)

        return maps

    def save_to_json(self, data: Dict, filename: str):
        """Save hero matchup data to JSON file"""
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved data to {filename}")


def main():
    """Test the scraper with Abathur"""
    scraper = HeroDetailsScraper()

    # Scrape Abathur's matchup data
    abathur_data = scraper.scrape_hero_matchups("abathur")

    # Save to JSON
    scraper.save_to_json(abathur_data, "abathur_matchups.json")

    # Print summary
    print("\n" + "=" * 60)
    print(f"Hero: {abathur_data['name']}")
    print("=" * 60)

    print(f"\nStrong against ({len(abathur_data['strong_against'])} heroes):")
    for matchup in abathur_data["strong_against"][:5]:
        print(
            f"  {matchup['score']:3d} pts - {matchup['hero']:20s} ({matchup['agree']:3d}/{matchup['disagree']:3d} votes)"
        )

    print(f"\nWeak against ({len(abathur_data['weak_against'])} heroes):")
    for matchup in abathur_data["weak_against"][:5]:
        print(
            f"  {matchup['score']:3d} pts - {matchup['hero']:20s} ({matchup['agree']:3d}/{matchup['disagree']:3d} votes)"
        )

    print(f"\nGood team with ({len(abathur_data['good_team_with'])} heroes):")
    for matchup in abathur_data["good_team_with"][:5]:
        print(
            f"  {matchup['score']:3d} pts - {matchup['hero']:20s} ({matchup['agree']:3d}/{matchup['disagree']:3d} votes)"
        )

    print(f"\nBest maps ({len(abathur_data['best_maps'])} maps):")
    for map_data in abathur_data["best_maps"][:5]:
        print(f"  {map_data['score']:3d} pts - {map_data['map']}")


if __name__ == "__main__":
    main()
