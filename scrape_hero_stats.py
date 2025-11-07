"""
Script to fetch hero statistics from Heroes Profile API.
This fetches global and per-map stats for all heroes and stores them in a single JSON file.

Usage: python scrape_hero_stats.py --api-token YOUR_API_TOKEN
"""

import json
import argparse
import sys
import os
from typing import List, Dict, Optional
import requests
import time


class HeroStatsAPIClient:
    """Client for fetching hero statistics from Heroes Profile API"""

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
        # The API returns a dict with major patches as keys
        if isinstance(patches_data, dict):
            # Check if patches_data directly has major versions as keys
            # Keys should look like "2.55", "2.54", etc.
            potential_major_patches = []

            for key in patches_data.keys():
                # Check if the key looks like a major version (e.g., "2.55")
                if isinstance(key, str) and key.count(".") >= 1:
                    parts = key.split(".")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        potential_major_patches.append(key)

            if potential_major_patches:
                # Sort by version number and get the latest
                latest = sorted(
                    potential_major_patches,
                    key=lambda x: [int(p) for p in x.split(".")],
                )[-1]
                print(f"✓ Latest major patch: {latest}")
                return latest

            # Fallback: check for nested structure
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
        # The API returns a dict like: {"2.55": ["2.55.13.95301", ...], "2.54": [...]}
        # Where the first element in each array is the latest patch

        if isinstance(patches_data, dict):
            # Check if the major patch exists as a key
            if major_patch in patches_data:
                minor_patches_list = patches_data[major_patch]
                if isinstance(minor_patches_list, list) and len(minor_patches_list) > 0:
                    # The first element is the latest
                    latest_minor = minor_patches_list[0]
                    print(f"✓ Latest minor patch for {major_patch}: {latest_minor}")
                    return latest_minor

            # Fallback: try to find patches in nested structure
            if "patches" in patches_data:
                patches_list = patches_data["patches"]
            elif "data" in patches_data:
                patches_list = patches_data["data"]
            else:
                print(f"⚠ No minor patches found for {major_patch}")
                return None

            # If we have a nested structure, check it
            if isinstance(patches_list, dict) and major_patch in patches_list:
                minor_patches_list = patches_list[major_patch]
                if isinstance(minor_patches_list, list) and len(minor_patches_list) > 0:
                    latest_minor = minor_patches_list[0]
                    print(f"✓ Latest minor patch for {major_patch}: {latest_minor}")
                    return latest_minor

        print(f"⚠ No minor patches found for {major_patch}")
        return None

    def fetch_hero_stats(
        self,
        timeframe_type: str,
        timeframe: str,
        game_type: str = "Storm League",
        group_by_map: bool = False,
    ) -> Dict:
        """
        Fetch hero statistics from the API

        Args:
            timeframe_type: "major" or "minor"
            timeframe: Patch version (e.g., "2.47" or "2.47.1.75792")
            game_type: Game type (default: "Storm League")
            group_by_map: Whether to group by map (only works with minor patches)

        Returns:
            Dict of hero statistics
        """
        url = f"{self.BASE_URL}/Heroes/Stats"
        params = {
            "api_token": self.api_token,
            "timeframe_type": timeframe_type,
            "timeframe": timeframe,
            "game_type": game_type,
        }

        # Only add group_by_map for minor patches
        if timeframe_type == "minor":
            params["group_by_map"] = "true" if group_by_map else "false"

        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            return data

        except requests.exceptions.RequestException as e:
            print(f"✗ Error fetching hero stats: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"  Response: {e.response.text[:200]}")
            raise

    def fetch_all_hero_stats(self, game_type: str = "Storm League") -> Dict:
        """
        Fetch all hero statistics (global and per-map)

        Args:
            game_type: Game type to fetch stats for

        Returns:
            Dict containing all hero stats
        """
        print("\n" + "=" * 70)
        print("FETCHING HERO STATISTICS")
        print("=" * 70)

        # Step 1: Get patches
        patches_data = self.fetch_patches()

        # Step 2: Get latest major patch
        major_patch = self.get_latest_major_patch(patches_data)

        # Step 3: Get latest minor patch
        minor_patch = self.get_latest_minor_patch(patches_data, major_patch)

        # Step 4: Fetch global stats (using minor patch if available, otherwise major)
        if minor_patch:
            print(f"\nFetching global stats for {game_type} (patch {minor_patch})...")
            global_stats = self.fetch_hero_stats(
                timeframe_type="minor",
                timeframe=minor_patch,
                game_type=game_type,
                group_by_map=False,
            )
        else:
            print(f"\nFetching global stats for {game_type} (patch {major_patch})...")
            global_stats = self.fetch_hero_stats(
                timeframe_type="major", timeframe=major_patch, game_type=game_type
            )
        print(f"✓ Fetched global stats for {len(global_stats)} heroes")

        # Step 5: Fetch per-map stats (using minor patch)
        map_stats = None
        if minor_patch:
            print(f"\nFetching per-map stats for {game_type} (patch {minor_patch})...")
            try:
                map_stats = self.fetch_hero_stats(
                    timeframe_type="minor",
                    timeframe=minor_patch,
                    game_type=game_type,
                    group_by_map=True,
                )
                print(f"✓ Fetched per-map stats for {len(map_stats)} maps")
            except Exception as e:
                print(f"⚠ Could not fetch per-map stats: {e}")
                print("  Continuing with global stats only...")

        # Step 6: Combine everything
        result = {
            "metadata": {
                "game_type": game_type,
                "major_patch": major_patch,
                "minor_patch": minor_patch,
                "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            },
            "global_stats": global_stats,
        }

        if map_stats:
            result["map_stats"] = map_stats

        return result

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

        print(f"\n✓ Saved hero stats to {filename}")
        print(f"  File size: {size_mb:.2f} MB")


def main():
    """Main function to run the scraper"""
    parser = argparse.ArgumentParser(
        description="Fetch hero statistics from Heroes Profile API"
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
        default="data/hero_stats.json",
        help="Output filename (default: data/hero_stats.json)",
    )
    parser.add_argument(
        "--game-type",
        "-g",
        default="Storm League",
        help="Game type to fetch (default: Storm League)",
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
    print("HEROES PROFILE API - HERO STATISTICS SCRAPER")
    print("=" * 70)
    print(f"Game Type: {args.game_type}")
    print(f"Output: {args.output}")

    # Initialize client
    client = HeroStatsAPIClient(args.api_token)

    # Fetch all stats
    hero_stats = client.fetch_all_hero_stats(game_type=args.game_type)

    # Save to file
    client.save_to_json(hero_stats, args.output)

    # Print summary
    print("\n" + "=" * 70)
    print("COMPLETE!")
    print("=" * 70)
    print(f"Total heroes with global stats: {len(hero_stats.get('global_stats', {}))}")
    if "map_stats" in hero_stats:
        print(f"Total maps with stats: {len(hero_stats['map_stats'])}")
    print(f"\nData saved to: {args.output}")
    print("\nYou can now use this data in your frontend application!")


if __name__ == "__main__":
    main()
