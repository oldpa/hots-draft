// Heroes of the Storm - Team Picker App

class DraftManager {
    constructor() {
        this.heroes = [];
        this.maps = [];
        this.heroesData = {}; // Detailed hero data with matchups
        this.selectedMap = null;
        this.draft = {
            blue: {
                bans: [null, null, null],
                picks: [null, null, null, null, null]
            },
            red: {
                bans: [null, null, null],
                picks: [null, null, null, null, null]
            }
        };
        this.currentSelection = null; // { type: 'ban'|'pick', team: 'blue'|'red', slot: number }
        this.searchQuery = '';
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderMaps();
        this.renderDraft();
        this.renderRecommendations();
        this.renderHeroGrid();
    }

    async loadData() {
        try {
            // Load heroes list
            const heroesResponse = await fetch('heroes.json');
            this.heroes = await heroesResponse.json();
            console.log(`Loaded ${this.heroes.length} heroes`);

            // Load detailed hero data (matchups, synergies, etc.)
            const heroesDataResponse = await fetch('all_heroes_data.json');
            this.heroesData = await heroesDataResponse.json();
            console.log(`Loaded detailed data for ${Object.keys(this.heroesData).length} heroes`);

            // Load maps
            const mapsResponse = await fetch('all_maps_data.json');
            const mapsData = await mapsResponse.json();
            this.maps = Object.values(mapsData);
            console.log(`Loaded ${this.maps.length} maps`);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Failed to load game data. Please ensure all JSON files are available.');
        }
    }

    setupEventListeners() {
        // Ban slot clicks
        document.querySelectorAll('.ban-slot-mini').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const team = slot.dataset.team;
                const slotIndex = parseInt(slot.dataset.slot);
                
                // If slot is filled, allow removal
                if (this.draft[team].bans[slotIndex]) {
                    this.draft[team].bans[slotIndex] = null;
                    this.renderDraft();
                    this.renderRecommendations(); // Update recommendations
                } else {
                    // Open hero selection
                    this.currentSelection = { type: 'ban', team, slot: slotIndex };
                    this.showHeroSelection();
                }
            });
        });

        // Pick slot clicks
        document.querySelectorAll('.pick-slot-compact').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const team = slot.dataset.team;
                const slotIndex = parseInt(slot.dataset.slot);
                
                // If slot is filled, allow removal
                if (this.draft[team].picks[slotIndex]) {
                    this.draft[team].picks[slotIndex] = null;
                    this.renderDraft();
                    this.renderRecommendations(); // Update recommendations
                } else {
                    // Open hero selection
                    this.currentSelection = { type: 'pick', team, slot: slotIndex };
                    this.showHeroSelection();
                }
            });
        });

        // Map dropdown
        document.getElementById('map-dropdown').addEventListener('change', (e) => {
            this.selectedMap = e.target.value;
            this.renderRecommendations(); // Update recommendations when map changes
        });

        // Hero search
        document.getElementById('hero-search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderHeroGrid();
        });

        // Cancel selection
        document.getElementById('cancel-selection').addEventListener('click', () => {
            this.hideHeroSelection();
        });

        // Reset draft
        document.getElementById('reset-draft').addEventListener('click', () => {
            this.resetDraft();
        });

        // Close hero selection on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideHeroSelection();
            }
        });
    }

    renderMaps() {
        const mapDropdown = document.getElementById('map-dropdown');
        
        // Clear existing options except the first one (placeholder)
        while (mapDropdown.options.length > 1) {
            mapDropdown.remove(1);
        }

        // Add map options sorted alphabetically
        const sortedMaps = [...this.maps].sort((a, b) => a.name.localeCompare(b.name));
        
        sortedMaps.forEach(map => {
            const option = document.createElement('option');
            option.value = map.slug;
            option.textContent = map.name;
            
            if (this.selectedMap === map.slug) {
                option.selected = true;
            }

            mapDropdown.appendChild(option);
        });
    }

    renderDraft() {
        // Render bans (mini slots)
        ['blue', 'red'].forEach(team => {
            this.draft[team].bans.forEach((hero, index) => {
                const slot = document.querySelector(`.ban-slot-mini[data-team="${team}"][data-slot="${index}"]`);
                slot.innerHTML = '';
                slot.classList.remove('filled');
                
                if (hero) {
                    const img = document.createElement('img');
                    img.src = `images/heroes/${hero.slug}.jpg`;
                    img.alt = hero.name;
                    img.title = hero.name;
                    slot.appendChild(img);
                    slot.classList.add('filled');
                }
            });
        });

        // Render picks (compact horizontal slots)
        ['blue', 'red'].forEach(team => {
            this.draft[team].picks.forEach((hero, index) => {
                const slot = document.querySelector(`.pick-slot-compact[data-team="${team}"][data-slot="${index}"]`);
                slot.innerHTML = '';
                
                if (hero) {
                    const img = document.createElement('img');
                    img.src = `images/heroes/${hero.slug}.jpg`;
                    img.alt = hero.name;
                    img.title = hero.name;
                    slot.appendChild(img);
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'hero-name';
                    nameDiv.textContent = hero.name;
                    slot.appendChild(nameDiv);
                }
            });
        });
    }

    renderHeroGrid() {
        const heroGrid = document.getElementById('hero-grid');
        heroGrid.innerHTML = '';

        // Get banned and picked heroes
        const unavailableHeroes = new Set();
        
        ['blue', 'red'].forEach(team => {
            this.draft[team].bans.forEach(hero => {
                if (hero) unavailableHeroes.add(hero.slug);
            });
            this.draft[team].picks.forEach(hero => {
                if (hero) unavailableHeroes.add(hero.slug);
            });
        });

        // Filter heroes by search query
        const filteredHeroes = this.heroes.filter(hero => {
            if (this.searchQuery && !hero.name.toLowerCase().includes(this.searchQuery)) {
                return false;
            }
            return true;
        });

        // Render hero options
        filteredHeroes.forEach(hero => {
            const heroOption = document.createElement('div');
            heroOption.className = 'hero-option';
            
            if (unavailableHeroes.has(hero.slug)) {
                heroOption.classList.add('disabled');
            }

            const img = document.createElement('img');
            img.src = `images/heroes/${hero.slug}.jpg`;
            img.alt = hero.name;
            img.title = hero.name;

            const nameLabel = document.createElement('div');
            nameLabel.className = 'hero-name-label';
            nameLabel.textContent = hero.name;

            heroOption.appendChild(img);
            heroOption.appendChild(nameLabel);

            if (!unavailableHeroes.has(hero.slug)) {
                heroOption.addEventListener('click', () => {
                    this.selectHero(hero);
                });
            }

            heroGrid.appendChild(heroOption);
        });
    }

    showHeroSelection() {
        const panel = document.getElementById('hero-selection-panel');
        panel.classList.add('active');
        
        // Update title
        const title = document.getElementById('selection-title');
        const { type, team, slot } = this.currentSelection;
        const teamName = team === 'blue' ? 'Team Blue' : 'Team Red';
        const action = type === 'ban' ? 'Ban' : 'Pick';
        title.textContent = `${teamName} - ${action} Hero`;

        // Reset search and focus input
        this.searchQuery = '';
        const searchInput = document.getElementById('hero-search');
        searchInput.value = '';
        
        this.renderHeroGrid();
        
        // Focus the search input (with a small delay to ensure the panel is visible)
        setTimeout(() => {
            searchInput.focus();
        }, 100);
    }

    hideHeroSelection() {
        const panel = document.getElementById('hero-selection-panel');
        panel.classList.remove('active');
        this.currentSelection = null;
    }

    selectHero(hero) {
        if (!this.currentSelection) return;

        const { type, team, slot } = this.currentSelection;
        
        this.draft[team][type + 's'][slot] = hero;
        
        this.hideHeroSelection();
        this.renderDraft();
        this.renderRecommendations(); // Update recommendations after selection
    }

    resetDraft() {
        this.draft = {
            blue: {
                bans: [null, null, null],
                picks: [null, null, null, null, null]
            },
            red: {
                bans: [null, null, null],
                picks: [null, null, null, null, null]
            }
        };
        this.selectedMap = null;
        
        // Reset map dropdown
        const mapDropdown = document.getElementById('map-dropdown');
        mapDropdown.value = '';
        
        this.renderDraft();
        this.renderRecommendations(); // Update recommendations
    }

    getBannedHeroes() {
        const banned = [];
        ['blue', 'red'].forEach(team => {
            this.draft[team].bans.forEach(hero => {
                if (hero) banned.push(hero);
            });
        });
        return banned;
    }

    getPickedHeroes(team) {
        return this.draft[team].picks.filter(h => h !== null);
    }

    getAllPickedHeroes() {
        const picked = [];
        ['blue', 'red'].forEach(team => {
            this.draft[team].picks.forEach(hero => {
                if (hero) picked.push(hero);
            });
        });
        return picked;
    }

    /**
     * Quick pick a hero from recommendations
     */
    quickPick(hero, team) {
        // Find first empty pick slot
        const emptySlotIndex = this.draft[team].picks.findIndex(slot => slot === null);
        if (emptySlotIndex !== -1) {
            this.draft[team].picks[emptySlotIndex] = hero;
            this.renderDraft();
            this.renderRecommendations();
        } else {
            alert(`${team === 'blue' ? 'Blue' : 'Red'} team has no empty pick slots!`);
        }
    }

    /**
     * Quick ban a hero from recommendations
     */
    quickBan(hero, team) {
        // Find first empty ban slot
        const emptySlotIndex = this.draft[team].bans.findIndex(slot => slot === null);
        if (emptySlotIndex !== -1) {
            this.draft[team].bans[emptySlotIndex] = hero;
            this.renderDraft();
            this.renderRecommendations();
        } else {
            alert(`${team === 'blue' ? 'Blue' : 'Red'} team has no empty ban slots!`);
        }
    }

    /**
     * Calculate score for a hero based on map, counters, weaknesses, and synergies
     * @param {string} heroSlug - The slug of the hero to score
     * @param {string} team - 'blue' or 'red'
     * @returns {Object} Score breakdown with total and individual components
     */
    calculateHeroScore(heroSlug, team) {
        const heroData = this.heroesData[heroSlug];
        if (!heroData) {
            return { total: 0, breakdown: {}, tags: [] };
        }

        const enemyTeam = team === 'blue' ? 'red' : 'blue';
        const ownPicks = this.getPickedHeroes(team);
        const enemyPicks = this.getPickedHeroes(enemyTeam);

        const breakdown = {
            map: 0,
            strongAgainst: 0,
            weakAgainst: 0,
            synergy: 0
        };
        const tags = [];

        // 1. Map Score
        if (this.selectedMap && heroData.best_maps) {
            // Find the map name from slug
            const selectedMapData = this.maps.find(m => m.slug === this.selectedMap);
            if (selectedMapData) {
                const mapScore = heroData.best_maps.find(m => m.map === selectedMapData.name);
                if (mapScore && mapScore.score) {
                    // Use the score directly (0-100 scale)
                    breakdown.map = mapScore.score;
                    if (breakdown.map >= 80) {
                        tags.push({ text: `Strong on ${selectedMapData.name}`, score: breakdown.map, type: 'map' });
                    }
                }
            }
        }

        // 2. Strong Against (counters enemy picks)
        if (enemyPicks.length > 0 && heroData.strong_against) {
            let totalScore = 0;
            let matchCount = 0;

            enemyPicks.forEach(enemyHero => {
                const matchup = heroData.strong_against.find(m => m.hero === enemyHero.name);
                if (matchup && matchup.score) {
                    // Score is already 0-100, normalize to center around 50
                    const normalizedScore = matchup.score - 50;
                    totalScore += normalizedScore;
                    matchCount++;

                    if (matchup.score >= 60) { // High counter score
                        tags.push({ 
                            text: `Strong vs ${enemyHero.name}`, 
                            score: matchup.score,
                            type: 'counter' 
                        });
                    }
                }
            });

            if (matchCount > 0) {
                breakdown.strongAgainst = totalScore / matchCount;
            }
        }

        // 3. Weak Against (subtract score for bad matchups)
        if (enemyPicks.length > 0 && heroData.weak_against) {
            let totalScore = 0;
            let matchCount = 0;

            enemyPicks.forEach(enemyHero => {
                const matchup = heroData.weak_against.find(m => m.hero === enemyHero.name);
                if (matchup && matchup.score) {
                    // High score means very weak against this hero
                    // Normalize around 50 and make it negative
                    const normalizedScore = matchup.score - 50;
                    totalScore += normalizedScore;
                    matchCount++;

                    if (matchup.score >= 60) { // High weakness score
                        tags.push({ 
                            text: `Weak vs ${enemyHero.name}`, 
                            score: matchup.score,
                            type: 'weakness' 
                        });
                    }
                }
            });

            if (matchCount > 0) {
                breakdown.weakAgainst = -(totalScore / matchCount); // Negative score
            }
        }

        // 4. Synergy (good with own team)
        if (ownPicks.length > 0 && heroData.good_team_with) {
            let totalScore = 0;
            let matchCount = 0;

            ownPicks.forEach(teammate => {
                const synergy = heroData.good_team_with.find(m => m.hero === teammate.name);
                if (synergy && synergy.score) {
                    // Score is already 0-100, normalize to center around 50
                    const normalizedScore = synergy.score - 50;
                    totalScore += normalizedScore;
                    matchCount++;

                    if (synergy.score >= 60) { // High synergy score
                        tags.push({ 
                            text: `Synergy with ${teammate.name}`, 
                            score: synergy.score,
                            type: 'synergy' 
                        });
                    }
                }
            });

            if (matchCount > 0) {
                breakdown.synergy = totalScore / matchCount;
            }
        }

        // Calculate total score
        const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

        return { total, breakdown, tags };
    }

    /**
     * Get hero recommendations for a team
     * @param {string} team - 'blue' or 'red'
     * @returns {Array} Sorted array of hero recommendations
     */
    getRecommendations(team) {
        // Only show recommendations if we have something to base them on
        const enemyTeam = team === 'blue' ? 'red' : 'blue';
        const hasMap = !!this.selectedMap;
        const hasOwnPicks = this.getPickedHeroes(team).length > 0;
        const hasEnemyPicks = this.getPickedHeroes(enemyTeam).length > 0;
        
        if (!hasMap && !hasOwnPicks && !hasEnemyPicks) {
            return [];
        }

        // Get all unavailable heroes (banned or picked)
        const unavailableHeroes = new Set();
        ['blue', 'red'].forEach(t => {
            this.draft[t].bans.forEach(hero => {
                if (hero) unavailableHeroes.add(hero.slug);
            });
            this.draft[t].picks.forEach(hero => {
                if (hero) unavailableHeroes.add(hero.slug);
            });
        });

        // Calculate scores for all available heroes
        const recommendations = [];
        this.heroes.forEach(hero => {
            if (!unavailableHeroes.has(hero.slug)) {
                const score = this.calculateHeroScore(hero.slug, team);
                // Include hero if it has any non-zero breakdown component
                const hasScore = Object.values(score.breakdown).some(val => val !== 0);
                if (hasScore) {
                    recommendations.push({
                        hero,
                        ...score
                    });
                }
            }
        });

        // Sort by total score (descending)
        recommendations.sort((a, b) => b.total - a.total);

        return recommendations.slice(0, 15); // Top 15 recommendations
    }

    /**
     * Render recommendations for both teams
     */
    renderRecommendations() {
        ['blue', 'red'].forEach(team => {
            const container = document.getElementById(`recommendations-${team}`);
            const recommendations = this.getRecommendations(team);

            if (recommendations.length === 0) {
                container.innerHTML = '<p class="recommendations-placeholder">Select map and heroes for recommendations</p>';
                return;
            }

            container.innerHTML = '';

            recommendations.forEach((rec, index) => {
                const recItem = document.createElement('div');
                recItem.className = 'recommendation-item';

                // Hero image and name
                const heroInfo = document.createElement('div');
                heroInfo.className = 'rec-hero-info';

                const img = document.createElement('img');
                img.src = `images/heroes/${rec.hero.slug}.jpg`;
                img.alt = rec.hero.name;
                img.className = 'rec-hero-img';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'rec-hero-name';
                nameSpan.textContent = rec.hero.name;

                heroInfo.appendChild(img);
                heroInfo.appendChild(nameSpan);

                // Score
                const scoreSpan = document.createElement('span');
                scoreSpan.className = 'rec-score';
                scoreSpan.textContent = rec.total.toFixed(1);
                if (rec.total > 10) scoreSpan.classList.add('high');
                else if (rec.total < 0) scoreSpan.classList.add('negative');

                // Action buttons
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'rec-actions';

                const pickBtn = document.createElement('button');
                pickBtn.className = `rec-btn rec-btn-pick ${team}`;
                pickBtn.textContent = 'Pick';
                pickBtn.title = `Pick ${rec.hero.name} for ${team === 'blue' ? 'Blue' : 'Red'} team`;
                pickBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.quickPick(rec.hero, team);
                });

                const banBtn = document.createElement('button');
                const banningTeam = team === 'blue' ? 'red' : 'blue';
                banBtn.className = `rec-btn rec-btn-ban ${banningTeam}`;
                banBtn.textContent = 'Ban';
                banBtn.title = `Ban ${rec.hero.name} for ${banningTeam === 'blue' ? 'Blue' : 'Red'} team`;
                banBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.quickBan(rec.hero, banningTeam);
                });

                actionsDiv.appendChild(pickBtn);
                actionsDiv.appendChild(banBtn);

                recItem.appendChild(heroInfo);
                recItem.appendChild(scoreSpan);
                recItem.appendChild(actionsDiv);

                // Tags
                if (rec.tags.length > 0) {
                    const tagsContainer = document.createElement('div');
                    tagsContainer.className = 'rec-tags';

                    rec.tags.forEach(tag => {
                        const tagEl = document.createElement('span');
                        tagEl.className = `rec-tag ${tag.type}`;
                        tagEl.textContent = tag.text;
                        tagEl.title = `Score: ${tag.score.toFixed(1)}`;
                        tagsContainer.appendChild(tagEl);
                    });

                    recItem.appendChild(tagsContainer);
                }

                container.appendChild(recItem);
            });
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.draftManager = new DraftManager();
});

