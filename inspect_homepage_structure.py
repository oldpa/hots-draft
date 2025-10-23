"""Inspect the homepage structure to find hero images"""

import requests
from bs4 import BeautifulSoup
import re

url = "https://www.heroescounters.com"
response = requests.get(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    },
)

soup = BeautifulSoup(response.content, "html.parser")

print("=" * 70)
print("FINDING HERO IMAGE STRUCTURE ON HOMEPAGE")
print("=" * 70)

# Look for the hero list container
hero_containers = soup.find_all("div", class_=re.compile(r"hero"))

print(f"\nFound {len(hero_containers)} elements with 'hero' in class name")

# Let's look at the first few
for i, container in enumerate(hero_containers[:3]):
    print(f"\n[{i+1}] Container classes: {container.get('class')}")

    # Find links in this container
    links = container.find_all("a", href=re.compile(r"/hero/"))
    if links:
        print(f"    Links found: {len(links)}")
        for link in links[:2]:
            print(f"      - {link.get('href')} : {link.get_text(strip=True)}")

    # Find images in this container
    imgs = container.find_all("img")
    if imgs:
        print(f"    Images found: {len(imgs)}")
        for img in imgs[:2]:
            print(f"      - src: {img.get('src')}")
            print(f"        alt: {img.get('alt')}")

print("\n" + "=" * 70)
print("LOOKING FOR ALL IMAGES")
print("=" * 70)

all_imgs = soup.find_all("img")
print(f"\nTotal images on page: {len(all_imgs)}")

# Filter for hero images
hero_imgs = [
    img for img in all_imgs if img.get("src") and "/images/heroes/" in img.get("src")
]
print(f"Hero images (containing /images/heroes/): {len(hero_imgs)}")

if hero_imgs:
    print("\nFirst 5 hero images:")
    for i, img in enumerate(hero_imgs[:5]):
        src = img.get("src")
        alt = img.get("alt", "")

        # Try to find associated hero link
        parent = img.parent
        hero_link = None

        # Check if parent or nearby element has a hero link
        for _ in range(3):  # Check up to 3 levels up
            if parent:
                link = parent.find("a", href=re.compile(r"/hero/"))
                if link:
                    hero_link = link.get("href")
                    break
                parent = parent.parent

        print(f"\n  [{i+1}] {src}")
        print(f"      alt: {alt}")
        print(f"      hero link: {hero_link}")
