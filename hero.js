// Hero Details Page

class HeroDetailsManager {
    constructor() {
        this.heroes = [];
        this.heroesData = {};
        this.maps = [];
        this.currentHero = null;
        this.searchQuery = '';
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        
        // Check URL parameter for hero
        const urlParams = new URLSearchParams(window.location.search);
        const heroParam = urlParams.get('hero');
        
        if (heroParam) {
            // Find hero by slug or name
            const hero = this.heroes.find(h => 
                h.slug === heroParam.toLowerCase() || 
                h.name.toLowerCase() === heroParam.toLowerCase()
            );
            
            if (hero) {
                this.showHeroDetails(hero);
            } else {
                this.showHeroSelector();
                alert(`Hero "${heroParam}" not found. Please select a hero from the list.`);
            }
        } else {
            this.showHeroSelector();
        }
    }

    async loadData() {
        const loading = document.getElementById('loading');
        loading.style.display = 'flex';
        
        try {
            // Load heroes list
            const heroesResponse = await fetch('heroes.json');
            this.heroes = await heroesResponse.json();
            console.log(`Loaded ${this.heroes.length} heroes`);

            // Load combined hero data
            const combinedDataResponse = await fetch('data/hero_data_combined.json');
            const combinedData = await combinedDataResponse.json();
            this.heroesData = combinedData.heroes;
            console.log(`Loaded combined data for ${Object.keys(this.heroesData).length} heroes`);

            // Extract map names
            this.maps = this.extractMapNames(this.heroesData);
            console.log(`Extracted ${this.maps.length} maps`);
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Failed to load game data. Please ensure all JSON files are available.');
        } finally {
            loading.style.display = 'none';
        }
    }

    extractMapNames(heroesData) {
        const mapSet = new Set();
        
        for (const heroName in heroesData) {
            const hero = heroesData[heroName];
            if (hero.maps && Object.keys(hero.maps).length > 0) {
                Object.keys(hero.maps).forEach(mapName => {
                    mapSet.add(mapName);
                });
                break;
            }
        }
        
        return Array.from(mapSet).map(name => ({
            name: name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '')
        })).sort((a, b) => a.name.localeCompare(b.name));
    }

    setupEventListeners() {
        // Hero search
        document.getElementById('hero-search').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderHeroGrid();
        });

        // Change hero button
        document.getElementById('change-hero-btn').addEventListener('click', () => {
            this.showHeroSelector();
            // Update URL to remove hero parameter
            window.history.pushState({}, '', 'hero.html');
        });

        // Matchup filters - all update the combined table
        document.getElementById('filter-counters').addEventListener('change', () => {
            this.renderCombinedMatchups();
        });
        document.getElementById('filter-weaknesses').addEventListener('change', () => {
            this.renderCombinedMatchups();
        });
        document.getElementById('min-enemy-delta').addEventListener('input', () => {
            this.renderCombinedMatchups();
        });

        document.getElementById('filter-synergies').addEventListener('change', () => {
            this.renderCombinedMatchups();
        });
        document.getElementById('filter-antisynergies').addEventListener('change', () => {
            this.renderCombinedMatchups();
        });
        document.getElementById('min-ally-delta').addEventListener('input', () => {
            this.renderCombinedMatchups();
        });
    }

    showHeroSelector() {
        document.getElementById('hero-selector').style.display = 'block';
        document.getElementById('hero-details').style.display = 'none';
        this.currentHero = null;
        this.renderHeroGrid();
    }

    showHeroDetails(hero) {
        this.currentHero = hero;
        document.getElementById('hero-selector').style.display = 'none';
        document.getElementById('hero-details').style.display = 'block';
        
        // Update URL with hero parameter
        window.history.pushState({}, '', `hero.html?hero=${hero.slug}`);
        
        // Update page title
        document.title = `${hero.name} - Hero Details`;
        
        this.renderHeroDetails();
    }

    renderHeroGrid() {
        const heroGrid = document.getElementById('hero-grid');
        heroGrid.innerHTML = '';

        // Filter heroes by search query
        const filteredHeroes = this.heroes.filter(hero => {
            if (this.searchQuery && !hero.slug.includes(this.searchQuery) && 
                !hero.name.toLowerCase().includes(this.searchQuery)) {
                return false;
            }
            return true;
        });

        // Sort alphabetically
        filteredHeroes.sort((a, b) => a.name.localeCompare(b.name));

        // Render hero options
        filteredHeroes.forEach(hero => {
            const heroCard = document.createElement('div');
            heroCard.className = 'hero-card';

            const img = document.createElement('img');
            img.src = `images/heroes/${hero.slug}.jpg`;
            img.alt = hero.name;

            const nameLabel = document.createElement('div');
            nameLabel.className = 'hero-card-name';
            nameLabel.textContent = hero.name;

            const roleLabel = document.createElement('div');
            roleLabel.className = 'hero-card-role';
            roleLabel.textContent = hero.new_role || 'Unknown';

            heroCard.appendChild(img);
            heroCard.appendChild(nameLabel);
            heroCard.appendChild(roleLabel);

            heroCard.addEventListener('click', () => {
                this.showHeroDetails(hero);
            });

            heroGrid.appendChild(heroCard);
        });
    }

    renderHeroDetails() {
        if (!this.currentHero) return;

        const heroData = this.heroesData[this.currentHero.name];
        
        // Update hero header
        document.getElementById('hero-image').src = `images/heroes/${this.currentHero.slug}.jpg`;
        document.getElementById('hero-image').alt = this.currentHero.name;
        document.getElementById('hero-name').textContent = this.currentHero.name;
        document.getElementById('hero-role').textContent = this.currentHero.new_role || 'Unknown Role';

        // Render sections
        this.renderGlobalStats(heroData);
        this.renderMapStats(heroData);
        this.renderCombinedMatchups(heroData);
    }

    renderGlobalStats(heroData) {
        if (!heroData || !heroData.global) {
            document.getElementById('global-winrate').textContent = 'N/A';
            document.getElementById('global-delta').textContent = 'N/A';
            document.getElementById('global-games').textContent = 'N/A';
            document.getElementById('global-popularity').textContent = 'N/A';
            return;
        }

        const global = heroData.global;
        
        // Win Rate
        const winRate = global.win_rate || 50;
        const winRateEl = document.getElementById('global-winrate');
        winRateEl.textContent = `${winRate.toFixed(2)}%`;
        winRateEl.className = 'stat-value ' + this.getWinRateClass(winRate);

        // Delta
        const delta = global.confidence_adjusted_delta || 0;
        const deltaEl = document.getElementById('global-delta');
        deltaEl.textContent = this.formatDelta(delta);
        deltaEl.className = 'stat-value ' + this.getDeltaClass(delta);

        // Games
        const games = global.games || 0;
        document.getElementById('global-games').textContent = games.toLocaleString();

        // Popularity
        const popularity = global.popularity || 0;
        document.getElementById('global-popularity').textContent = `${popularity.toFixed(2)}%`;
    }

    renderMapStats(heroData) {
        const tbody = document.getElementById('map-stats-body');
        tbody.innerHTML = '';

        if (!heroData || !heroData.maps) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No map data available</td></tr>';
            return;
        }

        // Get hero's global win rate for delta calculation
        const globalWinRate = heroData.global?.win_rate || 50;

        // Convert maps object to array with calculated deltas
        const mapStats = [];
        for (const [mapName, stats] of Object.entries(heroData.maps)) {
            const mapWinRate = stats.win_rate || 50;
            const delta = mapWinRate - globalWinRate; // Delta from hero's global WR
            
            mapStats.push({
                name: mapName,
                win_rate: mapWinRate,
                delta: delta,
                games: stats.games
            });
        }
        
        // Sort by delta (descending - best maps first)
        mapStats.sort((a, b) => b.delta - a.delta);

        // Render each map
        mapStats.forEach(map => {
            const row = document.createElement('tr');
            
            // Map name
            const nameCell = document.createElement('td');
            nameCell.textContent = map.name;
            row.appendChild(nameCell);

            // Win rate
            const wrCell = document.createElement('td');
            wrCell.textContent = `${map.win_rate.toFixed(1)}%`;
            wrCell.className = this.getWinRateClass(map.win_rate);
            row.appendChild(wrCell);

            // Delta (from hero's global win rate)
            const deltaCell = document.createElement('td');
            deltaCell.textContent = this.formatDelta(map.delta);
            deltaCell.className = this.getDeltaClass(map.delta);
            row.appendChild(deltaCell);

            // Games
            const gamesCell = document.createElement('td');
            gamesCell.textContent = map.games.toLocaleString();
            row.appendChild(gamesCell);

            tbody.appendChild(row);
        });
    }

    renderCombinedMatchups(heroData = null) {
        if (!heroData) {
            heroData = this.heroesData[this.currentHero.name];
        }

        const container = document.getElementById('combined-matchups');

        if (!heroData || !heroData.matchups) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No matchup data available</p>';
            return;
        }

        // Get filter settings
        const showCounters = document.getElementById('filter-counters').checked;
        const showWeaknesses = document.getElementById('filter-weaknesses').checked;
        const showSynergies = document.getElementById('filter-synergies').checked;
        const showAntisynergies = document.getElementById('filter-antisynergies').checked;
        const minEnemyDelta = parseFloat(document.getElementById('min-enemy-delta').value) || 0;
        const minAllyDelta = parseFloat(document.getElementById('min-ally-delta').value) || 0;

        // Get hero's global win rate for delta calculation
        const globalWinRate = heroData.global?.win_rate || 50;

        // Collect all matchups with both enemy and ally data
        const matchups = [];
        const heroNames = new Set();

        // Collect all hero names
        for (const heroName of Object.keys(heroData.matchups)) {
            heroNames.add(heroName);
        }

        // Process each hero
        for (const heroName of heroNames) {
            const data = heroData.matchups[heroName];
            
            let enemyWinRate = null;
            let enemyDelta = null;
            let enemyGames = null;
            let allyWinRate = null;
            let allyDelta = null;
            let allyGames = null;

            // Enemy data
            if (data.enemy && data.enemy.win_rate !== undefined) {
                enemyWinRate = data.enemy.win_rate;
                enemyDelta = enemyWinRate - globalWinRate;
                enemyGames = data.enemy.games || 0;
            }

            // Ally data
            if (data.ally && data.ally.win_rate !== undefined) {
                allyWinRate = data.ally.win_rate;
                allyDelta = allyWinRate - globalWinRate;
                allyGames = data.ally.games || 0;
            }

            // Apply filters
            let includeEnemy = false;
            let includeAlly = false;

            if (enemyDelta !== null) {
                if (Math.abs(enemyDelta) >= minEnemyDelta) {
                    if ((enemyDelta > 0 && showCounters) || (enemyDelta < 0 && showWeaknesses)) {
                        includeEnemy = true;
                    }
                }
            }

            if (allyDelta !== null) {
                if (Math.abs(allyDelta) >= minAllyDelta) {
                    if ((allyDelta > 0 && showSynergies) || (allyDelta < 0 && showAntisynergies)) {
                        includeAlly = true;
                    }
                }
            }

            // Include if either enemy or ally passes filters
            if (includeEnemy || includeAlly) {
                matchups.push({
                    name: heroName,
                    vsWinRate: enemyWinRate,
                    vsDelta: enemyDelta,
                    vsGames: enemyGames,
                    withWinRate: allyWinRate,
                    withDelta: allyDelta,
                    withGames: allyGames
                });
            }
        }

        if (matchups.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No matchups match the current filters</p>';
            return;
        }

        // Create combined sortable table
        this.createCombinedMatchupTable(container, matchups);
    }

    createCombinedMatchupTable(container, matchups) {
        // Sort by vs win rate descending by default
        matchups.sort((a, b) => {
            const aVal = a.vsWinRate !== null ? a.vsWinRate : (a.withWinRate || 0);
            const bVal = b.vsWinRate !== null ? b.vsWinRate : (b.withWinRate || 0);
            return bVal - aVal;
        });

        // Create table
        const table = document.createElement('table');
        table.className = 'matchup-table combined-matchup-table';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const headers = [
            { key: 'name', label: 'Hero', sortable: true, tooltip: 'Hero name' },
            { key: 'vsWinRate', label: 'WR vs', sortable: true, tooltip: 'Win rate against this hero' },
            { key: 'vsDelta', label: 'Δ vs', sortable: true, tooltip: `Difference from ${this.currentHero.name}'s global win rate (vs enemy)` },
            { key: 'vsGames', label: 'Games vs', sortable: true, tooltip: 'Number of games against this hero' },
            { key: 'withWinRate', label: 'WR with', sortable: true, tooltip: 'Win rate with this hero as ally' },
            { key: 'withDelta', label: 'Δ with', sortable: true, tooltip: `Difference from ${this.currentHero.name}'s global win rate (with ally)` },
            { key: 'withGames', label: 'Games with', sortable: true, tooltip: 'Number of games with this hero as ally' }
        ];

        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.label;
            if (header.tooltip) {
                th.title = header.tooltip;
            }
            
            if (header.sortable) {
                th.className = 'sortable';
                if (header.key === 'vsWinRate') {
                    th.classList.add('sorted-desc');
                }
                th.dataset.column = header.key;
                th.addEventListener('click', () => {
                    this.sortCombinedMatchupTable(table, matchups, header.key);
                });
            }
            
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        matchups.forEach(matchup => {
            const row = this.createCombinedMatchupTableRow(matchup);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);

        // Store current sort state
        table.dataset.sortColumn = 'vsWinRate';
        table.dataset.sortDirection = 'desc';
        table.matchupsData = matchups;
    }

    createCombinedMatchupTableRow(matchup) {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';

        // Find hero data for image
        const hero = this.heroes.find(h => h.name === matchup.name);
        const slug = hero ? hero.slug : matchup.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Hero cell with image and name
        const heroCell = document.createElement('td');
        heroCell.className = 'hero-cell';
        heroCell.innerHTML = `
            <img src="images/heroes/${slug}.jpg" alt="${matchup.name}" class="hero-thumb">
            <span>${matchup.name}</span>
        `;

        // VS Win Rate cell
        const vsWrCell = document.createElement('td');
        if (matchup.vsWinRate !== null) {
            vsWrCell.textContent = `${matchup.vsWinRate.toFixed(1)}%`;
            vsWrCell.className = this.getWinRateClass(matchup.vsWinRate);
        } else {
            vsWrCell.textContent = '—';
            vsWrCell.className = 'no-data';
        }

        // VS Delta cell
        const vsDeltaCell = document.createElement('td');
        if (matchup.vsDelta !== null) {
            vsDeltaCell.textContent = this.formatDelta(matchup.vsDelta);
            vsDeltaCell.className = this.getDeltaClass(matchup.vsDelta);
        } else {
            vsDeltaCell.textContent = '—';
            vsDeltaCell.className = 'no-data';
        }

        // VS Games cell
        const vsGamesCell = document.createElement('td');
        if (matchup.vsGames !== null) {
            vsGamesCell.textContent = matchup.vsGames.toLocaleString();
        } else {
            vsGamesCell.textContent = '—';
            vsGamesCell.className = 'no-data';
        }

        // WITH Win Rate cell
        const withWrCell = document.createElement('td');
        if (matchup.withWinRate !== null) {
            withWrCell.textContent = `${matchup.withWinRate.toFixed(1)}%`;
            withWrCell.className = this.getWinRateClass(matchup.withWinRate);
        } else {
            withWrCell.textContent = '—';
            withWrCell.className = 'no-data';
        }

        // WITH Delta cell
        const withDeltaCell = document.createElement('td');
        if (matchup.withDelta !== null) {
            withDeltaCell.textContent = this.formatDelta(matchup.withDelta);
            withDeltaCell.className = this.getDeltaClass(matchup.withDelta);
        } else {
            withDeltaCell.textContent = '—';
            withDeltaCell.className = 'no-data';
        }

        // WITH Games cell
        const withGamesCell = document.createElement('td');
        if (matchup.withGames !== null) {
            withGamesCell.textContent = matchup.withGames.toLocaleString();
        } else {
            withGamesCell.textContent = '—';
            withGamesCell.className = 'no-data';
        }

        row.appendChild(heroCell);
        row.appendChild(vsWrCell);
        row.appendChild(vsDeltaCell);
        row.appendChild(vsGamesCell);
        row.appendChild(withWrCell);
        row.appendChild(withDeltaCell);
        row.appendChild(withGamesCell);

        // Make row clickable
        row.addEventListener('click', () => {
            if (hero) {
                this.showHeroDetails(hero);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        return row;
    }

    sortCombinedMatchupTable(table, matchups, column) {
        const currentSort = table.dataset.sortColumn;
        const currentDirection = table.dataset.sortDirection;

        // Determine new direction
        let newDirection = 'desc';
        if (currentSort === column && currentDirection === 'desc') {
            newDirection = 'asc';
        }

        // Sort matchups
        matchups.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // Handle null values (put them at the end)
            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return 1;
            if (bVal === null) return -1;

            // String comparison for name
            if (column === 'name') {
                return newDirection === 'desc' 
                    ? bVal.localeCompare(aVal)
                    : aVal.localeCompare(bVal);
            }

            // Numeric comparison
            return newDirection === 'desc' ? bVal - aVal : aVal - bVal;
        });

        // Update table headers
        const headers = table.querySelectorAll('th.sortable');
        headers.forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.column === column) {
                th.classList.add(`sorted-${newDirection}`);
            }
        });

        // Re-render tbody
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';
        matchups.forEach(matchup => {
            const row = this.createCombinedMatchupTableRow(matchup);
            tbody.appendChild(row);
        });

        // Update sort state
        table.dataset.sortColumn = column;
        table.dataset.sortDirection = newDirection;
    }

    createMatchupTable(container, matchups, type) {
        // Sort by win rate descending by default
        matchups.sort((a, b) => b.winRate - a.winRate);

        // Create table
        const table = document.createElement('table');
        table.className = 'matchup-table';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const headers = [
            { key: 'name', label: 'Hero', sortable: true, tooltip: 'Hero name' },
            { key: 'winRate', label: 'Win Rate', sortable: true, tooltip: 'Win rate in this matchup' },
            { key: 'delta', label: 'Δ vs Avg', sortable: true, tooltip: `Difference from ${this.currentHero.name}'s global win rate` },
            { key: 'games', label: 'Games', sortable: true, tooltip: 'Number of games played' }
        ];

        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.label;
            if (header.tooltip) {
                th.title = header.tooltip;
            }
            
            if (header.sortable) {
                th.className = 'sortable';
                if (header.key === 'winRate') {
                    th.classList.add('sorted-desc');
                }
                th.dataset.column = header.key;
                th.addEventListener('click', () => {
                    this.sortMatchupTable(table, matchups, header.key);
                });
            }
            
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        matchups.forEach(matchup => {
            const row = this.createMatchupTableRow(matchup);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);

        // Store current sort state
        table.dataset.sortColumn = 'winRate';
        table.dataset.sortDirection = 'desc';
        table.matchupsData = matchups;
    }

    createMatchupTableRow(matchup) {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';

        // Find hero data for image
        const hero = this.heroes.find(h => h.name === matchup.name);
        const slug = hero ? hero.slug : matchup.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Hero cell with image and name
        const heroCell = document.createElement('td');
        heroCell.className = 'hero-cell';
        heroCell.innerHTML = `
            <img src="images/heroes/${slug}.jpg" alt="${matchup.name}" class="hero-thumb">
            <span>${matchup.name}</span>
        `;

        // Win Rate cell
        const wrCell = document.createElement('td');
        wrCell.textContent = `${matchup.winRate.toFixed(1)}%`;
        wrCell.className = this.getWinRateClass(matchup.winRate);

        // Delta cell
        const deltaCell = document.createElement('td');
        deltaCell.textContent = this.formatDelta(matchup.delta);
        deltaCell.className = this.getDeltaClass(matchup.delta);

        // Games cell
        const gamesCell = document.createElement('td');
        gamesCell.textContent = matchup.games.toLocaleString();

        row.appendChild(heroCell);
        row.appendChild(wrCell);
        row.appendChild(deltaCell);
        row.appendChild(gamesCell);

        // Make row clickable
        row.addEventListener('click', () => {
            if (hero) {
                this.showHeroDetails(hero);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        return row;
    }

    sortMatchupTable(table, matchups, column) {
        const currentSort = table.dataset.sortColumn;
        const currentDirection = table.dataset.sortDirection;

        // Determine new direction
        let newDirection = 'desc';
        if (currentSort === column && currentDirection === 'desc') {
            newDirection = 'asc';
        }

        // Sort matchups
        matchups.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            // String comparison for name
            if (column === 'name') {
                return newDirection === 'desc' 
                    ? bVal.localeCompare(aVal)
                    : aVal.localeCompare(bVal);
            }

            // Numeric comparison
            return newDirection === 'desc' ? bVal - aVal : aVal - bVal;
        });

        // Update table headers
        const headers = table.querySelectorAll('th.sortable');
        headers.forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.column === column) {
                th.classList.add(`sorted-${newDirection}`);
            }
        });

        // Re-render tbody
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';
        matchups.forEach(matchup => {
            const row = this.createMatchupTableRow(matchup);
            tbody.appendChild(row);
        });

        // Update sort state
        table.dataset.sortColumn = column;
        table.dataset.sortDirection = newDirection;
    }

    formatDelta(delta) {
        if (delta === 0) return '0.0%';
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta.toFixed(1)}%`;
    }

    getDeltaClass(delta) {
        if (delta >= 3) return 'delta-high-positive';
        if (delta > 0) return 'delta-positive';
        if (delta <= -3) return 'delta-high-negative';
        if (delta < 0) return 'delta-negative';
        return 'delta-neutral';
    }

    getWinRateClass(winRate) {
        if (winRate >= 52) return 'delta-high-positive';
        if (winRate > 50) return 'delta-positive';
        if (winRate <= 48) return 'delta-high-negative';
        if (winRate < 50) return 'delta-negative';
        return 'delta-neutral';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.heroDetailsManager = new HeroDetailsManager();
});

