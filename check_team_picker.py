"""Check the Team Picker page for hero images"""

import requests
from bs4 import BeautifulSoup
import re

url = "https://www.heroescounters.com/teampicker"
response = requests.get(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    },
)

soup = BeautifulSoup(response.content, "html.parser")

print("=" * 70)
print("TEAM PICKER PAGE - HERO IMAGES")
print("=" * 70)

# Find all images
all_imgs = soup.find_all("img")
print(f"\nTotal images: {len(all_imgs)}")

# Filter for hero images
hero_imgs = [
    img for img in all_imgs if img.get("src") and "/images/heroes/" in img.get("src")
]
print(f"Hero images: {len(hero_imgs)}")

if hero_imgs:
    print("\nFirst 10 hero images:")
    for i, img in enumerate(hero_imgs[:10]):
        src = img.get("src")
        alt = img.get("alt", "")
        data_attrs = {k: v for k, v in img.attrs.items() if k.startswith("data-")}

        # Try to find associated hero info
        parent = img.parent
        hero_info = None

        # Check for data attributes
        if data_attrs:
            hero_info = data_attrs

        # Check parent for data attributes
        if parent and not hero_info:
            parent_data = {
                k: v for k, v in parent.attrs.items() if k.startswith("data-")
            }
            if parent_data:
                hero_info = parent_data

        print(f"\n  [{i+1}] {src}")
        if alt:
            print(f"      alt: {alt}")
        if hero_info:
            print(f"      data: {hero_info}")

# Look for hero selection elements
print("\n" + "=" * 70)
print("HERO SELECTION ELEMENTS")
print("=" * 70)

hero_elements = soup.find_all(attrs={"data-hero": True})
if hero_elements:
    print(f"\nFound {len(hero_elements)} elements with data-hero attribute")
    for i, el in enumerate(hero_elements[:5]):
        print(f"\n[{i+1}] {el.name}")
        print(f"    data-hero: {el.get('data-hero')}")
        print(f"    class: {el.get('class')}")

        # Check if it has an image
        img = el.find("img")
        if img:
            print(f"    img src: {img.get('src')}")

# Check for any JavaScript data
print("\n" + "=" * 70)
print("CHECKING FOR HERO DATA IN SCRIPTS")
print("=" * 70)

scripts = soup.find_all("script")
for i, script in enumerate(scripts):
    if script.string and "hero" in script.string.lower()[:500]:
        print(f"\n[Script {i+1}] (first 300 chars):")
        print(script.string[:300])
