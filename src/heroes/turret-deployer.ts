import type { Asteroid, CombatTarget, Player, Unit, Vector2D } from '../game-core';

type TurretDeployerHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createTurretDeployerHero = (deps: TurretDeployerHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Deployed turret that attaches to asteroids
     */
    class DeployedTurret {
        health: number;
        maxHealth: number = Constants.DEPLOYED_TURRET_MAX_HEALTH;
        attackCooldown: number = 0;
        target: CombatTarget | null = null;
        firingAnimationProgress: number = 0; // 0-1 progress through firing animation
        isFiring: boolean = false; // Whether currently in firing animation

        constructor(
            public position: Vector2D,
            public owner: Player,
            public attachedToAsteroid: Asteroid | null = null
        ) {
            this.health = this.maxHealth;
        }

        update(deltaTime: number, enemies: CombatTarget[]): void {
            // Update attack cooldown
            if (this.attackCooldown > 0) {
                this.attackCooldown -= deltaTime;
            }

            // Update firing animation
            if (this.isFiring) {
                // Animation completes in DEPLOYED_TURRET_ANIMATION_DURATION seconds
                this.firingAnimationProgress += deltaTime / Constants.DEPLOYED_TURRET_ANIMATION_DURATION;
                if (this.firingAnimationProgress >= 1.0) {
                    this.firingAnimationProgress = 0;
                    this.isFiring = false;
                }
            }

            // Find target if don't have one or current target is dead
            if (!this.target || this.isTargetDead(this.target)) {
                this.target = this.findNearestEnemy(enemies);
            }

            // Attack if target in range and cooldown ready
            if (this.target && this.attackCooldown <= 0) {
                const distance = this.position.distanceTo(this.target.position);
                if (distance <= Constants.DEPLOYED_TURRET_ATTACK_RANGE) {
                    this.attack(this.target);
                    this.attackCooldown = 1.0 / Constants.DEPLOYED_TURRET_ATTACK_SPEED;
                    this.isFiring = true;
                    this.firingAnimationProgress = 0;
                }
            }
        }

        private isTargetDead(target: CombatTarget): boolean {
            if ('health' in target) {
                return target.health <= 0;
            }
            return false;
        }

        private findNearestEnemy(enemies: CombatTarget[]): CombatTarget | null {
            let nearest: CombatTarget | null = null;
            let minDistance = Infinity;

            for (const enemy of enemies) {
                if ('health' in enemy && enemy.health <= 0) continue;

                const distance = this.position.distanceTo(enemy.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = enemy;
                }
            }

            return nearest;
        }

        attack(target: CombatTarget): void {
            if ('health' in target) {
                target.health -= Constants.DEPLOYED_TURRET_ATTACK_DAMAGE;
            }
        }

        takeDamage(amount: number): void {
            this.health -= amount;
        }

        isDead(): boolean {
            return this.health <= 0;
        }
    }

    /**
     * Turret Deployer hero unit (Solari faction) - deploys turrets on asteroids
     */
    class TurretDeployer extends Unit {
        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.TURRET_DEPLOYER_MAX_HEALTH,
                Constants.TURRET_DEPLOYER_ATTACK_RANGE,
                Constants.TURRET_DEPLOYER_ATTACK_DAMAGE,
                Constants.TURRET_DEPLOYER_ATTACK_SPEED,
                Constants.TURRET_DEPLOYER_ABILITY_COOLDOWN
            );
            this.isHero = true; // TurretDeployer is a hero unit for Solari faction
        }

        /**
         * Use Turret Deployer's turret placement ability
         * The turret deployment will be handled by GameState which has access to asteroids
         */
        useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            // Signal that ability was used, GameState will handle turret placement
            return true;
        }
    }

    return { TurretDeployer, DeployedTurret };
};
