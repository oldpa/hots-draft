"""
Script to scrape matchup data for all Heroes of the Storm heroes
"""

import json
import time
from typing import Dict, List
from scrape_hero_details import HeroDetailsScraper


def load_heroes_list(filename: str = "heroes.json") -> List[Dict]:
    """Load the list of heroes from JSON file"""
    with open(filename, "r", encoding="utf-8") as f:
        return json.load(f)


def scrape_all_heroes(
    output_file: str = "all_heroes_data.json",
    delay: float = 1.0,
    resume_from: str = None,
):
    """
    Scrape matchup data for all heroes

    Args:
        output_file: Output filename for the combined data
        delay: Delay in seconds between requests (be nice to the server)
        resume_from: Hero slug to resume from (if interrupted)
    """
    # Load the list of heroes
    heroes_list = load_heroes_list()
    print(f"Found {len(heroes_list)} heroes to scrape")

    # Initialize scraper
    scraper = HeroDetailsScraper()

    # Storage for all hero data
    all_heroes_data = {}

    # Track progress
    total = len(heroes_list)
    failed_heroes = []

    # Find starting index if resuming
    start_idx = 0
    if resume_from:
        for i, hero in enumerate(heroes_list):
            if hero["slug"] == resume_from:
                start_idx = i
                print(f"Resuming from {resume_from} (index {start_idx})")
                break

    # Scrape each hero
    for idx, hero in enumerate(heroes_list[start_idx:], start=start_idx):
        hero_slug = hero["slug"]
        hero_name = hero["name"]

        print(f"\n[{idx+1}/{total}] Scraping {hero_name} ({hero_slug})...")

        try:
            # Scrape the hero data
            hero_data = scraper.scrape_hero_matchups(hero_slug)

            # Store in our collection
            all_heroes_data[hero_slug] = hero_data

            print(f"  ✓ Successfully scraped {hero_name}")

            # Save progress after each hero (in case of interruption)
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(all_heroes_data, f, indent=2, ensure_ascii=False)

            # Be nice to the server - add delay between requests
            if idx < total - 1:  # Don't delay after the last one
                time.sleep(delay)

        except Exception as e:
            print(f"  ✗ Failed to scrape {hero_name}: {str(e)}")
            failed_heroes.append(
                {"slug": hero_slug, "name": hero_name, "error": str(e)}
            )
            # Continue with next hero
            continue

    # Final save
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_heroes_data, f, indent=2, ensure_ascii=False)

    # Print summary
    print("\n" + "=" * 70)
    print("SCRAPING COMPLETE!")
    print("=" * 70)
    print(f"Successfully scraped: {len(all_heroes_data)} heroes")
    print(f"Failed: {len(failed_heroes)} heroes")
    print(f"Output file: {output_file}")

    if failed_heroes:
        print("\nFailed heroes:")
        for hero in failed_heroes:
            print(f"  - {hero['name']} ({hero['slug']}): {hero['error']}")

    # Generate statistics
    print_statistics(all_heroes_data)


def print_statistics(data: Dict):
    """Print statistics about the scraped data"""
    print("\n" + "=" * 70)
    print("STATISTICS")
    print("=" * 70)

    total_heroes = len(data)
    total_strong_matchups = sum(len(h.get("strong_against", [])) for h in data.values())
    total_weak_matchups = sum(len(h.get("weak_against", [])) for h in data.values())
    total_team_matchups = sum(len(h.get("good_team_with", [])) for h in data.values())
    total_map_rankings = sum(len(h.get("best_maps", [])) for h in data.values())

    print(f"Total heroes scraped: {total_heroes}")
    print(f"Total 'strong against' matchups: {total_strong_matchups}")
    print(f"Total 'weak against' matchups: {total_weak_matchups}")
    print(f"Total 'good team with' matchups: {total_team_matchups}")
    print(f"Total map rankings: {total_map_rankings}")

    avg_strong = total_strong_matchups / total_heroes if total_heroes > 0 else 0
    avg_weak = total_weak_matchups / total_heroes if total_heroes > 0 else 0
    avg_team = total_team_matchups / total_heroes if total_heroes > 0 else 0

    print(f"\nAverages per hero:")
    print(f"  Strong against: {avg_strong:.1f}")
    print(f"  Weak against: {avg_weak:.1f}")
    print(f"  Good team with: {avg_team:.1f}")


def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Scrape all Heroes of the Storm hero data"
    )
    parser.add_argument(
        "--output",
        "-o",
        default="all_heroes_data.json",
        help="Output filename (default: all_heroes_data.json)",
    )
    parser.add_argument(
        "--delay",
        "-d",
        type=float,
        default=1.0,
        help="Delay between requests in seconds (default: 1.0)",
    )
    parser.add_argument(
        "--resume",
        "-r",
        type=str,
        default=None,
        help="Resume from a specific hero slug (e.g., 'abathur')",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("HEROES OF THE STORM - SCRAPING ALL HEROES")
    print("=" * 70)
    print(f"Output file: {args.output}")
    print(f"Delay between requests: {args.delay}s")
    if args.resume:
        print(f"Resuming from: {args.resume}")
    print()

    # Run the scraper
    scrape_all_heroes(
        output_file=args.output, delay=args.delay, resume_from=args.resume
    )


if __name__ == "__main__":
    main()
