"""Find hero image IDs by looking at CSS or data attributes"""

import requests
from bs4 import BeautifulSoup
import re
import json

url = "https://www.heroescounters.com"
response = requests.get(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    },
)

soup = BeautifulSoup(response.content, "html.parser")
html_text = response.text

print("=" * 70)
print("SEARCHING FOR HERO IMAGE PATTERNS")
print("=" * 70)

# Look for the hero list container
hero_list = soup.find("div", class_="home-heroes-list")

if hero_list:
    print("\nFound home-heroes-list container")

    # Get all hero links
    hero_links = hero_list.find_all("a", href=re.compile(r"^/hero/"))
    print(f"Found {len(hero_links)} hero links")

    # Examine the structure of first few links
    print("\nFirst 5 hero link structures:")
    for i, link in enumerate(hero_links[:5]):
        href = link.get("href")
        slug = href.replace("/hero/", "")

        # Get all attributes
        attrs = link.attrs

        # Check parent
        parent = link.parent
        parent_attrs = parent.attrs if parent else {}

        print(f"\n[{i+1}] {slug}")
        print(f"    href: {href}")
        print(f"    link attrs: {attrs}")
        print(f"    parent: {parent.name if parent else 'None'}")
        print(f"    parent attrs: {parent_attrs}")

        # Look for style attributes or data attributes
        style = link.get("style", "")
        if style:
            print(f"    style: {style}")

        if parent:
            parent_style = parent.get("style", "")
            if parent_style:
                print(f"    parent style: {parent_style}")

# Search for patterns in raw HTML that might indicate hero IDs
print("\n" + "=" * 70)
print("SEARCHING FOR HERO ID MAPPING IN HTML")
print("=" * 70)

# Look for JavaScript variable assignments or data structures
patterns = [
    r"heroes\s*=\s*(\{[^}]+\})",
    r"heroData\s*=\s*(\{[^}]+\})",
    r"HEROES\s*=\s*(\{[^}]+\})",
    r'"abathur"[:\s]+(\d+)',
    r"abathur[:\s]+(\d+)",
]

for pattern in patterns:
    matches = re.findall(pattern, html_text, re.IGNORECASE)
    if matches:
        print(f"\nPattern '{pattern}' found:")
        for match in matches[:3]:
            print(f"  {match[:100]}")

# Check if there's a mapping in inline scripts
scripts = soup.find_all("script")
print(f"\n\nFound {len(scripts)} script tags")

for i, script in enumerate(scripts):
    script_text = script.string
    if script_text and (
        "hero" in script_text.lower() or "abathur" in script_text.lower()
    ):
        print(f"\n[Script {i+1}] Contains 'hero' or 'abathur':")
        # Show first 500 chars
        print(script_text[:500])
