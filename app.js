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
     * Returns max score among available players (unassigned or assigned to empty slots)
     * @param {string} heroName - Hero name
     * @param {string} team - 'blue' or 'red'
     * @param {Array} assignments - Array of player indices assigned to heroes (optional, defaults to excluding all assigned)
     * @returns {number} MMR score (0-100+)
     */
    getPlayerMMRScore(heroName, team, assignments = null) {
        const playerData = this.playerStats[team];
        
        if (!playerData || !Array.isArray(playerData) || playerData.length === 0) {
            return 0;
        }
        
        // If assignments provided, use them to filter out assigned players
        // If not provided, check the draft assignments
        const currentAssignments = assignments !== null ? assignments : (this.draft[team].assignments || []);
        const picks = this.draft[team].picks;
        
        let maxScore = 0;
        
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
                
                // Use max score among available players and game types
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
     * Get player MMR for a specific hero
     * @param {Object} player - Player data object
     * @param {string} heroName - Hero name
     * @returns {number} MMR value (0 if not found or insufficient games)
     */
    getPlayerHeroMMR(player, heroName) {
        if (!player || !player.data) {
            return 0;
        }

        let maxMMR = 0;
        const gameTypes = ['Quick Match', 'Storm League'];

        for (const gameType of gameTypes) {
            const gameTypeData = player.data[gameType];
            if (!gameTypeData || !gameTypeData[heroName]) {
                continue;
            }

            const heroStats = gameTypeData[heroName];
            if (heroStats.games_played >= 25) {
                const mmr = Math.round(heroStats.mmr || 0);
                maxMMR = Math.max(maxMMR, mmr);
            }
        }

        return maxMMR;
    }

    /**
     * Assign a single hero to the best available player based on MMR
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
        let bestMMR = -1;

        // Find the best available player for this hero
        validPlayers.forEach((player, playerIndex) => {
            // Skip if this player is already assigned to another hero (not just any slot)
            const alreadyAssigned = assignments.some((assignedIdx, idx) => 
                idx !== slotIndex && assignedIdx === playerIndex && this.draft[team].picks[idx] !== null
            );
            if (alreadyAssigned) {
                return;
            }

            const mmr = this.getPlayerHeroMMR(player, hero.name);
            if (mmr > bestMMR) {
                bestMMR = mmr;
                bestPlayerIndex = playerIndex;
            }
        });

        // Assign to best player with swap if needed
        if (bestMMR > 0) {
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
            if (assignments[slotIndex] === null && slotIndex < validPlayers.length) {
                // Find first unassigned player (only consider assigned if they have a hero)
                const availablePlayerIndex = validPlayers.findIndex((_, playerIdx) => 
                    !assignments.some((assignedPlayerIdx, slotIdx) => 
                        assignedPlayerIdx === playerIdx && picks[slotIdx] !== null
                    )
                );
                if (availablePlayerIndex !== -1) {
                    assignments[slotIndex] = availablePlayerIndex;
                } else {
                    // Fallback to sequential if all players are assigned to heroes
                    assignments[slotIndex] = slotIndex;
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

        // Second pass: auto-assign heroes based on MMR
        picks.forEach((hero, slotIndex) => {
            if (hero && assignments[slotIndex] === null) {
                // Find the best available player for this hero
                let bestPlayerIndex = -1;
                let bestMMR = -1;

                validPlayers.forEach((player, playerIndex) => {
                    // Skip if this player is already assigned
                    const alreadyAssigned = assignments.some((assignedIdx) => assignedIdx === playerIndex);
                    if (alreadyAssigned) {
                        return;
                    }

                    const mmr = this.getPlayerHeroMMR(player, hero.name);
                    if (mmr > bestMMR) {
                        bestMMR = mmr;
                        bestPlayerIndex = playerIndex;
                    }
                });

                // Assign to best player, or first available if no MMR found
                if (bestMMR > 0) {
                    assignments[slotIndex] = bestPlayerIndex;
                } else {
                    // No player has MMR for this hero, assign to first available
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

        // Debug flag for Illidan
        const isIllidan = heroData.name === 'Illidan';
        
        if (isIllidan) {
            console.log('=== ILLIDAN SCORE CALCULATION START ===');
            console.log('Team:', team);
            console.log('Own Picks:', ownPicks.map(h => h.name));
            console.log('Enemy Picks:', enemyPicks.map(h => h.name));
        }

        const breakdown = {
            map: 0,
            strongAgainst: 0,
            weakAgainst: 0,
            synergy: 0,
            playerMMR: 0
        };
        const tags = [];

        // 1. Player MMR Score (only considers unassigned players)
        const assignments = this.draft[team].assignments || [];
        const mmrScore = this.getPlayerMMRScore(heroData.name, team, assignments);
        if (isIllidan) {
            console.log('\n1. PLAYER MMR SCORE:');
            console.log('   MMR Score:', mmrScore);
        }
        
        if (mmrScore > 0) {
            breakdown.playerMMR = mmrScore;
            if (mmrScore >= 50) {
                const heroName = heroData.name;
                // Find which unassigned player has this hero
                const playerData = this.playerStats[team];
                let bestPlayer = null;
                let bestMMR = 0;
                
                // Only check players who are not assigned to a hero
                const picks = this.draft[team].picks;
                for (let i = 0; i < playerData.length; i++) {
                    const player = playerData[i];
                    // Skip empty slots
                    if (!player || !player.data) {
                        continue;
                    }
                    
                    // Check if player is assigned to a slot with a hero
                    let isAssignedToHero = false;
                    assignments.forEach((assignedPlayerIdx, slotIdx) => {
                        if (assignedPlayerIdx === i && picks[slotIdx] !== null) {
                            isAssignedToHero = true;
                        }
                    });
                    
                    // Skip if player is already assigned to a hero
                    if (isAssignedToHero) {
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
                    
                    if (isIllidan) {
                        console.log('   Best Player:', bestPlayer, 'with MMR:', bestMMR);
                    }
                }
            }
        }

        // 2. Map Score
        if (isIllidan) {
            console.log('\n2. MAP SCORE:');
            console.log('   Selected Map:', this.selectedMap);
        }
        
        if (this.selectedMap && heroData.best_maps) {
            // Find the map name from slug
            const selectedMapData = this.maps.find(m => m.slug === this.selectedMap);
            if (selectedMapData) {
                const mapScore = heroData.best_maps.find(m => m.map === selectedMapData.name);
                if (isIllidan) {
                    console.log('   Map Data:', selectedMapData.name);
                    console.log('   Map Score Object:', mapScore);
                }
                
                if (mapScore && mapScore.score) {
                    // Use the score directly (0-100 scale)
                    breakdown.map = mapScore.score;
                    
                    if (isIllidan) {
                        console.log('   Final Map Score:', breakdown.map);
                    }
                    
                    if (breakdown.map >= 80) {
                        tags.push({ text: `Strong on ${selectedMapData.name}`, score: breakdown.map, type: 'map' });
                    }
                }
            }
        }

        // 3. Strong Against (counters enemy picks)
        if (isIllidan) {
            console.log('\n3. STRONG AGAINST (Countering Enemy):');
            console.log('   Enemy Picks Count:', enemyPicks.length);
            console.log('   Has strong_against data:', !!heroData.strong_against);
        }
        
        if (enemyPicks.length > 0 && heroData.strong_against) {
            let totalScore = 0;
            let matchCount = 0;

            enemyPicks.forEach(enemyHero => {
                const matchup = heroData.strong_against.find(m => m.hero === enemyHero.name);
                
                if (isIllidan) {
                    console.log(`   Checking vs ${enemyHero.name}:`, matchup);
                }
                
                if (matchup && matchup.score) {
                    // Use score directly (0-100 scale, consistent with map score)
                    totalScore += matchup.score;
                    matchCount++;

                    if (isIllidan) {
                        console.log(`      Score: ${matchup.score}`);
                        console.log(`      Running total: ${totalScore}`);
                    }

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
                breakdown.strongAgainst = totalScore; // Sum, not average
                
                if (isIllidan) {
                    console.log(`   Final Strong Against Score: ${breakdown.strongAgainst} (sum of ${matchCount} matchups)`);
                }
            }
        }

        // 4. Weak Against (subtract score for bad matchups)
        if (isIllidan) {
            console.log('\n4. WEAK AGAINST:');
            console.log('   Enemy Picks Count:', enemyPicks.length);
            console.log('   Has weak_against data:', !!heroData.weak_against);
        }
        
        if (enemyPicks.length > 0 && heroData.weak_against) {
            let totalScore = 0;
            let matchCount = 0;

            enemyPicks.forEach(enemyHero => {
                const matchup = heroData.weak_against.find(m => m.hero === enemyHero.name);
                
                if (isIllidan) {
                    console.log(`   Checking vs ${enemyHero.name}:`, matchup);
                }
                
                if (matchup && matchup.score) {
                    // Only factor in if score is above 50 (significant weakness)
                    if (matchup.score > 50) {
                        totalScore += matchup.score;
                        matchCount++;

                        if (isIllidan) {
                            console.log(`      Score: ${matchup.score} (above 50, counting as weakness)`);
                            console.log(`      Running total: ${totalScore}`);
                        }

                        if (matchup.score >= 60) { // High weakness score
                            tags.push({ 
                                text: `Weak vs ${enemyHero.name}`, 
                                score: matchup.score,
                                type: 'weakness' 
                            });
                        }
                    } else if (isIllidan) {
                        console.log(`      Score: ${matchup.score} (below 50, ignoring)`);
                    }
                }
            });

            if (matchCount > 0) {
                breakdown.weakAgainst = -totalScore; // Negative sum (weakness is bad)
                
                if (isIllidan) {
                    console.log(`   Final Weak Against Score: ${breakdown.weakAgainst} (sum of ${matchCount} weaknesses, negated)`);
                }
            }
        }

        // 5. Synergy (good with own team)
        if (isIllidan) {
            console.log('\n5. SYNERGY (Team Synergy):');
            console.log('   Own Picks Count:', ownPicks.length);
            console.log('   Has good_team_with data:', !!heroData.good_team_with);
        }
        
        if (ownPicks.length > 0 && heroData.good_team_with) {
            let totalScore = 0;
            let matchCount = 0;

            ownPicks.forEach(teammate => {
                const synergy = heroData.good_team_with.find(m => m.hero === teammate.name);
                
                if (isIllidan) {
                    console.log(`   Checking with ${teammate.name}:`, synergy);
                }
                
                if (synergy && synergy.score) {
                    // Use score directly (0-100 scale, consistent with map score)
                    totalScore += synergy.score;
                    matchCount++;

                    if (isIllidan) {
                        console.log(`      Score: ${synergy.score}`);
                        console.log(`      Running total: ${totalScore}`);
                    }

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
                breakdown.synergy = totalScore; // Sum, not average
                
                if (isIllidan) {
                    console.log(`   Final Synergy Score: ${breakdown.synergy} (sum of ${matchCount} synergies)`);
                }
            }
        }

        // Calculate total score
        const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

        if (isIllidan) {
            console.log('\n=== FINAL BREAKDOWN ===');
            console.log('Breakdown:', breakdown);
            console.log('Total Score:', total);
            console.log('Tags:', tags);
            console.log('=== END ILLIDAN CALCULATION ===\n');
        }

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
                // Filter by role if specific roles are selected
                // If selectedRoles is empty (size === 0), show all roles
                if (this.selectedRoles[team].size > 0 && hero.role && !this.selectedRoles[team].has(hero.role)) {
                    return; // Skip heroes whose role is not selected
                }
                
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

        return recommendations; // Return all recommendations (no limit)
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

                const nameDiv = document.createElement('div');
                nameDiv.style.display = 'flex';
                nameDiv.style.flexDirection = 'column';
                nameDiv.style.gap = '2px';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'rec-hero-name';
                nameSpan.textContent = rec.hero.name;
                
                const roleSpan = document.createElement('span');
                roleSpan.className = 'rec-hero-role';
                roleSpan.textContent = rec.hero.role || 'Unknown';

                nameDiv.appendChild(nameSpan);
                if (rec.hero.role) {
                    nameDiv.appendChild(roleSpan);
                }

                heroInfo.appendChild(img);
                heroInfo.appendChild(nameDiv);

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
     * Get individual player MMR scores for a hero
     * Returns an array of scores, one per player on the team
     * @param {string} heroName - Hero name
     * @param {string} team - 'blue' or 'red'
     * @returns {Array} Array of player scores
     */
    getIndividualPlayerScores(heroName, team) {
        const playerData = this.playerStats[team];
        const playerScores = [];
        
        if (!playerData || !Array.isArray(playerData)) {
            return [];
        }

        for (let i = 0; i < playerData.length; i++) {
            const player = playerData[i];
            
            // If no player in this slot, add 0
            if (!player || !player.data) {
                if (i === 0 || playerData.some((p, idx) => idx < i && p)) {
                    // Only add 0 if there's at least one player before this slot
                    continue;
                }
                continue;
            }

            let maxScore = 0;
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
                maxScore = Math.max(maxScore, score);
            }
            
            playerScores.push({
                battletag: player.battletag,
                score: maxScore
            });
        }
        
        return playerScores;
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
            const scoreData = this.calculateHeroScore(hero.slug, team);
            
            // Get individual player scores
            const playerScores = this.getIndividualPlayerScores(hero.name, team);
            
            debugData.push({
                hero,
                breakdown: scoreData.breakdown,
                total: scoreData.total,
                playerScores: playerScores,
                unavailable: unavailableHeroes.has(hero.slug)
            });
        });

        // Sort by total score descending
        debugData.sort((a, b) => b.total - a.total);

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
        html += '<th title="Map synergy score">Map</th>';
        html += '<th title="Average score against enemy picks">vs Enemy</th>';
        html += '<th title="Average weakness against enemy picks (negative)">Weak vs</th>';
        html += '<th title="Average synergy with team picks">Synergy</th>';
        
        // Add player columns
        players.forEach((player, idx) => {
            const shortTag = player.battletag.split('#')[0];
            html += `<th class="debug-player-columns" title="Player MMR score for ${player.battletag}">${shortTag}</th>`;
        });
        
        html += '<th title="Combined total score from all players">Player Total</th>';
        html += '<th title="Final total score">Total</th>';
        html += '</tr></thead><tbody>';

        // Add rows for each hero
        debugData.forEach(data => {
            const { hero, breakdown, total, playerScores, unavailable } = data;
            
            html += '<tr>';
            
            // Hero name and image
            html += '<td><div class="debug-hero-cell">';
            html += `<img src="images/heroes/${hero.slug}.jpg" alt="${hero.name}" class="debug-hero-img">`;
            html += `<span class="debug-hero-name">${hero.name}</span>`;
            if (unavailable) {
                html += ' <span style="color: #f44336; font-size: 0.7rem;">(UNAVAILABLE)</span>';
            }
            html += '</div></td>';
            
            // Map score
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.map)}">${this.formatScore(breakdown.map)}</td>`;
            
            // Strong against
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.strongAgainst)}">${this.formatScore(breakdown.strongAgainst)}</td>`;
            
            // Weak against
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.weakAgainst)}">${this.formatScore(breakdown.weakAgainst)}</td>`;
            
            // Synergy
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.synergy)}">${this.formatScore(breakdown.synergy)}</td>`;
            
            // Individual player scores
            players.forEach((player, idx) => {
                const playerScore = playerScores.find(ps => ps.battletag === player.battletag);
                const score = playerScore ? playerScore.score : 0;
                html += `<td class="debug-score-cell debug-player-columns ${this.getScoreClass(score)}">${this.formatScore(score)}</td>`;
            });
            
            // Player total (from breakdown.playerMMR which is max of all players)
            html += `<td class="debug-score-cell ${this.getScoreClass(breakdown.playerMMR)}">${this.formatScore(breakdown.playerMMR)}</td>`;
            
            // Total score
            html += `<td class="debug-score-cell debug-score-total ${this.getScoreClass(total)}">${this.formatScore(total)}</td>`;
            
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.draftManager = new DraftManager();
});

