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
                picks: [null, null, null, null, null],
                assignments: [null, null, null, null, null], // Track which player is assigned to each hero
                manualAssignments: [false, false, false, false, false] // Track which assignments were manual
            },
            red: {
                bans: [null, null, null],
                picks: [null, null, null, null, null],
                assignments: [null, null, null, null, null], // Track which player is assigned to each hero
                manualAssignments: [false, false, false, false, false] // Track which assignments were manual
            }
        };
        this.playerStats = {
            blue: [],  // Array of player data objects
            red: []
        };
        this.currentSelection = null; // { type: 'ban'|'pick', team: 'blue'|'red', slot: number }
        this.searchQuery = '';
        this.selectedRoles = {
            blue: new Set(), // Empty = show all
            red: new Set()   // Empty = show all
        };
        this.API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : 'https://hots-one.vercel.app'; // Update this with your actual Vercel URL
        
        this.recentTeams = this.loadRecentTeams();
        
        this.init();
    }

    /**
     * Load recent teams from localStorage
     * @returns {Array} Array of saved team objects
     */
    loadRecentTeams() {
        try {
            const stored = localStorage.getItem('hots_recent_teams');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Handle old format (blue/red separated) and migrate
                if (parsed.blue || parsed.red) {
                    const migrated = [];
                    if (parsed.blue) {
                        parsed.blue.forEach(team => {
                            migrated.push({ name: '', battletags: team, timestamp: Date.now() });
                        });
                    }
                    if (parsed.red) {
                        parsed.red.forEach(team => {
                            if (!migrated.some(t => JSON.stringify(t.battletags) === JSON.stringify(team))) {
                                migrated.push({ name: '', battletags: team, timestamp: Date.now() });
                            }
                        });
                    }
                    return migrated;
                }
                return parsed;
            }
        } catch (error) {
            console.error('Error loading recent teams:', error);
        }
        return [];
    }

    /**
     * Save recent teams to localStorage
     */
    saveRecentTeams() {
        try {
            localStorage.setItem('hots_recent_teams', JSON.stringify(this.recentTeams));
        } catch (error) {
            console.error('Error saving recent teams:', error);
        }
    }

    /**
     * Save current team to recent teams
     * @param {string} team - 'blue' or 'red' (for getting current players)
     * @param {string} teamName - Name for the team (required)
     */
    saveCurrentTeamToRecent(team, teamName) {
        const players = this.playerStats[team];
        if (!players || players.filter(p => p).length === 0) {
            alert('No players to save! Add players first.');
            return;
        }

        if (!teamName || teamName.trim() === '') {
            alert('Please enter a team name!');
            return;
        }

        const trimmedName = teamName.trim();
        
        // Check if name already exists
        const existingIndex = this.recentTeams.findIndex(t => t.name.toLowerCase() === trimmedName.toLowerCase());
        
        if (existingIndex >= 0) {
            // Ask to overwrite
            if (!confirm(`Team "${trimmedName}" already exists. Overwrite it?`)) {
                return;
            }
            // Remove old entry
            this.recentTeams.splice(existingIndex, 1);
        }

        // Add to front of recent teams
        this.recentTeams.unshift({
            name: trimmedName,
            battletags: players.filter(p => p).map(p => p.battletag),
            timestamp: Date.now()
        });
        
        // Keep only last 20 teams
        this.recentTeams = this.recentTeams.slice(0, 20);
        
        this.saveRecentTeams();
        this.renderRecentTeamsDropdowns();
    }


    /**
     * Load a recent team
     * @param {string} targetTeam - 'blue' or 'red' (which team to load into)
     * @param {number} index - Index of the recent team
     */
    async loadRecentTeam(targetTeam, index) {
        const savedTeam = this.recentTeams[index];
        if (!savedTeam || !savedTeam.battletags || savedTeam.battletags.length === 0) {
            return;
        }

        // Clear current team
        this.clearTeam(targetTeam);

        // Add each player
        for (const battletag of savedTeam.battletags) {
            await this.addPlayerRow(targetTeam, battletag);
        }

        // After all players are loaded, ensure assignments are set for existing heroes
        this.assignHeroesToPlayers(targetTeam);
        this.renderDraft();
    }

    /**
     * Clear all players from a team
     * @param {string} team - 'blue' or 'red'
     */
    clearTeam(team) {
        const container = document.querySelector(`.player-rows-container[data-team="${team}"]`);
        container.innerHTML = '';
        this.playerStats[team] = [];
        this.draft[team].assignments = [null, null, null, null, null];
        this.renderDraft();
        this.renderRecommendations();
    }

    /**
     * Delete a saved team
     * @param {number} index - Index of the team to delete
     */
    deleteSavedTeam(index) {
        if (index >= 0 && index < this.recentTeams.length) {
            const team = this.recentTeams[index];
            const displayName = team.name || team.battletags.map(bt => bt.split('#')[0]).join(', ');
            
            if (confirm(`Delete saved team "${displayName}"?`)) {
                this.recentTeams.splice(index, 1);
                this.saveRecentTeams();
                this.renderRecentTeamsDropdowns();
            }
        }
    }

    /**
     * Render recent teams dropdowns for both teams
     */
    renderRecentTeamsDropdowns() {
        ['blue', 'red'].forEach(team => {
            const select = document.querySelector(`.recent-teams-select[data-team="${team}"]`);
            if (!select) return;

            // Clear existing options except first
            select.innerHTML = '<option value="">-- Load saved team --</option>';

            this.recentTeams.forEach((savedTeam, index) => {
                const option = document.createElement('option');
                option.value = index;
                
                const playerNames = savedTeam.battletags.map(bt => bt.split('#')[0]).join(', ');
                const playerCount = savedTeam.battletags.length;
                
                if (savedTeam.name) {
                    option.textContent = `${savedTeam.name} (${playerCount}: ${playerNames})`;
                } else {
                    option.textContent = `${playerCount} player${playerCount > 1 ? 's' : ''}: ${playerNames}`;
                }
                
                select.appendChild(option);
            });
        });
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderMaps();
        this.renderDraft();
        this.renderRecommendations();
        this.renderHeroGrid();
        
        // Initialize recent teams dropdowns
        this.renderRecentTeamsDropdowns();
    }

    async loadData() {
        try {
            // Load heroes list
            const heroesResponse = await fetch('heroes.json');
            this.heroes = await heroesResponse.json();
            console.log(`Loaded ${this.heroes.length} heroes`);

            // Load combined hero data (stats + matchups with deltas)
            const combinedDataResponse = await fetch('data/hero_data_combined.json');
            const combinedData = await combinedDataResponse.json();
            this.heroesData = combinedData.heroes;
            console.log(`Loaded combined data for ${Object.keys(this.heroesData).length} heroes`);
            console.log(`Patch: ${combinedData.metadata.minor_patch}`);

            // Extract map names from hero data
            this.maps = this.extractMapNames(this.heroesData);
            console.log(`Extracted ${this.maps.length} maps from hero data`);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Failed to load game data. Please ensure all JSON files are available.');
        }
    }

    /**
     * Extract unique map names from hero data
     * @param {Object} heroesData - Combined hero data
     * @returns {Array} Array of map objects with name and slug
     */
    extractMapNames(heroesData) {
        const mapSet = new Set();
        
        // Get maps from first hero that has map data
        for (const heroName in heroesData) {
            const hero = heroesData[heroName];
            if (hero.maps && Object.keys(hero.maps).length > 0) {
                Object.keys(hero.maps).forEach(mapName => {
                    mapSet.add(mapName);
                });
                break; // One hero is enough to get all map names
            }
        }
        
        // Convert to array of map objects
        return Array.from(mapSet).map(name => ({
            name: name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '')
        })).sort((a, b) => a.name.localeCompare(b.name));
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
                // Don't trigger if clicking on player assignment dropdown
                if (e.target.classList.contains('hero-player-assignment') || 
                    e.target.tagName === 'SELECT') {
                    return;
                }
                
                const team = slot.dataset.team;
                const slotIndex = parseInt(slot.dataset.slot);
                
                // If slot is filled, allow removal
                if (this.draft[team].picks[slotIndex]) {
                    this.draft[team].picks[slotIndex] = null;
                    this.draft[team].assignments[slotIndex] = null;
                    this.draft[team].manualAssignments[slotIndex] = false;
                    // Fill this empty slot with sequential assignment
                    this.fillEmptySlots(team);
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

        // Close panels on escape (check debug panel first, then hero selection)
        // Also handle Enter to select first highlighted hero
        document.addEventListener('keydown', (e) => {
            const debugPanel = document.getElementById('debug-panel');
            const heroPanel = document.getElementById('hero-selection-panel');
            
            if (e.key === 'Escape') {
                if (debugPanel.classList.contains('active')) {
                    this.closeDebugPanel();
                } else if (heroPanel.classList.contains('active')) {
                    this.hideHeroSelection();
                }
            } else if (e.key === 'Enter' && heroPanel.classList.contains('active')) {
                // Select the first highlighted hero if available
                if (this.firstSelectableHero) {
                    e.preventDefault();
                    this.selectHero(this.firstSelectableHero);
                }
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

        // Debug mode toggle
        document.getElementById('toggle-debug').addEventListener('click', () => {
            this.openDebugPanel();
        });

        document.getElementById('close-debug').addEventListener('click', () => {
            this.closeDebugPanel();
        });

        // Debug team selector
        document.getElementById('debug-team-select').addEventListener('change', (e) => {
            this.renderDebugTable();
        });

        // Debug show zero scores checkbox
        document.getElementById('debug-show-zero-scores').addEventListener('change', (e) => {
            this.renderDebugTable();
        });

        // Role filter buttons
        document.querySelectorAll('.role-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const team = btn.closest('.role-filters').dataset.team;
                const role = btn.dataset.role;
                const roleFilters = btn.closest('.role-filters');
                const allBtn = roleFilters.querySelector('[data-role="All"]');
                const roleButtons = roleFilters.querySelectorAll('.role-filter-btn:not([data-role="All"])');
                
                if (role === 'All') {
                    // "All" button clicked - clear all role filters and deactivate other buttons
                    this.selectedRoles[team].clear();
                    roleButtons.forEach(b => b.classList.remove('active'));
                    allBtn.classList.add('active');
                } else {
                    // Specific role clicked
                    allBtn.classList.remove('active');
                    
                    // Toggle the role
                    if (this.selectedRoles[team].has(role)) {
                        this.selectedRoles[team].delete(role);
                        btn.classList.remove('active');
                    } else {
                        this.selectedRoles[team].add(role);
                        btn.classList.add('active');
                    }
                    
                    // If no roles are selected, activate "All"
                    if (this.selectedRoles[team].size === 0) {
                        allBtn.classList.add('active');
                    }
                }
                
                // Update recommendations
                this.renderRecommendations();
            });
        });

        // Recent teams dropdowns
        document.querySelectorAll('.recent-teams-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const team = select.dataset.team;
                const index = parseInt(select.value);
                
                if (!isNaN(index)) {
                    await this.loadRecentTeam(team, index);
                    select.value = ''; // Reset dropdown
                }
            });
        });

        // Save team buttons
        document.querySelectorAll('.save-team-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const team = btn.dataset.team;
                const nameInput = document.querySelector(`.team-name-input[data-team="${team}"]`);
                const teamName = nameInput ? nameInput.value.trim() : '';
                
                this.saveCurrentTeamToRecent(team, teamName);
                
                // Clear name input after successful save
                if (nameInput && teamName) {
                    nameInput.value = '';
                    
                    // Visual feedback
                    const originalText = btn.textContent;
                    btn.textContent = '✓ Saved!';
                    btn.style.background = '#48bb78';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                    }, 2000);
                }
            });
        });

        // Clear team buttons
        document.querySelectorAll('.clear-team-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const team = btn.dataset.team;
                if (confirm(`Clear all players from ${team === 'blue' ? 'Blue' : 'Red'} team?`)) {
                    this.clearTeam(team);
                }
            });
        });

        // Delete saved team buttons (context menu on dropdown)
        document.querySelectorAll('.recent-teams-select').forEach(select => {
            select.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const selectedIndex = parseInt(select.value);
                
                if (!isNaN(selectedIndex) && selectedIndex >= 0) {
                    this.deleteSavedTeam(selectedIndex);
                    select.value = ''; // Reset selection
                } else {
                    alert('Select a team from the dropdown first, then right-click to delete it.');
                }
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
                
                // Add player assignment dropdown at the top (always show if there are players)
                const players = this.playerStats[team] || [];
                const validPlayers = players.filter(p => p && p.data);
                
                if (validPlayers.length > 0) {
                    const assignment = this.draft[team].assignments[index];
                    const playerSelect = document.createElement('select');
                    playerSelect.className = 'hero-player-assignment';
                    playerSelect.dataset.team = team;
                    playerSelect.dataset.slot = index;
                    
                    // Add empty option
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = '-- Assign --';
                    playerSelect.appendChild(emptyOption);
                    
                    // Add options for each player
                    validPlayers.forEach((player, playerIndex) => {
                        if (player && player.battletag) {
                            const option = document.createElement('option');
                            option.value = playerIndex;
                            option.textContent = player.battletag.split('#')[0];
                            if (assignment === playerIndex) {
                                option.selected = true;
                            }
                            playerSelect.appendChild(option);
                        }
                    });
                    
                    // Add change handler
                    playerSelect.addEventListener('change', (e) => {
                        e.stopPropagation(); // Prevent slot click from firing
                        const selectedPlayerIndex = e.target.value === '' ? null : parseInt(e.target.value);
                        this.assignPlayerToHero(team, index, selectedPlayerIndex);
                    });
                    
                    playerSelect.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent slot click from firing
                    });
                    
                    slot.appendChild(playerSelect);
                }
                
                if (hero) {
                    const img = document.createElement('img');
                    img.src = `images/heroes/${hero.slug}.jpg`;
                    img.alt = hero.name;
                    slot.appendChild(img);
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'hero-name';
                    nameDiv.textContent = hero.name;
                    slot.appendChild(nameDiv);

                    // Add hover tooltip with breakdown
                    this.addHeroTooltip(slot, hero, team);
                }
            });
        });

        // Update team win rates
        this.updateTeamWinRates();
    }

    /**
     * Add hover tooltip to a hero slot showing delta breakdown
     * @param {HTMLElement} slot - The hero slot element
     * @param {Object} hero - Hero object
     * @param {string} team - 'blue' or 'red'
     */
    addHeroTooltip(slot, hero, team) {
        const tooltip = document.createElement('div');
        tooltip.className = 'hero-tooltip';
        
        // Calculate score for this hero
        const score = this.calculateHeroScore(hero.name, team);
        const enemyTeam = team === 'blue' ? 'red' : 'blue';
        const ownPicks = this.getPickedHeroes(team).filter(h => h.name !== hero.name);
        const enemyPicks = this.getPickedHeroes(enemyTeam);
        
        // Get assigned player info
        const slotIndex = this.draft[team].picks.indexOf(hero);
        const playerIndex = this.draft[team].assignments[slotIndex];
        const playerData = this.playerStats[team];
        let assignedPlayer = null;
        let playerDelta = 0;
        
        if (playerIndex !== null && playerData && playerData[playerIndex]) {
            assignedPlayer = playerData[playerIndex];
            playerDelta = this.getPlayerHeroWinRateDelta(assignedPlayer, hero.name);
        }
        
        let html = `<div class="hero-tooltip-title">${hero.name}</div>`;
        html += `<div class="hero-tooltip-winrate">Expected WR: ${score.expectedWinRate.toFixed(1)}%</div>`;
        html += '<div class="hero-tooltip-divider"></div>';
        
        // Global
        html += `<div class="hero-tooltip-row">`;
        html += `<span class="hero-tooltip-label">Global:</span>`;
        html += `<span class="hero-tooltip-value ${this.getDeltaClass(score.breakdown.global)}">${this.formatDelta(score.breakdown.global)}</span>`;
        html += `</div>`;
        
        // Map
        if (this.selectedMap) {
            const mapName = this.maps.find(m => m.slug === this.selectedMap)?.name || 'Selected Map';
            html += `<div class="hero-tooltip-row">`;
            html += `<span class="hero-tooltip-label">${mapName}:</span>`;
            html += `<span class="hero-tooltip-value ${this.getDeltaClass(score.breakdown.map)}">${this.formatDelta(score.breakdown.map)}</span>`;
            html += `</div>`;
        }
        
        // Player (if assigned and has data)
        if (assignedPlayer && playerDelta !== 0) {
            const playerName = assignedPlayer.battletag.split('#')[0];
            html += `<div class="hero-tooltip-row">`;
            html += `<span class="hero-tooltip-label">Player (${playerName}):</span>`;
            html += `<span class="hero-tooltip-value ${this.getDeltaClass(playerDelta)}">${this.formatDelta(playerDelta)}</span>`;
            html += `</div>`;
        }
        
        // Allies
        if (ownPicks.length > 0) {
            html += '<div class="hero-tooltip-section">With Allies:</div>';
            const heroData = this.heroesData[hero.name];
            ownPicks.forEach(ally => {
                const matchup = heroData?.matchups?.[ally.name];
                if (matchup?.ally?.confidence_adjusted_delta !== undefined) {
                    const delta = matchup.ally.confidence_adjusted_delta;
                    html += `<div class="hero-tooltip-row hero-tooltip-sub">`;
                    html += `<span class="hero-tooltip-label">+ ${ally.name}:</span>`;
                    html += `<span class="hero-tooltip-value ${this.getDeltaClass(delta)}">${this.formatDelta(delta)}</span>`;
                    html += `</div>`;
                }
            });
        }
        
        // Enemies
        if (enemyPicks.length > 0) {
            html += '<div class="hero-tooltip-section">Vs Enemies:</div>';
            const heroData = this.heroesData[hero.name];
            enemyPicks.forEach(enemy => {
                const matchup = heroData?.matchups?.[enemy.name];
                if (matchup?.enemy?.confidence_adjusted_delta !== undefined) {
                    const delta = matchup.enemy.confidence_adjusted_delta;
                    html += `<div class="hero-tooltip-row hero-tooltip-sub">`;
                    html += `<span class="hero-tooltip-label">vs ${enemy.name}:</span>`;
                    html += `<span class="hero-tooltip-value ${this.getDeltaClass(delta)}">${this.formatDelta(delta)}</span>`;
                    html += `</div>`;
                }
            });
        }
        
        // Total
        html += '<div class="hero-tooltip-divider"></div>';
        html += `<div class="hero-tooltip-row hero-tooltip-total">`;
        html += `<span class="hero-tooltip-label">Total Delta:</span>`;
        html += `<span class="hero-tooltip-value ${this.getDeltaClass(score.total)}">${this.formatDelta(score.total)}</span>`;
        html += `</div>`;
        
        tooltip.innerHTML = html;
        slot.appendChild(tooltip);
    }


    /**
     * Format delta value for display
     * @param {number} delta - Delta value
     * @returns {string} Formatted delta string
     */
    formatDelta(delta) {
        if (delta === 0) return '0.0%';
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta.toFixed(1)}%`;
    }

    /**
     * Get CSS class for delta value
     * @param {number} delta - Delta value
     * @returns {string} CSS class name
     */
    getDeltaClass(delta) {
        if (delta >= 3) return 'delta-high-positive';
        if (delta > 0) return 'delta-positive';
        if (delta <= -3) return 'delta-high-negative';
        if (delta < 0) return 'delta-negative';
        return 'delta-neutral';
    }

    /**
     * Calculate and update team win rates
     */
    updateTeamWinRates() {
        // Calculate raw win rates for both teams
        const blueWinRate = this.calculateTeamWinRate('blue');
        const redWinRate = this.calculateTeamWinRate('red');
        
        // If both teams have picks, normalize so they sum to 100%
        let normalizedBlue = blueWinRate;
        let normalizedRed = redWinRate;
        
        if (blueWinRate !== null && redWinRate !== null) {
            const total = blueWinRate + redWinRate;
            if (total > 0) {
                normalizedBlue = (blueWinRate / total) * 100;
                normalizedRed = (redWinRate / total) * 100;
            }
        }
        
        // Update display for each team
        ['blue', 'red'].forEach(team => {
            const teamWinRate = team === 'blue' ? normalizedBlue : normalizedRed;
            const container = document.querySelector(`.team-winrate[data-team="${team}"]`);
            
            if (container) {
                if (teamWinRate !== null) {
                    const delta = teamWinRate - 50;
                    container.innerHTML = `
                        <div class="team-winrate-label">Team Win Rate:</div>
                        <div class="team-winrate-value ${delta >= 5 ? 'high' : delta <= -5 ? 'low' : ''}">${teamWinRate.toFixed(1)}%</div>
                        <div class="team-winrate-delta">(${this.formatDelta(delta)})</div>
                    `;
                    container.style.display = 'flex';
                } else {
                    container.style.display = 'none';
                }
            }
        });
    }

    /**
     * Calculate team win rate based on all picked heroes
     * Sums the deltas from all heroes and adds to 50%
     * @param {string} team - 'blue' or 'red'
     * @returns {number|null} Team win rate or null if no picks
     */
    calculateTeamWinRate(team) {
        const picks = this.getPickedHeroes(team);
        if (picks.length === 0) return null;
        
        let totalDelta = 0;
        
        picks.forEach(hero => {
            const score = this.calculateHeroScore(hero.name, team);
            totalDelta += score.total;
        });
        
        // Sum of all deltas, then add to 50%
        return 50 + totalDelta;
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
            if (this.searchQuery && !hero.slug.includes(this.searchQuery)) {
                return false;
            }
            return true;
        });

        // Sort by relevance: heroes starting with search query first, then alphabetically
        filteredHeroes.sort((a, b) => {
            if (this.searchQuery) {
                const aStartsWith = a.slug.startsWith(this.searchQuery);
                const bStartsWith = b.slug.startsWith(this.searchQuery);
                
                if (aStartsWith && !bStartsWith) return -1;
                if (!aStartsWith && bStartsWith) return 1;
            }
            
            // Alphabetically by name
            return a.name.localeCompare(b.name);
        });

        // Render hero options
        let firstSelectableHero = null;
        filteredHeroes.forEach((hero, index) => {
            const heroOption = document.createElement('div');
            heroOption.className = 'hero-option';
            
            const isDisabled = unavailableHeroes.has(hero.slug);
            if (isDisabled) {
                heroOption.classList.add('disabled');
            }

            // Highlight first selectable hero
            if (!isDisabled && firstSelectableHero === null) {
                firstSelectableHero = hero;
                heroOption.classList.add('highlighted');
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

            if (!isDisabled) {
                heroOption.addEventListener('click', () => {
                    this.selectHero(hero);
                });
            }

            heroGrid.appendChild(heroOption);
        });

        // Store reference to first selectable hero for Enter key handling
        this.firstSelectableHero = firstSelectableHero;
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
        
        // If it's a pick, try to assign heroes to players (auto-assign)
        if (type === 'pick') {
            // Only preserve the assignment if it was manually set by the user
            // Otherwise, auto-assign based on MMR
            if (!this.draft[team].manualAssignments[slot]) {
                // Auto-assign only this new hero based on MMR
                this.assignSingleHero(team, slot, hero);
            }
            // Fill any empty slots with sequential assignments
            this.fillEmptySlots(team);
        }
        
        this.hideHeroSelection();
        this.renderDraft();
        this.renderRecommendations(); // Update recommendations after selection
    }

    /**
     * Manually assign a player to a hero
     * @param {string} team - 'blue' or 'red'
     * @param {number} slotIndex - Index of the pick slot
     * @param {number|null} playerIndex - Index of the player to assign, or null to unassign
     */
    assignPlayerToHero(team, slotIndex, playerIndex) {
        // If assigning to a player who is already assigned to another hero, unassign that hero first
        if (playerIndex !== null) {
            const assignments = this.draft[team].assignments || [];
            assignments.forEach((assignedIndex, pickIndex) => {
                if (pickIndex !== slotIndex && assignedIndex === playerIndex) {
                    assignments[pickIndex] = null;
                    this.draft[team].manualAssignments[pickIndex] = false;
                }
            });
        }
        
        // Assign the player to this hero and mark it as manual
        this.draft[team].assignments[slotIndex] = playerIndex;
        this.draft[team].manualAssignments[slotIndex] = true;
        
        // Update recommendations
        this.renderRecommendations();
    }

    resetDraft() {
        this.draft = {
            blue: {
                bans: [null, null, null],
                picks: [null, null, null, null, null],
                assignments: [null, null, null, null, null],
                manualAssignments: [false, false, false, false, false]
            },
            red: {
                bans: [null, null, null],
                picks: [null, null, null, null, null],
                assignments: [null, null, null, null, null],
                manualAssignments: [false, false, false, false, false]
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
                const winRate = parseFloat(stats.win_rate || 50);
                let delta = winRate - 50;
                // Cap at ±5%
                delta = Math.max(-5, Math.min(5, delta));
                
                // If hero already exists, use the one with more games
                if (heroMap.has(heroName)) {
                    const existing = heroMap.get(heroName);
                    if (stats.games_played > existing.games) {
                        heroMap.set(heroName, {
                            name: heroName,
                            winRate: winRate,
                            games: stats.games_played,
                            delta: delta,
                            gameType: gameTypeName
                        });
                    }
                } else {
                    heroMap.set(heroName, {
                        name: heroName,
                        winRate: winRate,
                        games: stats.games_played,
                        delta: delta,
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
            // Sort by games played, take top 10
            heroesWithMinGames.sort((a, b) => b.games - a.games);
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
            
            const deltaSign = hero.delta >= 0 ? '+' : '';
            const deltaColor = hero.delta >= 0 ? '#66bb6a' : '#ef5350';
            
            card.innerHTML = `
                <div class="hero-stat-tooltip">
                    <div class="tooltip-row">
                        <span class="tooltip-label">Win Rate:</span>
                        <span class="tooltip-mmr">${hero.winRate.toFixed(1)}%</span>
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
                    <div class="hero-stat-score-overlay" style="color: ${deltaColor}">${deltaSign}${hero.delta.toFixed(1)}%</div>
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

            // Fill any empty slots with sequential assignments
            this.fillEmptySlots(team);

            // Update draft and recommendations
            this.renderDraft();
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
            // Clear any assignments to this player
            const assignments = this.draft[team].assignments || [];
            const manualAssignments = this.draft[team].manualAssignments || [];
            assignments.forEach((assignedIndex, pickIndex) => {
                if (assignedIndex === index) {
                    assignments[pickIndex] = null;
                    manualAssignments[pickIndex] = false;
                }
            });
            // Fill empty slots with sequential assignments
            this.fillEmptySlots(team);
        }
        // Update draft and recommendations
        this.renderDraft();
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
                alert(message);
            }
            

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
                const winRate = parseFloat(stats.win_rate || 50);
                let delta = winRate - 50;
                // Cap at ±5%
                delta = Math.max(-5, Math.min(5, delta));
                
                // If hero already exists, use the one with more games
                if (heroMap.has(heroName)) {
                    const existing = heroMap.get(heroName);
                    if (stats.games_played > existing.games) {
                        heroMap.set(heroName, {
                            name: heroName,
                            winRate: winRate,
                            games: stats.games_played,
                            delta: delta,
                            gameType: gameTypeName
                        });
                    }
                } else {
                    heroMap.set(heroName, {
                        name: heroName,
                        winRate: winRate,
                        games: stats.games_played,
                        delta: delta,
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
            // Sort by games played, take top 10
            heroesWithMinGames.sort((a, b) => b.games - a.games);
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

            const deltaSign = hero.delta >= 0 ? '+' : '';
            const deltaColor = hero.delta >= 0 ? '#66bb6a' : '#ef5350';

            card.innerHTML = `
                <div class="hero-stat-tooltip">
                    <div class="tooltip-row">
                        <span class="tooltip-label">Win Rate:</span>
                        <span class="tooltip-mmr">${hero.winRate.toFixed(1)}%</span>
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
                    <div class="hero-stat-score-overlay" style="color: ${deltaColor}">${deltaSign}${hero.delta.toFixed(1)}%</div>
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
     * Returns max score among available players (unassigned or assigned to empty slots)
     * @param {string} heroName - Hero name
     * @param {string} team - 'blue' or 'red'
     * @param {Array} assignments - Array of player indices assigned to heroes (optional, defaults to excluding all assigned)
     * @returns {number} MMR score (0-100+)
     */
    getPlayerWinRateDelta(heroName, team, assignments = null) {
        const playerData = this.playerStats[team];
        
        if (!playerData || !Array.isArray(playerData) || playerData.length === 0) {
            return 0;
        }
        
        // If assignments provided, use them to filter out assigned players
        // If not provided, check the draft assignments
        const currentAssignments = assignments !== null ? assignments : (this.draft[team].assignments || []);
        const picks = this.draft[team].picks;
        
        let bestDelta = 0;
        
        for (let i = 0; i < playerData.length; i++) {
            const player = playerData[i];
            // Skip empty slots
            if (!player || !player.data) {
                continue;
            }
            
            // Check if player is assigned to a slot with a hero
            // A player is only "taken" if they're assigned to a slot that has a hero picked
            let isAssignedToHero = false;
            currentAssignments.forEach((assignedPlayerIdx, slotIdx) => {
                if (assignedPlayerIdx === i && picks[slotIdx] !== null) {
                    isAssignedToHero = true;
                }
            });
            
            // Skip if player is already assigned to a hero
            if (isAssignedToHero) {
                continue;
            }
            
            // Get win rate delta for this player (already handles game types and capping)
            const delta = this.getPlayerHeroWinRateDelta(player, heroName);
            
            // Use the best delta among available players
            if (Math.abs(delta) > Math.abs(bestDelta)) {
                bestDelta = delta;
            }
        }
        
        return bestDelta;
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
            // Only preserve the assignment if it was manually set by the user
            // Otherwise, auto-assign based on MMR
            if (!this.draft[team].manualAssignments[emptySlotIndex]) {
                // Auto-assign only this new hero based on MMR
                this.assignSingleHero(team, emptySlotIndex, hero);
            }
            // Fill any empty slots with sequential assignments
            this.fillEmptySlots(team);
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
     * Get player win rate delta for a specific hero
     * @param {Object} player - Player data object
     * @param {string} heroName - Hero name
     * @returns {number} Win rate delta from 50% (capped at ±5%, 0 if not found or insufficient games)
     */
    getPlayerHeroWinRateDelta(player, heroName) {
        if (!player || !player.data) {
            return 0;
        }

        let bestDelta = 0;
        let maxGames = 0;
        const gameTypes = ['Quick Match', 'Storm League'];

        for (const gameType of gameTypes) {
            const gameTypeData = player.data[gameType];
            if (!gameTypeData || !gameTypeData[heroName]) {
                continue;
            }

            const heroStats = gameTypeData[heroName];
            const games = heroStats.games_played || 0;
            
            // Only consider heroes with 25+ games
            if (games >= 25) {
                // Calculate win rate delta from 50%
                const winRate = parseFloat(heroStats.win_rate || 50);
                let delta = winRate - 50;
                
                // Cap delta at ±5%
                delta = Math.max(-5, Math.min(5, delta));
                
                // Use the delta from the game type with most games
                if (games > maxGames) {
                    maxGames = games;
                    bestDelta = delta;
                }
            }
        }

        return bestDelta;
    }

    /**
     * Assign a single hero to the best available player based on win rate delta
     * @param {string} team - 'blue' or 'red'
     * @param {number} slotIndex - The slot index to assign
     * @param {Object} hero - The hero object
     */
    assignSingleHero(team, slotIndex, hero) {
        const players = this.playerStats[team] || [];
        const validPlayers = players.filter(p => p && p.data);
        
        if (validPlayers.length === 0) {
            return;
        }

        const assignments = this.draft[team].assignments;
        let bestPlayerIndex = -1;
        let bestDelta = -999; // Start with very low value

        // Find the best available player for this hero
        validPlayers.forEach((player, playerIndex) => {
            // Skip if this player is already assigned to another hero (not just any slot)
            const alreadyAssigned = assignments.some((assignedIdx, idx) => 
                idx !== slotIndex && assignedIdx === playerIndex && this.draft[team].picks[idx] !== null
            );
            if (alreadyAssigned) {
                return;
            }

            const delta = this.getPlayerHeroWinRateDelta(player, hero.name);
            if (delta > bestDelta) {
                bestDelta = delta;
                bestPlayerIndex = playerIndex;
            }
        });

        // Assign to best player with swap if needed
        if (bestDelta > -999) {
            // Check if this player is currently assigned to a different slot (without a hero)
            const currentSlotOfPlayer = assignments.findIndex((assignedIdx, idx) => 
                idx !== slotIndex && assignedIdx === bestPlayerIndex
            );
            
            // If the player we want to assign is in another slot, swap assignments
            if (currentSlotOfPlayer !== -1) {
                const playerInCurrentSlot = assignments[slotIndex];
                assignments[currentSlotOfPlayer] = playerInCurrentSlot;
            }
            
            assignments[slotIndex] = bestPlayerIndex;
        } else {
            // No player has MMR for this hero, assign to first available
            const availablePlayerIndex = validPlayers.findIndex((_, idx) => 
                !assignments.some((assignedIdx, slotIdx) => 
                    slotIdx !== slotIndex && assignedIdx === idx && this.draft[team].picks[slotIdx] !== null
                )
            );
            if (availablePlayerIndex !== -1) {
                // Swap if needed
                const currentSlotOfPlayer = assignments.findIndex((assignedIdx, idx) => 
                    idx !== slotIndex && assignedIdx === availablePlayerIndex
                );
                
                if (currentSlotOfPlayer !== -1) {
                    const playerInCurrentSlot = assignments[slotIndex];
                    assignments[currentSlotOfPlayer] = playerInCurrentSlot;
                }
                
                assignments[slotIndex] = availablePlayerIndex;
            }
        }
    }

    /**
     * Fill empty slots with sequential player assignments
     * Only considers a player as "assigned" if they're assigned to a slot with a hero
     * @param {string} team - 'blue' or 'red'
     */
    fillEmptySlots(team) {
        const players = this.playerStats[team] || [];
        const validPlayers = players.filter(p => p && p.data);
        
        if (validPlayers.length === 0) {
            return;
        }

        const assignments = this.draft[team].assignments;
        const picks = this.draft[team].picks;
        
        for (let slotIndex = 0; slotIndex < 5; slotIndex++) {
            if (assignments[slotIndex] === null && slotIndex < players.length) {
                // Find first player that isn't assigned to any slot yet
                let foundPlayerIndex = -1;
                for (let playerIdx = 0; playerIdx < players.length; playerIdx++) {
                    // Skip if no player data in this slot
                    if (!players[playerIdx] || !players[playerIdx].data) {
                        continue;
                    }
                    
                    // Check if this player is already assigned to any slot
                    const isAlreadyAssigned = assignments.some((assignedIdx, idx) => 
                        idx !== slotIndex && assignedIdx === playerIdx
                    );
                    
                    if (!isAlreadyAssigned) {
                        foundPlayerIndex = playerIdx;
                        break;
                    }
                }
                
                if (foundPlayerIndex !== -1) {
                    assignments[slotIndex] = foundPlayerIndex;
                } else {
                    // Fallback to sequential if all players are assigned
                    assignments[slotIndex] = slotIndex < players.length ? slotIndex : null;
                }
            }
        }
    }

    /**
     * Assign heroes to players based on MMR
     * For slots with heroes: assign to unassigned player with highest MMR
     * For empty slots: assign in sequential order
     * Preserves manual assignments when re-assigning
     * @param {string} team - 'blue' or 'red'
     */
    assignHeroesToPlayers(team) {
        const players = this.playerStats[team] || [];
        const validPlayers = players.filter(p => p && p.data);

        // If no players, clear assignments
        if (validPlayers.length === 0) {
            this.draft[team].assignments = [null, null, null, null, null];
            this.draft[team].manualAssignments = [false, false, false, false, false];
            return;
        }

        const picks = this.draft[team].picks;
        const currentAssignments = this.draft[team].assignments || [null, null, null, null, null];
        const manualAssignments = this.draft[team].manualAssignments || [false, false, false, false, false];
        const assignments = [null, null, null, null, null];

        // First pass: preserve manual assignments
        for (let slotIndex = 0; slotIndex < 5; slotIndex++) {
            if (manualAssignments[slotIndex] && picks[slotIndex]) {
                assignments[slotIndex] = currentAssignments[slotIndex];
            }
        }

        // Second pass: auto-assign heroes based on win rate delta
        picks.forEach((hero, slotIndex) => {
            if (hero && assignments[slotIndex] === null) {
                // Find the best available player for this hero
                let bestPlayerIndex = -1;
                let bestDelta = -999;

                validPlayers.forEach((player, playerIndex) => {
                    // Skip if this player is already assigned
                    const alreadyAssigned = assignments.some((assignedIdx) => assignedIdx === playerIndex);
                    if (alreadyAssigned) {
                        return;
                    }

                    const delta = this.getPlayerHeroWinRateDelta(player, hero.name);
                    if (delta > bestDelta) {
                        bestDelta = delta;
                        bestPlayerIndex = playerIndex;
                    }
                });

                // Assign to best player, or first available if no data found
                if (bestDelta > -999) {
                    assignments[slotIndex] = bestPlayerIndex;
                } else {
                    // No player has data for this hero, assign to first available
                    const availablePlayerIndex = validPlayers.findIndex((_, idx) => 
                        !assignments.some((assignedIdx) => assignedIdx === idx)
                    );
                    if (availablePlayerIndex !== -1) {
                        assignments[slotIndex] = availablePlayerIndex;
                    }
                }
            }
        });

        // Third pass: fill empty slots with sequential assignment
        for (let slotIndex = 0; slotIndex < 5; slotIndex++) {
            if (assignments[slotIndex] === null && slotIndex < validPlayers.length) {
                // Find first unassigned player
                const availablePlayerIndex = validPlayers.findIndex((_, idx) => 
                    !assignments.some((assignedIdx) => assignedIdx === idx)
                );
                if (availablePlayerIndex !== -1) {
                    assignments[slotIndex] = availablePlayerIndex;
                } else {
                    // Fallback to sequential if all players are assigned
                    assignments[slotIndex] = slotIndex;
                }
            }
        }

        // Update assignments
        this.draft[team].assignments = assignments;
    }

    /**
     * Calculate win rate delta for a hero based on map, matchups, and synergies
     * Returns delta in percentage points (e.g., +5 means 5% higher win rate)
     * @param {string} heroName - The name of the hero to score
     * @param {string} team - 'blue' or 'red'
     * @returns {Object} Delta breakdown with total and individual components
     */
    calculateHeroScore(heroName, team) {
        // Find hero by name in the heroesData
        const heroData = this.heroesData[heroName];
        if (!heroData) {
            return { total: 0, breakdown: {}, tags: [], expectedWinRate: 50 };
        }

        const enemyTeam = team === 'blue' ? 'red' : 'blue';
        const ownPicks = this.getPickedHeroes(team);
        const enemyPicks = this.getPickedHeroes(enemyTeam);

        const breakdown = {
            global: 0,
            map: 0,
            vsEnemy: 0,
            withAllies: 0,
            playerDelta: 0
        };
        const tags = [];

        // 1. Global win rate delta (baseline)
        if (heroData.global && heroData.global.confidence_adjusted_delta !== undefined) {
            breakdown.global = heroData.global.confidence_adjusted_delta;
        }

        // 2. Map delta (if map is selected)
        if (this.selectedMap && heroData.maps) {
            // Find the map by matching slug
            const selectedMapData = this.maps.find(m => m.slug === this.selectedMap);
            if (selectedMapData && heroData.maps[selectedMapData.name]) {
                const mapData = heroData.maps[selectedMapData.name];
                if (mapData.confidence_adjusted_delta !== undefined) {
                    breakdown.map = mapData.confidence_adjusted_delta;
                    
                    // Add tag for significant map advantage/disadvantage
                    if (Math.abs(breakdown.map) >= 3) {
                        const mapWinRate = (heroData.global.win_rate || 50) + breakdown.map;
                        tags.push({
                            text: breakdown.map > 0 
                                ? `Good on ${selectedMapData.name}` 
                                : `Weak on ${selectedMapData.name}`,
                            score: breakdown.map,
                            winRate: mapWinRate,
                            type: 'map'
                        });
                    }
                }
            }
        }

        // 3. Enemy matchup deltas (vs each enemy pick)
        if (enemyPicks.length > 0 && heroData.matchups) {
            enemyPicks.forEach(enemyHero => {
                const matchup = heroData.matchups[enemyHero.name];
                if (matchup && matchup.enemy && matchup.enemy.confidence_adjusted_delta !== undefined) {
                    const delta = matchup.enemy.confidence_adjusted_delta;
                    breakdown.vsEnemy += delta;
                    
                    // Add tag for significant matchups
                    if (Math.abs(delta) >= 3) {
                        const matchupWinRate = (heroData.global.win_rate || 50) + delta;
                        tags.push({
                            text: delta > 0 
                                ? `Counters ${enemyHero.name}` 
                                : `Countered by ${enemyHero.name}`,
                            score: delta,
                            winRate: matchupWinRate,
                            type: delta > 0 ? 'counter' : 'weakness'
                        });
                    }
                }
            });
        }

        // 4. Ally synergy deltas (with each ally pick)
        if (ownPicks.length > 0 && heroData.matchups) {
            ownPicks.forEach(ally => {
                const matchup = heroData.matchups[ally.name];
                if (matchup && matchup.ally && matchup.ally.confidence_adjusted_delta !== undefined) {
                    const delta = matchup.ally.confidence_adjusted_delta;
                    breakdown.withAllies += delta;
                    
                    // Add tag for significant synergies
                    if (Math.abs(delta) >= 3) {
                        const synergyWinRate = (heroData.global.win_rate || 50) + delta;
                        tags.push({
                            text: delta > 0 
                                ? `Synergy with ${ally.name}` 
                                : `Anti-synergy with ${ally.name}`,
                            score: delta,
                            winRate: synergyWinRate,
                            type: delta > 0 ? 'synergy' : 'antisynergy'
                        });
                    }
                }
            });
        }

        // 5. Player win rate delta (capped at ±5%)
        const assignments = this.draft[team].assignments || [];
        const playerDelta = this.getPlayerWinRateDelta(heroName, team, assignments);
        if (playerDelta !== 0) {
            breakdown.playerDelta = playerDelta;
            if (Math.abs(playerDelta) >= 1) {
                // Find which unassigned player has this hero
                const playerData = this.playerStats[team];
                let bestPlayer = null;
                let bestWinRate = 50;
                
                const picks = this.draft[team].picks;
                for (let i = 0; i < playerData.length; i++) {
                    const player = playerData[i];
                    if (!player || !player.data) continue;
                    
                    let isAssignedToHero = false;
                    assignments.forEach((assignedPlayerIdx, slotIdx) => {
                        if (assignedPlayerIdx === i && picks[slotIdx] !== null) {
                            isAssignedToHero = true;
                        }
                    });
                    
                    if (isAssignedToHero) continue;
                    
                    const gameTypes = ['Quick Match', 'Storm League'];
                    for (const gameType of gameTypes) {
                        const gameTypeData = player.data[gameType];
                        if (gameTypeData && gameTypeData[heroName] && gameTypeData[heroName].games_played >= 25) {
                            const winRate = parseFloat(gameTypeData[heroName].win_rate || 50);
                            if (Math.abs(winRate - 50) > Math.abs(bestWinRate - 50)) {
                                bestWinRate = winRate;
                                bestPlayer = player.battletag.split('#')[0];
                            }
                        }
                    }
                }
                
                if (bestPlayer) {
                    tags.push({ 
                        text: `${bestPlayer} ${bestWinRate.toFixed(1)}% WR`, 
                        score: playerDelta,
                        type: 'player' 
                    });
                }
            }
        }

        // Calculate total delta and expected win rate
        const totalDelta = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
        const baseWinRate = heroData.global && heroData.global.win_rate ? heroData.global.win_rate : 50;
        const expectedWinRate = 50 + totalDelta; // Start from 50% and add all deltas

        return { 
            total: totalDelta, 
            breakdown, 
            tags, 
            expectedWinRate,
            baseWinRate
        };
    }

    /**
     * Get hero recommendations for a team
     * @param {string} team - 'blue' or 'red'
     * @returns {Array} Sorted array of hero recommendations with expected win rates
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

        // Calculate win rate deltas for all available heroes
        const recommendations = [];
        this.heroes.forEach(hero => {
            if (!unavailableHeroes.has(hero.slug)) {
                // Filter by role if specific roles are selected
                if (this.selectedRoles[team].size > 0 && hero.new_role && !this.selectedRoles[team].has(hero.new_role)) {
                    return;
                }
                
                const score = this.calculateHeroScore(hero.name, team);
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

        // Sort by expected win rate (descending)
        recommendations.sort((a, b) => b.expectedWinRate - a.expectedWinRate);

        return recommendations;
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
                recItem.style.position = 'relative'; // For tooltip positioning

                // Hero image and name
                const heroInfo = document.createElement('div');
                heroInfo.className = 'rec-hero-info';

                const img = document.createElement('img');
                img.src = `images/heroes/${rec.hero.slug}.jpg`;
                img.alt = rec.hero.name;
                img.className = 'rec-hero-img';

                const nameDiv = document.createElement('div');
                nameDiv.style.display = 'flex';
                nameDiv.style.flexDirection = 'column';
                nameDiv.style.gap = '2px';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'rec-hero-name';
                nameSpan.textContent = rec.hero.name;
                
                const roleSpan = document.createElement('span');
                roleSpan.className = 'rec-hero-role';
                roleSpan.textContent = rec.hero.new_role || 'Unknown';

                nameDiv.appendChild(nameSpan);
                if (rec.hero.new_role) {
                    nameDiv.appendChild(roleSpan);
                }

                heroInfo.appendChild(img);
                heroInfo.appendChild(nameDiv);

                // Win Rate Display
                const winRateContainer = document.createElement('div');
                winRateContainer.className = 'rec-winrate-container';
                winRateContainer.style.display = 'flex';
                winRateContainer.style.flexDirection = 'column';
                winRateContainer.style.alignItems = 'flex-end';
                winRateContainer.style.gap = '2px';

                const winRateSpan = document.createElement('span');
                winRateSpan.className = 'rec-score';
                winRateSpan.textContent = `${rec.expectedWinRate.toFixed(1)}%`;
                winRateSpan.title = `Expected Win Rate: ${rec.expectedWinRate.toFixed(1)}%`;
                if (rec.expectedWinRate >= 55) winRateSpan.classList.add('high');
                else if (rec.expectedWinRate <= 45) winRateSpan.classList.add('negative');

                const deltaSpan = document.createElement('span');
                deltaSpan.style.fontSize = '0.7rem';
                deltaSpan.style.color = 'var(--text-secondary)';
                const deltaSign = rec.total >= 0 ? '+' : '';
                deltaSpan.textContent = `(${deltaSign}${rec.total.toFixed(1)}%)`;
                deltaSpan.title = `Win Rate Delta: ${deltaSign}${rec.total.toFixed(1)}%`;

                winRateContainer.appendChild(winRateSpan);
                winRateContainer.appendChild(deltaSpan);

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
                recItem.appendChild(winRateContainer);
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

    /**
     * Open the debug panel and render the table
     */
    openDebugPanel() {
        const panel = document.getElementById('debug-panel');
        panel.classList.add('active');
        this.renderDebugTable();
    }

    /**
     * Close the debug panel
     */
    closeDebugPanel() {
        const panel = document.getElementById('debug-panel');
        panel.classList.remove('active');
    }

    /**
     * Get individual player win rate deltas for a hero
     * Returns an array of deltas, one per player on the team
     * @param {string} heroName - Hero name
     * @param {string} team - 'blue' or 'red'
     * @returns {Array} Array of player deltas
     */
    getIndividualPlayerScores(heroName, team) {
        const playerData = this.playerStats[team];
        const playerDeltas = [];
        
        if (!playerData || !Array.isArray(playerData)) {
            return [];
        }

        for (let i = 0; i < playerData.length; i++) {
            const player = playerData[i];
            
            // If no player in this slot, skip
            if (!player || !player.data) {
                if (i === 0 || playerData.some((p, idx) => idx < i && p)) {
                    // Only add 0 if there's at least one player before this slot
                    continue;
                }
                continue;
            }

            // Get delta for this player using the same function as scoring
            const delta = this.getPlayerHeroWinRateDelta(player, heroName);
            
            playerDeltas.push({
                battletag: player.battletag,
                score: delta // Keep property name 'score' for compatibility with display code
            });
        }
        
        return playerDeltas;
    }

    /**
     * Generate debug data for all heroes for a specific team
     * This uses the EXACT SAME calculateHeroScore method as recommendations
     * @param {string} team - 'blue' or 'red'
     * @returns {Array} Array of hero debug data
     */
    generateDebugData(team) {
        const debugData = [];
        
        // Get unavailable heroes (banned or picked)
        const unavailableHeroes = new Set();
        ['blue', 'red'].forEach(t => {
            this.draft[t].bans.forEach(hero => {
                if (hero) unavailableHeroes.add(hero.slug);
            });
            this.draft[t].picks.forEach(hero => {
                if (hero) unavailableHeroes.add(hero.slug);
            });
        });

        // Calculate scores for all heroes
        this.heroes.forEach(hero => {
            // Calculate using the EXACT SAME method as recommendations
            const scoreData = this.calculateHeroScore(hero.name, team);
            
            // Get individual player scores
            const playerScores = this.getIndividualPlayerScores(hero.name, team);
            
            debugData.push({
                hero,
                breakdown: scoreData.breakdown,
                total: scoreData.total,
                expectedWinRate: scoreData.expectedWinRate,
                playerScores: playerScores,
                unavailable: unavailableHeroes.has(hero.slug)
            });
        });

        // Sort by expected win rate descending
        debugData.sort((a, b) => b.expectedWinRate - a.expectedWinRate);

        return debugData;
    }

    /**
     * Render the debug table
     */
    renderDebugTable() {
        const team = document.getElementById('debug-team-select').value;
        const showZeroScores = document.getElementById('debug-show-zero-scores').checked;
        const content = document.getElementById('debug-content');

        // Generate debug data using the SAME calculation as recommendations
        let debugData = this.generateDebugData(team);

        // Filter out heroes with zero scores if checkbox is unchecked
        if (!showZeroScores) {
            debugData = debugData.filter(d => d.total !== 0 || d.unavailable);
        }

        if (debugData.length === 0) {
            content.innerHTML = '<div class="debug-no-data">No data available. Select map, heroes, or add players to see scores.</div>';
            return;
        }

        // Get player battletags for headers
        const playerData = this.playerStats[team] || [];
        const players = playerData.filter(p => p && p.battletag);

        // Build table HTML
        let html = '<table class="debug-table"><thead><tr>';
        html += '<th>Hero</th>';
        html += '<th title="Global win rate delta">Global Δ</th>';
        html += '<th title="Map win rate delta">Map Δ</th>';
        html += '<th title="Win rate delta vs enemy picks">vs Enemy Δ</th>';
        html += '<th title="Win rate delta with allies">Ally Δ</th>';
        
        // Add player columns
        players.forEach((player, idx) => {
            const shortTag = player.battletag.split('#')[0];
            html += `<th class="debug-player-columns" title="Player MMR score for ${player.battletag}">${shortTag}</th>`;
        });
        
        html += '<th title="Combined total from all players">Player</th>';
        html += '<th title="Total delta (sum of all deltas)">Total Δ</th>';
        html += '<th title="Expected win rate">Win Rate</th>';
        html += '</tr></thead><tbody>';

        // Add rows for each hero
        debugData.forEach(data => {
            const { hero, breakdown, total, expectedWinRate, playerScores, unavailable } = data;
            
            html += '<tr>';
            
            // Hero name and image
            html += '<td><div class="debug-hero-cell">';
            html += `<img src="images/heroes/${hero.slug}.jpg" alt="${hero.name}" class="debug-hero-img">`;
            html += `<span class="debug-hero-name">${hero.name}</span>`;
            if (unavailable) {
                html += ' <span style="color: #f44336; font-size: 0.7rem;">(UNAVAILABLE)</span>';
            }
            html += '</div></td>';
            
            // Global delta
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.global)}">${this.formatScore(breakdown.global)}</td>`;
            
            // Map delta
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.map)}">${this.formatScore(breakdown.map)}</td>`;
            
            // vs Enemy delta
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.vsEnemy)}">${this.formatScore(breakdown.vsEnemy)}</td>`;
            
            // Ally delta
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.withAllies)}">${this.formatScore(breakdown.withAllies)}</td>`;
            
            // Individual player scores
            players.forEach((player, idx) => {
                const playerScore = playerScores.find(ps => ps.battletag === player.battletag);
                const score = playerScore ? playerScore.score : 0;
                html += `<td class="debug-score-cell debug-player-columns ${this.getScoreClass(score)}">${this.formatScore(score)}</td>`;
            });
            
            // Player total (from breakdown.playerDelta which is best player's win rate delta)
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.playerDelta)}">${this.formatScore(breakdown.playerDelta)}</td>`;
            
            // Total delta
            html += `<td class="debug-score-cell debug-score-total ${this.getScoreClass(total)}">${this.formatScore(total)}</td>`;
            
            // Expected Win Rate
            const winRateClass = expectedWinRate >= 55 ? 'debug-score-positive' : expectedWinRate <= 45 ? 'debug-score-negative' : 'debug-score-neutral';
            html += `<td class="debug-score-cell debug-score-total ${winRateClass}">${expectedWinRate.toFixed(1)}%</td>`;
            
            html += '</tr>';
        });

        html += '</tbody></table>';
        content.innerHTML = html;
    }

    /**
     * Format score for display
     */
    formatScore(score) {
        if (score === 0) return '0.0';
        return score.toFixed(1);
    }

    /**
     * Get CSS class for score coloring
     */
    getScoreClass(score) {
        if (score > 0.5) return 'debug-score-positive';
        if (score < -0.5) return 'debug-score-negative';
        return 'debug-score-neutral';
    }

    /**
     * Get URL for hero details page
     * @param {Object|string} hero - Hero object or hero slug
     * @returns {string} URL to hero details page
     */
    getHeroDetailsUrl(hero) {
        const slug = typeof hero === 'string' ? hero : hero.slug;
        return `hero.html?hero=${slug}`;
    }

    /**
     * Navigate to hero details page
     * @param {Object|string} hero - Hero object or hero slug
     */
    navigateToHeroDetails(hero) {
        window.location.href = this.getHeroDetailsUrl(hero);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.draftManager = new DraftManager();
});

