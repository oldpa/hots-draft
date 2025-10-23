# Heroes of the Storm - Team Picker Web App

A modern, interactive web-based team picker tool for Heroes of the Storm draft phase.

## ✨ Features

- **Map Selection**: Choose from all 16 available maps
- **Ban Phase**: 3 bans per team (6 total)
- **Pick Phase**: 5 picks per team (10 total)
- **Hero Selection**: Browse all 85 heroes with portraits
- **Search & Filter**: Find heroes quickly by name
- **Click to Remove**: Click any ban or pick to remove it
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Local Development

1. Make sure you have the required files in the same directory:

   - `index.html`
   - `styles.css`
   - `app.js`
   - `heroes.json`
   - `all_maps_data.json`
   - `images/heroes/` (directory with all hero portraits)

2. Start a local web server:

   ```bash
   python3 -m http.server 8000
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

### Deploy to GitHub Pages

1. Create a new GitHub repository

2. Push these files to the repository:

   ```bash
   git init
   git add index.html styles.css app.js heroes.json all_maps_data.json images/
   git commit -m "Initial commit: Heroes of the Storm Team Picker"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

3. Enable GitHub Pages:

   - Go to your repository settings
   - Navigate to "Pages" section
   - Select "main" branch as source
   - Click "Save"

4. Your app will be live at:
   ```
   https://<username>.github.io/<repository-name>/
   ```

## 📖 How to Use

### Select a Map

Click on any map name to select it for your draft.

### Ban Heroes

1. Click on an empty ban slot for either team
2. Browse or search for a hero
3. Click the hero to ban them
4. Click a filled ban slot to remove the ban

### Pick Heroes

1. Click on an empty pick slot for either team
2. Browse or search for a hero
3. Click the hero to pick them for that team
4. Click a filled pick slot to remove the pick

### Search & Filter

- Use the search box to find heroes by name
- Use role filters to narrow down hero selection (coming soon)
- Heroes that are already banned or picked are grayed out

### Reset Draft

Click the "Reset Draft" button to clear all bans, picks, and map selection.

## 🎨 UI Features

- **Color-coded Teams**: Blue and Red team headers and accents
- **Visual Feedback**: Hover effects, highlights, and smooth transitions
- **Banned Heroes**: Displayed with a red X overlay
- **Picked Heroes**: Show hero portrait and name
- **Dark Theme**: Easy on the eyes during long draft sessions

## 🔧 Customization

### Adding Hero Roles

To enable role filtering, add a `role` field to `heroes.json`:

```json
{
  "name": "Abathur",
  "slug": "abathur",
  "url": "...",
  "role": "support"
}
```

### Styling Changes

Edit `styles.css` to customize:

- Colors (see CSS variables in `:root`)
- Layout and spacing
- Fonts and sizes
- Animations and transitions

### Adding Features

Edit `app.js` to add:

- Draft order enforcement
- Hero recommendations
- Counter-pick suggestions
- Team synergy analysis

## 📱 Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

## 🐛 Known Issues

- Role filters are not yet functional (requires role data in heroes.json)
- No draft order enforcement (you can pick in any order)

## 🚧 Future Enhancements

- [ ] Draft order (alternating picks)
- [ ] Hero recommendations based on map
- [ ] Counter-pick suggestions
- [ ] Team synergy calculator
- [ ] Save/load draft compositions
- [ ] Share draft via URL
- [ ] Hero statistics integration

## 📝 License

This is a fan-made tool. Heroes of the Storm™ is a trademark of Blizzard Entertainment, Inc.
