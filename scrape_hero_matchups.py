"""
Script to fetch hero matchup data from Heroes Profile API.
This fetches ally and enemy matchup statistics for all heroes.

Usage: python scrape_hero_matchups.py --api-token YOUR_API_TOKEN
"""

import json
import argparse
import sys
import os
from typing import List, Dict, Optional
import requests
import time


class HeroMatchupsAPIClient:
    """Client for fetching hero matchup data from Heroes Profile API"""

    BASE_URL = "https://api.heroesprofile.com/api"

    def __init__(self, api_token: str):
        """
        Initialize the API client with token

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

    def fetch_patches(self) -> Dict:
        """
        Fetch available patches from the API

        Returns:
            Dict containing patch information
        """
        print("Fetching patches from API...")

        url = f"{self.BASE_URL}/Patches"
        params = {"api_token": self.api_token}

        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            print(f"✓ Successfully fetched patches")
            return data

        except requests.exceptions.RequestException as e:
            print(f"✗ Error fetching patches: {e}")
            sys.exit(1)

    def get_latest_major_patch(self, patches_data: Dict) -> str:
        """
        Extract the latest major patch from patches data

        Args:
            patches_data: Patches data from the API
                Expected format: {"2.55": [...], "2.54": [...], ...}

        Returns:
            Latest major patch string (e.g., "2.55")
        """
        if isinstance(patches_data, dict):
            potential_major_patches = []

            for key in patches_data.keys():
                if isinstance(key, str) and key.count(".") >= 1:
                    parts = key.split(".")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        potential_major_patches.append(key)

            if potential_major_patches:
                latest = sorted(
                    potential_major_patches,
                    key=lambda x: [int(p) for p in x.split(".")],
                )[-1]
                print(f"✓ Latest major patch: {latest}")
                return latest

            if "patches" in patches_data:
                return self.get_latest_major_patch(patches_data["patches"])
            elif "data" in patches_data:
                return self.get_latest_major_patch(patches_data["data"])

        print("✗ Could not find any major patches")
        sys.exit(1)

    def get_latest_minor_patch(self, patches_data: Dict, major_patch: str) -> str:
        """
        Get the latest minor patch for a given major patch

        Args:
            patches_data: Patches data from the API
            major_patch: Major patch version (e.g., "2.55")

        Returns:
            Latest minor patch string (e.g., "2.55.13.95301")
        """
        if isinstance(patches_data, dict):
            if major_patch in patches_data:
                minor_patches_list = patches_data[major_patch]
                if isinstance(minor_patches_list, list) and len(minor_patches_list) > 0:
                    latest_minor = minor_patches_list[0]
                    print(f"✓ Latest minor patch for {major_patch}: {latest_minor}")
                    return latest_minor

            if "patches" in patches_data:
                patches_list = patches_data["patches"]
            elif "data" in patches_data:
                patches_list = patches_data["data"]
            else:
                print(f"⚠ No minor patches found for {major_patch}")
                return None

            if isinstance(patches_list, dict) and major_patch in patches_list:
                minor_patches_list = patches_list[major_patch]
                if isinstance(minor_patches_list, list) and len(minor_patches_list) > 0:
                    latest_minor = minor_patches_list[0]
                    print(f"✓ Latest minor patch for {major_patch}: {latest_minor}")
                    return latest_minor

        print(f"⚠ No minor patches found for {major_patch}")
        return None

    def load_heroes_list(self, heroes_file: str = "heroes.json") -> List[Dict]:
        """
        Load heroes list from JSON file

        Args:
            heroes_file: Path to heroes JSON file

        Returns:
            List of hero dictionaries
        """
        try:
            with open(heroes_file, "r", encoding="utf-8") as f:
                heroes = json.load(f)
                print(f"✓ Loaded {len(heroes)} heroes from {heroes_file}")
                return heroes
        except FileNotFoundError:
            print(f"✗ Could not find {heroes_file}")
            print(
                "  Please run scrape_heroes_profile.py first to fetch the heroes list"
            )
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"✗ Error parsing {heroes_file}: {e}")
            sys.exit(1)

    def fetch_hero_matchups(
        self,
        hero_name: str,
        timeframe_type: str,
        timeframe: str,
        game_type: str = "Storm League",
    ) -> Dict:
        """
        Fetch matchup data for a specific hero and transpose enemy data

        The API returns enemy matchup data from the opponent's perspective.
        For example, when querying Abathur vs Alarak:
        - API returns: Alarak's win rate against Abathur
        - We want: Abathur's win rate against Alarak

        This function transposes the enemy data to be from the queried hero's perspective.

        Args:
            hero_name: Full hero name (e.g., "Abathur")
            timeframe_type: "major" or "minor"
            timeframe: Patch version
            game_type: Game type (default: "Storm League")

        Returns:
            Dict of matchup data for the hero (with transposed enemy data)
        """
        url = f"{self.BASE_URL}/Heroes/Matchups"
        params = {
            "api_token": self.api_token,
            "timeframe_type": timeframe_type,
            "timeframe": timeframe,
            "game_type": game_type,
            "hero": hero_name,
        }

        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            # The API returns: {"HeroName": { matchups }}
            # Extract just the matchup data for this hero
            matchups = None
            if isinstance(data, dict) and hero_name in data:
                matchups = data[hero_name]
            else:
                matchups = data

            # Transpose enemy data to be from this hero's perspective
            if matchups:
                matchups = self._transpose_enemy_data(matchups)

            return matchups

        except requests.exceptions.RequestException as e:
            print(f"  ✗ Error fetching matchups for {hero_name}: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"    Response: {e.response.text[:200]}")
            raise

    def _transpose_enemy_data(self, matchups: Dict) -> Dict:
        """
        Transpose enemy matchup data from opponent's perspective to hero's perspective

        API returns opponent's stats against the hero, but we want the hero's stats
        against the opponent. This means:
        - Our wins = opponent's losses (enemy.losses_against)
        - Our losses = opponent's wins (enemy.wins_against)
        - Our win rate = 100 - opponent's win rate

        Args:
            matchups: Raw matchup data from API

        Returns:
            Matchups with transposed enemy data
        """
        transposed = {}

        for opponent_name, matchup in matchups.items():
            ally_data = matchup.get("ally", {})
            enemy_data = matchup.get("enemy", {})

            # Ally data is already from our perspective, keep as-is
            new_ally = {
                "wins_with": ally_data.get("wins_with", "0"),
                "losses_with": ally_data.get("losses_with", "0"),
                "win_rate_as_ally": ally_data.get("win_rate_as_ally", "50.0"),
            }

            # Enemy data needs to be transposed
            # What API gives us:
            # - wins_against: opponent's wins against us
            # - losses_against: opponent's losses against us
            # - win_rate_against: opponent's win rate against us
            #
            # What we want:
            # - wins_against: our wins against opponent (= their losses)
            # - losses_against: our losses against opponent (= their wins)
            # - win_rate_against: our win rate against opponent (= 100 - their rate)

            opponent_wins = int(enemy_data.get("wins_against", 0))
            opponent_losses = int(enemy_data.get("losses_against", 0))
            opponent_wr = float(enemy_data.get("win_rate_against", 50.0))

            # Transpose
            our_wins = opponent_losses
            our_losses = opponent_wins
            our_wr = 100.0 - opponent_wr

            new_enemy = {
                "wins_against": str(our_wins),
                "losses_against": str(our_losses),
                "win_rate_against": f"{our_wr:.2f}",
            }

            transposed[opponent_name] = {
                "ally": new_ally,
                "enemy": new_enemy,
            }

        return transposed

    def fetch_all_hero_matchups(
        self,
        game_type: str = "Storm League",
        heroes_file: str = "heroes.json",
        output_file: str = "data/hero_matchups.json",
        delay: float = 0.5,
    ) -> Dict:
        """
        Fetch matchup data for all heroes

        Args:
            game_type: Game type to fetch matchups for
            heroes_file: Path to heroes JSON file
            output_file: Output filename
            delay: Delay between API requests in seconds

        Returns:
            Dict containing all hero matchups
        """
        print("\n" + "=" * 70)
        print("FETCHING HERO MATCHUPS")
        print("=" * 70)

        # Step 1: Get patches
        patches_data = self.fetch_patches()
        major_patch = self.get_latest_major_patch(patches_data)
        minor_patch = self.get_latest_minor_patch(patches_data, major_patch)

        if not minor_patch:
            print("✗ Could not get minor patch, cannot fetch matchups")
            sys.exit(1)

        # Step 2: Load heroes list
        heroes_list = self.load_heroes_list(heroes_file)

        # Step 3: Fetch matchups for each hero
        print(f"\nFetching matchups for {len(heroes_list)} heroes...")
        print(f"Game Type: {game_type}")
        print(f"Patch: {minor_patch}")
        print(f"Delay between requests: {delay}s")
        print()

        all_matchups = {}
        failed_heroes = []
        total = len(heroes_list)

        # Try to load existing data for resuming
        if os.path.exists(output_file):
            try:
                with open(output_file, "r", encoding="utf-8") as f:
                    existing_data = json.load(f)
                    if "matchups" in existing_data:
                        all_matchups = existing_data["matchups"]
                        print(f"✓ Loaded existing data with {len(all_matchups)} heroes")
                        print(f"  Will skip already fetched heroes\n")
            except:
                pass

        for idx, hero in enumerate(heroes_list, start=1):
            hero_name = hero.get("name", "")
            hero_slug = hero.get("slug", "")

            if not hero_name:
                continue

            # Skip if already fetched
            if hero_name in all_matchups:
                print(f"[{idx}/{total}] Skipping {hero_name} (already fetched)")
                continue

            print(f"[{idx}/{total}] Fetching matchups for {hero_name}...")

            try:
                matchups = self.fetch_hero_matchups(
                    hero_name=hero_name,
                    timeframe_type="minor",
                    timeframe=minor_patch,
                    game_type=game_type,
                )

                all_matchups[hero_name] = matchups
                print(f"  ✓ Fetched {len(matchups)} matchups")

                # Save progress after each hero
                self.save_progress(
                    all_matchups, output_file, game_type, major_patch, minor_patch
                )

                # Delay between requests to be nice to the server
                if idx < total:
                    time.sleep(delay)

            except Exception as e:
                print(f"  ✗ Failed to fetch matchups for {hero_name}")
                failed_heroes.append({"name": hero_name, "error": str(e)})
                continue

        # Final result
        result = {
            "metadata": {
                "game_type": game_type,
                "major_patch": major_patch,
                "minor_patch": minor_patch,
                "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                "total_heroes": len(all_matchups),
            },
            "matchups": all_matchups,
        }

        # Print summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"Successfully fetched: {len(all_matchups)} heroes")
        print(f"Failed: {len(failed_heroes)} heroes")

        if failed_heroes:
            print("\nFailed heroes:")
            for hero in failed_heroes:
                print(f"  - {hero['name']}: {hero['error']}")

        return result

    def save_progress(
        self,
        matchups_data: Dict,
        filename: str,
        game_type: str,
        major_patch: str,
        minor_patch: str,
    ):
        """
        Save progress to file

        Args:
            matchups_data: Current matchups data
            filename: Output filename
            game_type: Game type
            major_patch: Major patch version
            minor_patch: Minor patch version
        """
        # Ensure directory exists
        directory = os.path.dirname(filename)
        if directory and not os.path.exists(directory):
            os.makedirs(directory)

        data = {
            "metadata": {
                "game_type": game_type,
                "major_patch": major_patch,
                "minor_patch": minor_patch,
                "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
                "total_heroes": len(matchups_data),
            },
            "matchups": matchups_data,
        }

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def save_to_json(self, data: Dict, filename: str):
        """
        Save data to a JSON file

        Args:
            data: Data to save
            filename: Output filename
        """
        # Ensure directory exists
        directory = os.path.dirname(filename)
        if directory and not os.path.exists(directory):
            os.makedirs(directory)

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        # Get file size for display
        file_size = os.path.getsize(filename)
        size_mb = file_size / (1024 * 1024)

        print(f"\n✓ Saved hero matchups to {filename}")
        print(f"  File size: {size_mb:.2f} MB")


def main():
    """Main function to run the scraper"""
    parser = argparse.ArgumentParser(
        description="Fetch hero matchup data from Heroes Profile API"
    )
    parser.add_argument(
        "--api-token",
        "-t",
        type=str,
        help="Your Heroes Profile API token",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="data/hero_matchups.json",
        help="Output filename (default: data/hero_matchups.json)",
    )
    parser.add_argument(
        "--game-type",
        "-g",
        default="Storm League",
        help="Game type to fetch (default: Storm League)",
    )
    parser.add_argument(
        "--heroes-file",
        "-f",
        default="heroes.json",
        help="Heroes list file (default: heroes.json)",
    )
    parser.add_argument(
        "--delay",
        "-d",
        type=float,
        default=0.5,
        help="Delay between API requests in seconds (default: 0.5)",
    )

    args = parser.parse_args()

    # Check for API token
    if not args.api_token:
        # Try to load from environment
        env_token = None
        try:
            from dotenv import load_dotenv

            load_dotenv()
        except ImportError:
            pass

        env_token = os.environ.get("HEROES_PROFILE_TOKEN")
        if env_token and not args.api_token:
            args.api_token = env_token

    if not args.api_token:
        print("Error: API token is required!")
        print("\nUsage: python scrape_hero_matchups.py --api-token YOUR_API_TOKEN")
        print("\nOr set HEROES_PROFILE_TOKEN in your .env file")
        print("Get your API token from: https://api.heroesprofile.com/")
        sys.exit(1)

    print("=" * 70)
    print("HEROES PROFILE API - HERO MATCHUPS SCRAPER")
    print("=" * 70)
    print(f"Game Type: {args.game_type}")
    print(f"Heroes File: {args.heroes_file}")
    print(f"Output: {args.output}")
    print(f"Delay: {args.delay}s")

    # Initialize client
    client = HeroMatchupsAPIClient(args.api_token)

    # Fetch all matchups
    hero_matchups = client.fetch_all_hero_matchups(
        game_type=args.game_type,
        heroes_file=args.heroes_file,
        output_file=args.output,
        delay=args.delay,
    )

    # Save to file
    client.save_to_json(hero_matchups, args.output)

    # Print final summary
    print("\n" + "=" * 70)
    print("COMPLETE!")
    print("=" * 70)
    print(f"Total heroes with matchups: {len(hero_matchups.get('matchups', {}))}")
    print(f"\nData saved to: {args.output}")
    print("\nYou can now use this data in your frontend application!")


if __name__ == "__main__":
    main()
