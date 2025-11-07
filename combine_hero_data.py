"""
Script to combine hero stats and matchup data with statistical analysis.
Calculates delta win rates with confidence intervals to handle low sample sizes.

Usage: python combine_hero_data.py
"""

import json
import math
from typing import Dict, Optional, Tuple
import argparse


class HeroDataCombiner:
    """Combines hero statistics and matchup data with statistical analysis"""

    def __init__(
        self,
        confidence_level: float = 0.80,
        min_games: int = 100,
        max_delta: float = 5.0,
    ):
        """
        Initialize the combiner

        Args:
            confidence_level: Confidence level for intervals (default: 0.80 for 80%)
            min_games: Minimum games for matchup data (default: 100)
            max_delta: Maximum absolute delta value (default: 5.0%)
        """
        self.confidence_level = confidence_level
        self.min_games = min_games
        self.max_delta = max_delta
        # Z-score for confidence level (80% = 1.28, 90% = 1.645, 95% = 1.96)
        self.z_score = self._get_z_score(confidence_level)

    def _get_z_score(self, confidence_level: float) -> float:
        """
        Get Z-score for confidence level

        Args:
            confidence_level: Confidence level (e.g., 0.80, 0.90, 0.95)

        Returns:
            Z-score value
        """
        z_scores = {
            0.80: 1.282,
            0.85: 1.440,
            0.90: 1.645,
            0.95: 1.960,
            0.99: 2.576,
        }
        return z_scores.get(confidence_level, 1.282)

    def wilson_score_interval(
        self, wins: int, total: int
    ) -> Tuple[float, float, float]:
        """
        Calculate Wilson score confidence interval for win rate

        This is more accurate than normal approximation, especially for small samples.

        Args:
            wins: Number of wins
            total: Total number of games

        Returns:
            Tuple of (win_rate, lower_bound, upper_bound) as percentages
        """
        if total == 0:
            return (50.0, 50.0, 50.0)

        p = wins / total
        z = self.z_score
        z2 = z * z

        denominator = 1 + z2 / total
        center = (p + z2 / (2 * total)) / denominator
        margin = (
            z * math.sqrt((p * (1 - p) / total) + (z2 / (4 * total * total)))
        ) / denominator

        lower = max(0, center - margin)
        upper = min(1, center + margin)

        return (p * 100, lower * 100, upper * 100)

    def calculate_delta_with_confidence(
        self,
        wins: int,
        total: int,
        baseline_wr: float = 50.0,
        min_games: int = 0,
        max_delta: float = None,
    ) -> Dict:
        """
        Calculate delta win rate with confidence interval

        Args:
            wins: Number of wins
            total: Total number of games
            baseline_wr: Baseline win rate to compare against (default: 50%)
            min_games: Minimum games threshold (set delta to 0 if below, default: 0)
            max_delta: Maximum absolute delta value (cap at this value, default: None)

        Returns:
            Dict with win rate statistics
        """
        if total == 0 or total < min_games:
            return {
                "games": total,
                "wins": wins,
                "losses": total - wins,
                "win_rate": baseline_wr,
                "delta": 0.0,
                "lower_confidence_delta": 0.0,
                "upper_confidence_delta": 0.0,
                "confidence_adjusted_delta": 0.0,
            }

        losses = total - wins
        win_rate, lower_ci, upper_ci = self.wilson_score_interval(wins, total)

        # Calculate deltas from baseline
        delta = win_rate - baseline_wr
        lower_delta = lower_ci - baseline_wr
        upper_delta = upper_ci - baseline_wr

        # Use the delta closest to zero (smallest absolute value) to regress toward the mean
        confidence_adjusted_delta = min(
            (delta, lower_delta, upper_delta), key=lambda x: abs(x)
        )

        # Apply max delta cap if specified
        if max_delta is not None:
            delta = max(-max_delta, min(max_delta, delta))
            lower_delta = max(-max_delta, min(max_delta, lower_delta))
            upper_delta = max(-max_delta, min(max_delta, upper_delta))
            confidence_adjusted_delta = max(
                -max_delta, min(max_delta, confidence_adjusted_delta)
            )

        return {
            "games": total,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 2),
            "delta": round(delta, 2),
            "lower_confidence_delta": round(lower_delta, 2),
            "upper_confidence_delta": round(upper_delta, 2),
            "confidence_adjusted_delta": round(confidence_adjusted_delta, 2),
        }

    def process_global_stats(self, hero_name: str, stats: Dict) -> Dict:
        """
        Process global hero statistics

        Args:
            hero_name: Name of the hero
            stats: Raw stats from API

        Returns:
            Processed stats with deltas
        """
        wins = int(stats.get("wins", 0))
        losses = int(stats.get("losses", 0))
        games = wins + losses

        # Calculate win rate with confidence interval
        result = self.calculate_delta_with_confidence(wins, games, baseline_wr=50.0)

        # Add additional stats from API
        result.update(
            {
                "bans": int(stats.get("bans", 0)),
                "ban_rate": float(stats.get("ban_rate", 0)),
                "popularity": float(stats.get("popularity", 0)),
                "pick_rate": float(stats.get("pick_rate", 0)),
            }
        )

        return result

    def process_map_stats(self, map_stats: Dict, global_wr: float) -> Dict:
        """
        Process per-map statistics for a hero

        Args:
            map_stats: Dictionary of map -> stats
            global_wr: Global win rate for this hero

        Returns:
            Processed map stats with deltas
        """
        processed = {}

        for map_name, stats in map_stats.items():
            wins = int(stats.get("wins", 0))
            losses = int(stats.get("losses", 0))
            games = wins + losses

            # Calculate delta from global win rate
            map_result = self.calculate_delta_with_confidence(
                wins, games, baseline_wr=global_wr
            )

            # Add additional stats
            map_result.update(
                {
                    "bans": int(stats.get("bans", 0)),
                    "ban_rate": float(stats.get("ban_rate", 0)),
                    "popularity": float(stats.get("popularity", 0)),
                    "pick_rate": float(stats.get("pick_rate", 0)),
                }
            )

            processed[map_name] = map_result

        return processed

    def process_matchup_stats(
        self,
        matchup_data: Dict,
        global_wr: float,
        min_games: int = 100,
        max_delta: float = 5.0,
    ) -> Dict:
        """
        Process matchup statistics for a hero

        Args:
            matchup_data: Dictionary of opponent -> matchup stats
            global_wr: Global win rate for this hero
            min_games: Minimum games to consider matchup (default: 100)
            max_delta: Maximum absolute delta value (default: 5.0%)

        Returns:
            Processed matchup stats with deltas
        """
        processed = {}

        for opponent_name, matchup in matchup_data.items():
            ally_data = matchup.get("ally", {})
            enemy_data = matchup.get("enemy", {})

            # Process ally (teammate) stats with filters
            ally_wins = int(ally_data.get("wins_with", 0))
            ally_losses = int(ally_data.get("losses_with", 0))
            ally_games = ally_wins + ally_losses

            ally_stats = self.calculate_delta_with_confidence(
                ally_wins,
                ally_games,
                baseline_wr=global_wr,
                min_games=min_games,
                max_delta=max_delta,
            )

            # Process enemy (opponent) stats with filters
            enemy_wins = int(enemy_data.get("wins_against", 0))
            enemy_losses = int(enemy_data.get("losses_against", 0))
            enemy_games = enemy_wins + enemy_losses

            enemy_stats = self.calculate_delta_with_confidence(
                enemy_wins,
                enemy_games,
                baseline_wr=global_wr,
                min_games=min_games,
                max_delta=max_delta,
            )

            processed[opponent_name] = {
                "ally": ally_stats,
                "enemy": enemy_stats,
            }

        return processed

    def combine_data(
        self,
        stats_file: str = "data/hero_stats.json",
        matchups_file: str = "data/hero_matchups.json",
        output_file: str = "data/hero_data_combined.json",
    ) -> Dict:
        """
        Combine hero stats and matchup data

        Args:
            stats_file: Path to hero stats JSON
            matchups_file: Path to hero matchups JSON
            output_file: Path to output JSON

        Returns:
            Combined data dictionary
        """
        print("=" * 70)
        print("COMBINING HERO DATA")
        print("=" * 70)
        print(f"Confidence Level: {self.confidence_level * 100}%")
        print(f"Z-Score: {self.z_score}")
        print(f"Min Games Threshold: {self.min_games}")
        print(f"Max Delta Cap: ±{self.max_delta}%")
        print()

        # Load stats data
        print(f"Loading {stats_file}...")
        with open(stats_file, "r", encoding="utf-8") as f:
            stats_data = json.load(f)

        global_stats = stats_data.get("global_stats", {})
        map_stats = stats_data.get("map_stats", {})
        stats_metadata = stats_data.get("metadata", {})

        print(f"✓ Loaded stats for {len(global_stats)} heroes")

        # Load matchups data
        print(f"Loading {matchups_file}...")
        with open(matchups_file, "r", encoding="utf-8") as f:
            matchups_data = json.load(f)

        matchups = matchups_data.get("matchups", {})
        matchups_metadata = matchups_data.get("metadata", {})

        print(f"✓ Loaded matchups for {len(matchups)} heroes")
        print()

        # Process each hero
        print("Processing hero data...")
        combined_heroes = {}

        for hero_name in global_stats.keys():
            print(f"  Processing {hero_name}...")

            # Process global stats
            hero_global = self.process_global_stats(hero_name, global_stats[hero_name])

            # Get global win rate for this hero
            global_wr = hero_global["win_rate"]

            # Process map stats (if available)
            hero_maps = {}
            if map_stats:
                for map_name, map_heroes in map_stats.items():
                    if hero_name in map_heroes:
                        hero_maps[map_name] = self.calculate_delta_with_confidence(
                            int(map_heroes[hero_name].get("wins", 0)),
                            int(map_heroes[hero_name].get("wins", 0))
                            + int(map_heroes[hero_name].get("losses", 0)),
                            baseline_wr=global_wr,
                        )
                        # Add additional stats
                        hero_maps[map_name].update(
                            {
                                "bans": int(map_heroes[hero_name].get("bans", 0)),
                                "ban_rate": float(
                                    map_heroes[hero_name].get("ban_rate", 0)
                                ),
                                "popularity": float(
                                    map_heroes[hero_name].get("popularity", 0)
                                ),
                                "pick_rate": float(
                                    map_heroes[hero_name].get("pick_rate", 0)
                                ),
                            }
                        )

            # Process matchup stats (if available)
            hero_matchups = {}
            if hero_name in matchups:
                hero_matchups = self.process_matchup_stats(
                    matchups[hero_name],
                    global_wr,
                    min_games=self.min_games,
                    max_delta=self.max_delta,
                )

            # Combine all data for this hero
            combined_heroes[hero_name] = {
                "global": hero_global,
                "maps": hero_maps,
                "matchups": hero_matchups,
            }

        print(f"\n✓ Processed {len(combined_heroes)} heroes")

        # Create combined result
        result = {
            "metadata": {
                "stats_patch": stats_metadata.get("minor_patch", "unknown"),
                "matchups_patch": matchups_metadata.get("minor_patch", "unknown"),
                "game_type": stats_metadata.get("game_type", "Storm League"),
                "confidence_level": self.confidence_level,
                "z_score": self.z_score,
                "min_games_threshold": self.min_games,
                "max_delta_cap": self.max_delta,
                "combined_at": stats_metadata.get("fetched_at", "unknown"),
            },
            "heroes": combined_heroes,
        }

        return result

    def save_combined_data(self, data: Dict, output_file: str):
        """
        Save combined data to JSON file

        Args:
            data: Combined data dictionary
            output_file: Output file path
        """
        print(f"\nSaving combined data to {output_file}...")

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        # Get file size
        import os

        file_size = os.path.getsize(output_file)
        size_mb = file_size / (1024 * 1024)

        print(f"✓ Saved to {output_file}")
        print(f"  File size: {size_mb:.2f} MB")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description="Combine hero stats and matchup data with statistical analysis"
    )
    parser.add_argument(
        "--stats",
        "-s",
        default="data/hero_stats.json",
        help="Hero stats JSON file (default: data/hero_stats.json)",
    )
    parser.add_argument(
        "--matchups",
        "-m",
        default="data/hero_matchups.json",
        help="Hero matchups JSON file (default: data/hero_matchups.json)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="data/hero_data_combined.json",
        help="Output JSON file (default: data/hero_data_combined.json)",
    )
    parser.add_argument(
        "--confidence",
        "-c",
        type=float,
        default=0.80,
        help="Confidence level (default: 0.80 for 80%%)",
    )
    parser.add_argument(
        "--min-games",
        type=int,
        default=100,
        help="Minimum games for matchup data (default: 100)",
    )
    parser.add_argument(
        "--max-delta",
        type=float,
        default=5.0,
        help="Maximum absolute delta value in %% (default: 5.0)",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("HERO DATA COMBINER")
    print("=" * 70)
    print(f"Stats file: {args.stats}")
    print(f"Matchups file: {args.matchups}")
    print(f"Output file: {args.output}")
    print(f"Confidence level: {args.confidence * 100}%")
    print(f"Min games threshold: {args.min_games}")
    print(f"Max delta cap: ±{args.max_delta}%")
    print()

    # Create combiner
    combiner = HeroDataCombiner(
        confidence_level=args.confidence,
        min_games=args.min_games,
        max_delta=args.max_delta,
    )

    # Combine data
    combined_data = combiner.combine_data(
        stats_file=args.stats,
        matchups_file=args.matchups,
        output_file=args.output,
    )

    # Save combined data
    combiner.save_combined_data(combined_data, args.output)

    # Print summary
    print("\n" + "=" * 70)
    print("COMPLETE!")
    print("=" * 70)
    print(f"Total heroes: {len(combined_data['heroes'])}")
    print(f"\nOutput file: {args.output}")
    print("\nData structure:")
    print("  - Global stats with confidence-adjusted deltas")
    print("  - Per-map stats with deltas from global")
    print("  - Matchup stats (ally & enemy) with deltas from global")
    print("\nFilters applied:")
    print(f"  - Matchups with < {args.min_games} games: delta set to 0")
    print(f"  - Deltas capped at ±{args.max_delta}%")
    print("\nMetrics included:")
    print("  - win_rate: Actual win rate")
    print("  - delta: Raw delta from baseline (capped)")
    print("  - confidence_adjusted_delta: Conservative delta (capped)")
    print("\nUse confidence_adjusted_delta for draft evaluation!")


if __name__ == "__main__":
    main()
