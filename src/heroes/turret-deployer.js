"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTurretDeployerHero = void 0;
const createTurretDeployerHero = (deps) => {
    const { Unit, Vector2D, Constants } = deps;
    /**
     * Deployed turret that attaches to asteroids
     */
    class DeployedTurret {
        constructor(position, owner, attachedToAsteroid = null) {
            this.position = position;
            this.owner = owner;
            this.attachedToAsteroid = attachedToAsteroid;
            this.maxHealth = Constants.DEPLOYED_TURRET_MAX_HEALTH;
            this.attackCooldown = 0;
            this.target = null;
            this.firingAnimationProgress = 0; // 0-1 progress through firing animation
            this.isFiring = false; // Whether currently in firing animation
            this.health = this.maxHealth;
        }
        update(deltaTime, enemies) {
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
        isTargetDead(target) {
            if ('health' in target) {
                return target.health <= 0;
            }
            return false;
        }
        findNearestEnemy(enemies) {
            let nearest = null;
            let minDistance = Infinity;
            for (const enemy of enemies) {
                if ('health' in enemy && enemy.health <= 0)
                    continue;
                const distance = this.position.distanceTo(enemy.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = enemy;
                }
            }
            return nearest;
        }
        attack(target) {
            if ('health' in target) {
                target.health -= Constants.DEPLOYED_TURRET_ATTACK_DAMAGE;
            }
        }
        takeDamage(amount) {
            this.health -= amount;
        }
        isDead() {
            return this.health <= 0;
        }
    }
    /**
     * Turret Deployer hero unit (Velaris faction) - deploys turrets on asteroids
     */
    class TurretDeployer extends Unit {
        constructor(position, owner) {
            super(position, owner, Constants.TURRET_DEPLOYER_MAX_HEALTH, Constants.TURRET_DEPLOYER_ATTACK_RANGE, Constants.TURRET_DEPLOYER_ATTACK_DAMAGE, Constants.TURRET_DEPLOYER_ATTACK_SPEED, Constants.TURRET_DEPLOYER_ABILITY_COOLDOWN);
            this.isHero = true; // TurretDeployer is a hero unit for Velaris faction
        }
        /**
         * Use Turret Deployer's turret placement ability
         * The turret deployment will be handled by GameState which has access to asteroids
         */
        useAbility(direction) {
            if (!super.useAbility(direction)) {
                return false;
            }
            // Signal that ability was used, GameState will handle turret placement
            return true;
        }
    }
    return { TurretDeployer, DeployedTurret };
};
exports.createTurretDeployerHero = createTurretDeployerHero;
