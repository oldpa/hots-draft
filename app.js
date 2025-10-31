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
        this.playerStats = {
            blue: [],  // Array of player data objects
            red: []
        };
        this.currentSelection = null; // { type: 'ban'|'pick', team: 'blue'|'red', slot: number }
        this.searchQuery = '';
        this.API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : 'https://hots-one.vercel.app'; // Update this with your actual Vercel URL
        
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

        // Add player buttons
        document.querySelectorAll('.fetch-btn-add').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const team = btn.dataset.team;
                const input = document.querySelector(`.battletag-input-add[data-team="${team}"]`);
                const battletag = input.value.trim();
                
                if (battletag) {
                    await this.addPlayerRow(team, battletag);
                    input.value = ''; // Clear input after adding
                }
            });
        });

        // Allow Enter key to add player
        document.querySelectorAll('.battletag-input-add').forEach(input => {
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const team = input.dataset.team;
                    const battletag = input.value.trim();
                    if (battletag) {
                        await this.addPlayerRow(team, battletag);
                        input.value = '';
                    }
                }
            });
        });

        // Paste battletags buttons
        document.querySelectorAll('.paste-battletags-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const team = btn.dataset.team;
                await this.pasteBattletags(team);
            });
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

    /**
     * Fetch stats for a single player and display their top heroes
     * @param {string} team - 'blue' or 'red'
     * @param {number} slot - Player slot (0-4)
     * @param {string} battletag - Player's battle tag
     * @param {HTMLElement} card - The player profile card element
     */
    async fetchSinglePlayerStats(team, slot, battletag, card) {
        const statusDiv = card.querySelector('.profile-status');
        const heroesDiv = card.querySelector('.profile-heroes');
        const fetchBtn = card.querySelector('.fetch-btn-top');
        
        // Show loading state
        statusDiv.className = 'profile-status loading';
        statusDiv.textContent = 'Fetching...';
        statusDiv.style.display = 'block';
        fetchBtn.disabled = true;
        heroesDiv.classList.remove('loaded');
        heroesDiv.innerHTML = '';
        
        try {
            const params = new URLSearchParams({
                battletag: battletag,
                region: '2' // EU region
            });
            
            const response = await fetch(`${this.API_URL}/api/player/heroes?${params}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch data for ${battletag}`);
            }
            
            const data = await response.json();
            
            // Ensure playerStats arrays are initialized
            if (!Array.isArray(this.playerStats[team])) {
                this.playerStats[team] = [];
            }
            
            // Update or add player data at the correct slot
            this.playerStats[team][slot] = {
                battletag: battletag,
                data: data
            };
            
            // Show success status
            statusDiv.className = 'profile-status success';
            statusDiv.textContent = `✓ ${battletag}`;
            
            // Display top 7 heroes
            this.displayPlayerTopHeroes(battletag, data, heroesDiv);
            
            // Update recommendations with new data
            this.renderRecommendations();
            
        } catch (error) {
            console.error(`Error fetching stats for ${battletag}:`, error);
            statusDiv.className = 'profile-status error';
            statusDiv.textContent = `✗ Failed to load`;
        } finally {
            fetchBtn.disabled = false;
        }
    }

    /**
     * Display top 10 heroes for a player in their profile card
     * @param {string} battletag - Player's battle tag
     * @param {Object} playerData - Player's hero data from API
     * @param {HTMLElement} heroesDiv - Container div for hero list
     */
    displayPlayerTopHeroes(battletag, playerData, heroesDiv) {
        // Extract Quick Match and Storm League heroes
        const quickMatch = playerData['Quick Match'] || {};
        const stormLeague = playerData['Storm League'] || {};
        
        // Check if we have any data at all
        if (Object.keys(quickMatch).length === 0 && Object.keys(stormLeague).length === 0) {
            heroesDiv.innerHTML = '<div style="text-align: center; color: #718096; font-size: 0.75rem; padding: 8px;">No game data available</div>';
            heroesDiv.classList.add('loaded');
            return;
        }
        
        // Combine heroes from both game types, taking the best stats
        const heroMap = new Map();
        
        // Helper function to process heroes from a game type
        const processGameType = (gameTypeData, gameTypeName) => {
            for (const [heroName, stats] of Object.entries(gameTypeData)) {
                const mmr = Math.round(stats.mmr || 0);
                const score = ((mmr - 1700) / 1000) * 100;
                
                // If hero already exists, use the higher MMR/score
                if (heroMap.has(heroName)) {
                    const existing = heroMap.get(heroName);
                    if (score > existing.score) {
                        heroMap.set(heroName, {
                            name: heroName,
                            mmr: mmr,
                            games: stats.games_played,
                            score: score,
                            gameType: gameTypeName
                        });
                    }
                } else {
                    heroMap.set(heroName, {
                        name: heroName,
                        mmr: mmr,
                        games: stats.games_played,
                        score: score,
                        gameType: gameTypeName
                    });
                }
            }
        };
        
        // Process both game types
        processGameType(quickMatch, 'QM');
        processGameType(stormLeague, 'SL');
        
        // Convert to array
        let heroList = Array.from(heroMap.values());
        
        // Filter heroes with 25+ games
        const heroesWithMinGames = heroList.filter(h => h.games >= 25);
        
        // If no heroes with 25+ games, fall back to top 3 most played
        let displayList;
        if (heroesWithMinGames.length === 0) {
            // Sort by games played, take top 3
            heroList.sort((a, b) => b.games - a.games);
            displayList = heroList.slice(0, 3);
        } else {
            // Sort by score, take top 10
            heroesWithMinGames.sort((a, b) => b.score - a.score);
            displayList = heroesWithMinGames.slice(0, 10);
        }
        
        if (displayList.length === 0) {
            heroesDiv.innerHTML = '<div style="text-align: center; color: #718096; font-size: 0.75rem; padding: 8px;">No hero data available</div>';
            heroesDiv.classList.add('loaded');
            return;
        }
        
        // Display each hero
        heroesDiv.innerHTML = '';
        displayList.forEach(hero => {
            // Find hero slug for image
            const heroData = this.heroes.find(h => h.name === hero.name);
            const slug = heroData ? heroData.slug : hero.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const card = document.createElement('div');
            card.className = 'hero-stat-card';
            
            card.innerHTML = `
                <div class="hero-stat-tooltip">
                    <div class="tooltip-row">
                        <span class="tooltip-label">MMR:</span>
                        <span class="tooltip-mmr">${hero.mmr}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Games:</span>
                        <span class="tooltip-games">${hero.games}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Type:</span>
                        <span class="tooltip-games">${hero.gameType}</span>
                    </div>
                </div>
                <div class="hero-stat-img-container">
                    <img class="hero-stat-img" src="images/heroes/${slug}.jpg" alt="${hero.name}">
                    <div class="hero-stat-score-overlay">+${hero.score.toFixed(0)}</div>
                </div>
                <div class="hero-stat-name">${hero.name}</div>
            `;
            
            heroesDiv.appendChild(card);
        });
        
        heroesDiv.classList.add('loaded');
    }

    /**
     * Add a new player row dynamically
     * @param {string} team - 'blue' or 'red'
     * @param {string} battletag - Player's battletag
     */
    async addPlayerRow(team, battletag) {
        const container = document.querySelector(`.player-rows-container[data-team="${team}"]`);
        
        // Check if player already exists
        const existingPlayers = this.playerStats[team] || [];
        if (existingPlayers.some(p => p && p.battletag === battletag)) {
            alert('This player is already added!');
            return;
        }

        // Check max 5 players
        if (existingPlayers.filter(p => p).length >= 5) {
            alert('Maximum 5 players per team!');
            return;
        }

        // Create player row element
        const playerRow = document.createElement('div');
        playerRow.className = 'player-row loading';
        playerRow.dataset.battletag = battletag;
        playerRow.innerHTML = `
            <button class="remove-player-btn">Remove</button>
            <div class="player-info">
                <div class="player-battletag">${battletag}</div>
                <div class="player-stats-row">Loading...</div>
            </div>
            <div class="player-heroes-inline"></div>
        `;
        container.appendChild(playerRow);

        // Add remove button handler
        const removeBtn = playerRow.querySelector('.remove-player-btn');
        removeBtn.addEventListener('click', () => {
            this.removePlayerRow(team, battletag);
            playerRow.remove();
        });

        try {
            const params = new URLSearchParams({
                battletag: battletag,
                region: '2' // EU region
            });

            const response = await fetch(`${this.API_URL}/api/player/heroes?${params}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch data for ${battletag}`);
            }

            const data = await response.json();

            // Store player data
            if (!Array.isArray(this.playerStats[team])) {
                this.playerStats[team] = [];
            }
            const slot = this.playerStats[team].findIndex(p => !p);
            if (slot === -1) {
                this.playerStats[team].push({ battletag, data });
            } else {
                this.playerStats[team][slot] = { battletag, data };
            }

            // Calculate player stats
            const stats = this.calculatePlayerStats(data);

            // Update player row
            playerRow.classList.remove('loading');
            const statsRow = playerRow.querySelector('.player-stats-row');
            statsRow.innerHTML = `
                <div class="player-stat">
                    <span class="player-stat-label">${stats.topMode}:</span>
                    <span class="player-stat-value mmr">${stats.mmr} MMR</span>
                </div>
                <div class="player-stat">
                    <span class="player-stat-label">Games:</span>
                    <span class="player-stat-value games">${stats.totalGames}</span>
                </div>
                <div class="player-stat">
                    <span class="player-stat-label">Last 90d:</span>
                    <span class="player-stat-value games">${stats.recent90Games}</span>
                </div>
            `;

            // Display top heroes
            const heroesDiv = playerRow.querySelector('.player-heroes-inline');
            this.displayPlayerTopHeroesInline(data, heroesDiv);

            // Update recommendations
            this.renderRecommendations();

        } catch (error) {
            console.error(`Error fetching stats for ${battletag}:`, error);
            playerRow.classList.remove('loading');
            const statsRow = playerRow.querySelector('.player-stats-row');
            statsRow.innerHTML = '<span style="color: #f56565;">Failed to load</span>';
        }
    }

    /**
     * Remove a player row
     * @param {string} team - 'blue' or 'red'
     * @param {string} battletag - Player's battletag
     */
    removePlayerRow(team, battletag) {
        // Find and remove from playerStats
        if (!Array.isArray(this.playerStats[team])) {
            return;
        }
        const index = this.playerStats[team].findIndex(p => p && p.battletag === battletag);
        if (index !== -1) {
            this.playerStats[team][index] = null;
        }
        // Update recommendations
        this.renderRecommendations();
    }

    /**
     * Paste multiple battletags
     * @param {string} team - 'blue' or 'red'
     */
    async pasteBattletags(team) {
        // Prompt user for battletags
        const input = prompt(
            'Paste battletags (one per line or separated by commas):\n\n' +
            'Example:\n' +
            'Wraysford#2123\n' +
            'Calytras#2456\n' +
            'ASGGSA#1234\n\n' +
            'Or: Wraysford#2123, Calytras#2456, ASGGSA#1234'
        );

        if (!input || !input.trim()) {
            return; // User cancelled
        }

        try {
            // Show loading state
            const pasteBtn = document.querySelector(`.paste-battletags-btn[data-team="${team}"]`);
            const originalText = pasteBtn.textContent;
            pasteBtn.textContent = 'Adding...';
            pasteBtn.disabled = true;

            // Extract battletags using regex
            const battletagRegex = /([A-Za-z][A-Za-z0-9]{2,11})#(\d{4,5})/g;
            const matches = input.matchAll(battletagRegex);
            
            const battletags = new Set();
            for (const match of matches) {
                const battletag = `${match[1]}#${match[2]}`;
                battletags.add(battletag);
            }

            const battletagArray = Array.from(battletags).slice(0, 5); // Limit to 5

            if (battletagArray.length === 0) {
                throw new Error('No valid battletags found. Make sure they are in format: Name#1234');
            }

            console.log(`Found ${battletagArray.length} battletags:`, battletagArray);

            // Add each player
            let successCount = 0;
            let failCount = 0;

            for (const battletag of battletagArray) {
                try {
                    await this.addPlayerRow(team, battletag);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to add ${battletag}:`, error);
                    failCount++;
                }
            }

            // Show result
            let message = `Successfully added ${successCount} player(s)!`;
            if (failCount > 0) {
                message += `\n\n${failCount} player(s) could not be added (may already exist or API error).`;
            }
            alert(message);

            // Restore button state
            pasteBtn.textContent = originalText;
            pasteBtn.disabled = false;

        } catch (error) {
            console.error('Error pasting battletags:', error);
            alert(`Failed to add battletags:\n\n${error.message}`);

            // Restore button state
            const pasteBtn = document.querySelector(`.paste-battletags-btn[data-team="${team}"]`);
            pasteBtn.textContent = 'Paste List';
            pasteBtn.disabled = false;
        }
    }

    /**
     * Calculate overall player stats from player data
     * @param {Object} playerData - Player data from API
     * @returns {Object} Calculated stats
     */
    calculatePlayerStats(playerData) {
        const player_mmr = playerData.player_mmr || {};
        
        // Find game mode with most games in last 90 days
        let topMode = 'QM'; // Default
        let topMMR = 0;
        let maxRecent = 0;

        for (const [mode, stats] of Object.entries(player_mmr)) {
            if (stats.games_played_last_90_days > maxRecent) {
                maxRecent = stats.games_played_last_90_days;
                topMMR = Math.round(stats.mmr || 0);
                
                // Shorten mode names
                if (mode === 'Quick Match') topMode = 'QM';
                else if (mode === 'Storm League') topMode = 'SL';
                else if (mode === 'Unranked Draft') topMode = 'UD';
                else if (mode === 'Hero League') topMode = 'HL';
                else if (mode === 'Team League') topMode = 'TL';
                else topMode = mode.slice(0, 2).toUpperCase();
            }
        }

        // Calculate total games across all modes
        let totalGames = 0;
        let recent90Games = 0;
        for (const stats of Object.values(player_mmr)) {
            totalGames += stats.games_played || 0;
            recent90Games += stats.games_played_last_90_days || 0;
        }

        return {
            topMode,
            mmr: topMMR,
            totalGames,
            recent90Games
        };
    }

    /**
     * Display top 10 heroes inline in a player row
     * @param {Object} playerData - Player's hero data from API
     * @param {HTMLElement} heroesDiv - Container div for hero list
     */
    displayPlayerTopHeroesInline(playerData, heroesDiv) {
        // Extract Quick Match and Storm League heroes
        const quickMatch = playerData['Quick Match'] || {};
        const stormLeague = playerData['Storm League'] || {};
        
        // Check if we have any data at all
        if (Object.keys(quickMatch).length === 0 && Object.keys(stormLeague).length === 0) {
            heroesDiv.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.75rem;">No game data</div>';
            return;
        }

        // Combine heroes from both game types, taking the best stats
        const heroMap = new Map();
        
        // Helper function to process heroes from a game type
        const processGameType = (gameTypeData, gameTypeName) => {
            for (const [heroName, stats] of Object.entries(gameTypeData)) {
                const mmr = Math.round(stats.mmr || 0);
                const score = ((mmr - 1700) / 1000) * 100;
                
                // If hero already exists, use the higher MMR/score
                if (heroMap.has(heroName)) {
                    const existing = heroMap.get(heroName);
                    if (score > existing.score) {
                        heroMap.set(heroName, {
                            name: heroName,
                            mmr: mmr,
                            games: stats.games_played,
                            score: score,
                            gameType: gameTypeName
                        });
                    }
                } else {
                    heroMap.set(heroName, {
                        name: heroName,
                        mmr: mmr,
                        games: stats.games_played,
                        score: score,
                        gameType: gameTypeName
                    });
                }
            }
        };
        
        // Process both game types
        processGameType(quickMatch, 'QM');
        processGameType(stormLeague, 'SL');
        
        // Convert to array
        let heroList = Array.from(heroMap.values());
        
        // Filter heroes with 25+ games
        const heroesWithMinGames = heroList.filter(h => h.games >= 25);
        
        // If no heroes with 25+ games, fall back to top 3 most played
        let displayList;
        if (heroesWithMinGames.length === 0) {
            // Sort by games played, take top 3
            heroList.sort((a, b) => b.games - a.games);
            displayList = heroList.slice(0, 3);
        } else {
            // Sort by score, take top 10
            heroesWithMinGames.sort((a, b) => b.score - a.score);
            displayList = heroesWithMinGames.slice(0, 10);
        }

        if (displayList.length === 0) {
            heroesDiv.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.75rem;">No hero data</div>';
            return;
        }

        heroesDiv.innerHTML = '';
        displayList.forEach(hero => {
            const heroData = this.heroes.find(h => h.name === hero.name);
            const slug = heroData ? heroData.slug : hero.name.toLowerCase().replace(/[^a-z0-9]/g, '');

            const card = document.createElement('div');
            card.className = 'hero-stat-card';

            card.innerHTML = `
                <div class="hero-stat-tooltip">
                    <div class="tooltip-row">
                        <span class="tooltip-label">MMR:</span>
                        <span class="tooltip-mmr">${hero.mmr}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Games:</span>
                        <span class="tooltip-games">${hero.games}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Type:</span>
                        <span class="tooltip-games">${hero.gameType}</span>
                    </div>
                </div>
                <div class="hero-stat-img-container">
                    <img class="hero-stat-img" src="images/heroes/${slug}.jpg" alt="${hero.name}">
                    <div class="hero-stat-score-overlay">+${hero.score.toFixed(0)}</div>
                </div>
                <div class="hero-stat-name">${hero.name}</div>
            `;

            heroesDiv.appendChild(card);
        });
    }

    /**
     * Calculate MMR score for a hero based on player data
     * Maps MMR: 1700 = 0, 2700 = 100
     * Uses both Quick Match and Storm League data with 25+ games played
     * Returns max score among all players and game types
     * @param {string} heroName - Hero name
     * @param {string} team - 'blue' or 'red'
     * @returns {number} MMR score (0-100+)
     */
    getPlayerMMRScore(heroName, team) {
        const playerData = this.playerStats[team];
        
        if (!playerData || !Array.isArray(playerData) || playerData.length === 0) {
            return 0;
        }
        
        let maxScore = 0;
        
        for (const player of playerData) {
            // Skip empty slots
            if (!player || !player.data) {
                continue;
            }
            
            // Check both Quick Match and Storm League data
            const gameTypes = ['Quick Match', 'Storm League'];
            
            for (const gameType of gameTypes) {
                const gameTypeData = player.data[gameType];
                if (!gameTypeData || !gameTypeData[heroName]) {
                    continue;
                }
                
                const heroStats = gameTypeData[heroName];
                
                // Only consider heroes with 25+ games
                if (heroStats.games_played < 25) {
                    continue;
                }
                
                // Map MMR to score: 1700 = 0, 2700 = 100
                const mmr = heroStats.mmr || 0;
                const score = ((mmr - 1700) / 1000) * 100;
                
                // Use max score among all players and game types
                maxScore = Math.max(maxScore, score);
            }
        }
        
        return maxScore;
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
            synergy: 0,
            playerMMR: 0
        };
        const tags = [];

        // 1. Player MMR Score
        const mmrScore = this.getPlayerMMRScore(heroData.name, team);
        if (mmrScore > 0) {
            breakdown.playerMMR = mmrScore;
            if (mmrScore >= 50) {
                const heroName = heroData.name;
                // Find which player has this hero
                const playerData = this.playerStats[team];
                let bestPlayer = null;
                let bestMMR = 0;
                
                for (const player of playerData) {
                    // Skip empty slots
                    if (!player || !player.data) {
                        continue;
                    }
                    
                    // Check both Quick Match and Storm League
                    const gameTypes = ['Quick Match', 'Storm League'];
                    for (const gameType of gameTypes) {
                        const gameTypeData = player.data[gameType];
                        if (gameTypeData && gameTypeData[heroName] && gameTypeData[heroName].games_played >= 25) {
                            const mmr = Math.round(gameTypeData[heroName].mmr || 0);
                            if (mmr > bestMMR) {
                                bestMMR = mmr;
                                bestPlayer = player.battletag.split('#')[0]; // Get name part only
                            }
                        }
                    }
                }
                
                if (bestPlayer) {
                    tags.push({ 
                        text: `${bestPlayer} ${bestMMR} MMR`, 
                        score: mmrScore,
                        type: 'mmr' 
                    });
                }
            }
        }

        // 2. Map Score
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

        // 3. Strong Against (counters enemy picks)
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

        // 4. Weak Against (subtract score for bad matchups)
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

        // 5. Synergy (good with own team)
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

