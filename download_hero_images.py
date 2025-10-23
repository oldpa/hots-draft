"""
Script to download hero images from heroescounters.com
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import time
import re
from typing import Dict, List
from pathlib import Path


class HeroImageDownloader:
    """Download hero images from heroescounters.com"""

    BASE_URL = "https://www.heroescounters.com"

    def __init__(self, output_dir: str = "images/heroes"):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
        )
        self.output_dir = output_dir

        # Create output directory if it doesn't exist
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

        # Cache for hero name to slug mapping
        self.hero_slug_map = {}

    def load_heroes_list(self, filename: str = "heroes.json") -> List[Dict]:
        """Load the list of heroes from JSON file"""
        with open(filename, "r", encoding="utf-8") as f:
            heroes = json.load(f)

        # Build slug map for quick lookups
        for hero in heroes:
            # Normalize name for matching (handle special characters)
            normalized_name = (
                hero["name"].lower().replace("'", "").replace(".", "").replace(" ", "")
            )
            self.hero_slug_map[normalized_name] = hero["slug"]
            # Also add the exact name
            self.hero_slug_map[hero["name"]] = hero["slug"]

        return heroes

    def fetch_hero_image_mapping(self) -> Dict[str, str]:
        """
        Fetch mapping of hero slugs to image URLs from the team picker page

        Returns:
            Dictionary mapping hero slug to image URL
        """
        url = f"{self.BASE_URL}/teampicker"
        print(f"Fetching hero images from {url}...")

        response = self.session.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        # Find all hero elements with data-hero and data-heroname
        hero_elements = soup.find_all("div", class_="teampickerlist-hero")

        slug_to_image = {}

        for element in hero_elements:
            hero_name = element.get("data-heroname")
            img = element.find("img")

            if hero_name and img:
                img_src = img.get("src")

                # Match hero name to slug
                slug = self._match_hero_name_to_slug(hero_name)

                if slug and img_src:
                    # Make URL absolute
                    if img_src.startswith("/"):
                        img_src = self.BASE_URL + img_src

                    slug_to_image[slug] = img_src

        print(f"Found images for {len(slug_to_image)} heroes")
        return slug_to_image

    def _match_hero_name_to_slug(self, hero_name: str) -> str:
        """
        Match a hero name from the website to our hero slug

        Args:
            hero_name: Hero name as it appears on the website

        Returns:
            Hero slug or None if not found
        """
        # Try exact match first
        if hero_name in self.hero_slug_map:
            return self.hero_slug_map[hero_name]

        # Try normalized match
        normalized = (
            hero_name.lower().replace("'", "").replace(".", "").replace(" ", "")
        )
        if normalized in self.hero_slug_map:
            return self.hero_slug_map[normalized]

        # Try some common variations
        variations = [
            hero_name.lower(),
            hero_name.lower().replace(" ", "-"),
            hero_name.lower().replace(" ", ""),
            hero_name.lower().replace("'", ""),
        ]

        for var in variations:
            for name, slug in self.hero_slug_map.items():
                if var in name.lower() or name.lower() in var:
                    return slug

        print(f"    Warning: Could not match hero name '{hero_name}' to a slug")
        return None

    def download_image(self, image_url: str, output_path: str) -> bool:
        """
        Download an image from URL and save to file

        Args:
            image_url: URL of the image
            output_path: Local path to save the image

        Returns:
            True if successful, False otherwise
        """
        try:
            response = self.session.get(image_url, timeout=10)
            response.raise_for_status()

            # Write the image content to file
            with open(output_path, "wb") as f:
                f.write(response.content)

            return True
        except Exception as e:
            print(f"    Error downloading image: {str(e)}")
            return False

    def download_all_hero_images(self):
        """
        Download images for all heroes from the team picker page
        """
        # Load heroes list to build slug map
        heroes_list = self.load_heroes_list()

        print(f"Loaded {len(heroes_list)} heroes from heroes.json")

        # Fetch the image mapping from team picker page
        slug_to_image = self.fetch_hero_image_mapping()

        if not slug_to_image:
            print("Error: No hero images found on team picker page")
            return

        print(f"\nDownloading images...")
        print(f"Output directory: {self.output_dir}\n")

        total = len(slug_to_image)
        successful = 0
        failed = []

        for idx, (slug, image_url) in enumerate(slug_to_image.items()):
            # Find hero name for display
            hero_name = next(
                (h["name"] for h in heroes_list if h["slug"] == slug), slug
            )

            print(f"[{idx+1}/{total}] {hero_name} ({slug})...")
            print(f"    URL: {image_url}")

            try:
                # Determine file extension
                ext = ".jpg"
                if ".png" in image_url.lower():
                    ext = ".png"
                elif ".webp" in image_url.lower():
                    ext = ".webp"

                # Create output path
                output_path = os.path.join(self.output_dir, f"{slug}{ext}")

                # Download the image
                success = self.download_image(image_url, output_path)

                if success:
                    print(f"    ✓ Saved to {output_path}")
                    successful += 1
                else:
                    print(f"    ✗ Failed to download")
                    failed.append({"slug": slug, "name": hero_name})

            except Exception as e:
                print(f"    ✗ Error: {str(e)}")
                failed.append({"slug": slug, "name": hero_name})

        # Print summary
        print("\n" + "=" * 70)
        print("DOWNLOAD COMPLETE!")
        print("=" * 70)
        print(f"Successfully downloaded: {successful}/{total} images")
        print(f"Failed: {len(failed)} images")

        if failed:
            print("\nFailed heroes:")
            for hero in failed:
                print(f"  - {hero['name']} ({hero['slug']})")

        print(f"\nImages saved to: {self.output_dir}/")


def main():
    """Main function to run the image downloader"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Download hero images from heroescounters.com team picker page"
    )
    parser.add_argument(
        "--output",
        "-o",
        default="images/heroes",
        help="Output directory for images (default: images/heroes)",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("HEROES OF THE STORM - DOWNLOADING HERO IMAGES")
    print("=" * 70)
    print(f"Output directory: {args.output}")
    print()

    # Run the downloader
    downloader = HeroImageDownloader(output_dir=args.output)
    downloader.download_all_hero_images()


if __name__ == "__main__":
    main()
