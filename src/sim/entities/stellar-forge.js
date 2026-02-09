import { Vector2D } from '../math';
import * as Constants from '../../constants';
import { ForgeCrunch } from './particles';
import { getGameRNG } from '../../seeded-random';
export class StellarForge {
    constructor(position, owner) {
        this.position = position;
        this.owner = owner;
        this.health = Constants.STELLAR_FORGE_MAX_HEALTH;
        this.maxHealth = Constants.STELLAR_FORGE_MAX_HEALTH;
        this.isReceivingLight = false;
        this.incomingLightPerSec = 0; // Track incoming light energy per second
        this.unitQueue = [];
        this.heroProductionUnitType = null;
        this.heroProductionRemainingSec = 0;
        this.heroProductionDurationSec = 0;
        this.isSelected = false;
        this.targetPosition = null;
        this.velocity = new Vector2D(0, 0);
        this.baseMaxSpeed = 50; // base pixels per second (at 100 light/sec, speed is doubled to 100 px/sec)
        this.acceleration = 30; // pixels per second^2
        this.deceleration = 50; // pixels per second^2
        this.slowRadiusPx = 80; // Distance to begin slow approach
        this.AVOIDANCE_BLEND_FACTOR = 0.6; // How much to blend avoidance with direct path
        this.radius = 40; // For rendering and selection
        this.crunchTimer = 0; // Timer until next crunch
        this.currentCrunch = null; // Active crunch effect
        this.pendingEnergy = 0; // Energy accumulated since last crunch
        this.minionPath = []; // Path that minions will follow
        this.moveOrder = 0; // Movement order indicator (0 = no order)
        this.rotation = 0; // Current rotation angle in radians
        // Initialize crunch timer with random offset to stagger crunches
        const rng = getGameRNG();
        this.crunchTimer = rng.nextFloat(0, Constants.FORGE_CRUNCH_INTERVAL);
    }
    /**
     * Set the path for minions to follow
     */
    setMinionPath(waypoints) {
        this.minionPath = waypoints.map((waypoint) => new Vector2D(waypoint.x, waypoint.y));
    }
    /**
     * Initialize default path to enemy base position
     */
    initializeDefaultPath(enemyBasePosition) {
        // Create a path from this base to the enemy base
        this.minionPath = [new Vector2D(enemyBasePosition.x, enemyBasePosition.y)];
    }
    /**
     * Check if forge can produce units (needs light)
     */
    canProduceUnits() {
        return this.isReceivingLight && this.health > 0;
    }
    /**
     * Attempt to produce a unit
     */
    produceUnit(unitType, cost, playerEnergy) {
        // Allow queuing even without sunlight (removed canProduceUnits check)
        if (this.health <= 0) {
            return false;
        }
        if (playerEnergy < cost) {
            return false;
        }
        this.unitQueue.push(unitType);
        return true;
    }
    enqueueHeroUnit(unitType) {
        this.unitQueue.push(unitType);
    }
    startHeroProductionIfIdle() {
        if (this.heroProductionUnitType || this.unitQueue.length === 0) {
            return;
        }
        const nextUnitType = this.unitQueue.shift();
        if (!nextUnitType) {
            return;
        }
        this.heroProductionUnitType = nextUnitType;
        this.heroProductionDurationSec = Constants.HERO_PRODUCTION_TIME_SEC;
        this.heroProductionRemainingSec = Constants.HERO_PRODUCTION_TIME_SEC;
    }
    advanceHeroProduction(deltaTime) {
        this.startHeroProductionIfIdle();
        if (!this.heroProductionUnitType) {
            return null;
        }
        if (!this.canProduceUnits()) {
            return null;
        }
        this.heroProductionRemainingSec = Math.max(0, this.heroProductionRemainingSec - deltaTime);
        if (this.heroProductionRemainingSec > 0) {
            return null;
        }
        const completedUnitType = this.heroProductionUnitType;
        this.heroProductionUnitType = null;
        this.heroProductionDurationSec = 0;
        this.heroProductionRemainingSec = 0;
        return completedUnitType;
    }
    /**
     * Update whether forge is receiving light from mirrors and calculate incoming light energy
     */
    updateLightStatus(mirrors, suns, asteroids = [], players = []) {
        this.isReceivingLight = false;
        this.incomingLightPerSec = 0; // Reset light accumulator
        for (const mirror of mirrors) {
            const linkedStructure = mirror.getLinkedStructure(this);
            if (linkedStructure !== this)
                continue;
            if (mirror.hasLineOfSightToLight(suns, asteroids) &&
                mirror.hasLineOfSightToForge(this, asteroids, players)) {
                this.isReceivingLight = true;
                // Accumulate energy from each mirror that has line of sight
                this.incomingLightPerSec += mirror.getEnergyRatePerSec();
            }
        }
    }
    /**
     * Calculate current max speed based on incoming light
     * 100 light/sec = 100% speed = 2x base speed (100 px/sec)
     * 0 light/sec = can't move
     */
    getCurrentMaxSpeed() {
        if (!this.isReceivingLight || this.incomingLightPerSec <= 0) {
            return 0; // Can't move without light
        }
        // Calculate speed multiplier: 100 light/sec = 2x base speed
        const speedMultiplier = Math.min(2.0, this.incomingLightPerSec / 100);
        return this.baseMaxSpeed * speedMultiplier;
    }
    /**
     * Update forge movement and crunch effects with obstacle avoidance
     */
    update(deltaTime, gameState = null) {
        // Update crunch timer
        if (this.health > 0 && this.isReceivingLight) {
            this.crunchTimer -= deltaTime;
        }
        // Update active crunch effect
        if (this.currentCrunch) {
            this.currentCrunch.update(deltaTime);
            if (!this.currentCrunch.isActive()) {
                this.currentCrunch = null;
            }
        }
        // Get current max speed based on light
        const currentMaxSpeed = this.getCurrentMaxSpeed();
        if (!this.targetPosition || currentMaxSpeed === 0) {
            // No target or no light, apply deceleration
            const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (speed > 0.1) {
                const decelAmount = this.deceleration * deltaTime;
                const factor = Math.max(0, (speed - decelAmount) / speed);
                this.velocity.x *= factor;
                this.velocity.y *= factor;
            }
            else {
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
        }
        else {
            // Moving toward target (only if we have light)
            const dx = this.targetPosition.x - this.position.x;
            const dy = this.targetPosition.y - this.position.y;
            const distanceToTarget = Math.sqrt(dx ** 2 + dy ** 2);
            if (distanceToTarget < 5) {
                // Reached target
                this.position.x = this.targetPosition.x;
                this.position.y = this.targetPosition.y;
                this.velocity.x = 0;
                this.velocity.y = 0;
                this.targetPosition = null;
            }
            else {
                // Calculate desired velocity direction
                let directionX = dx / distanceToTarget;
                let directionY = dy / distanceToTarget;
                // Add obstacle avoidance if gameState is provided
                if (gameState) {
                    const avoidanceDir = this.calculateObstacleAvoidance(gameState);
                    if (avoidanceDir) {
                        directionX += avoidanceDir.x * this.AVOIDANCE_BLEND_FACTOR;
                        directionY += avoidanceDir.y * this.AVOIDANCE_BLEND_FACTOR;
                        const length = Math.sqrt(directionX * directionX + directionY * directionY);
                        if (length > 0) {
                            directionX /= length;
                            directionY /= length;
                        }
                    }
                }
                if (distanceToTarget <= this.slowRadiusPx) {
                    const slowFactor = Math.max(0, distanceToTarget / this.slowRadiusPx);
                    const desiredSpeed = currentMaxSpeed * slowFactor;
                    this.velocity.x = directionX * desiredSpeed;
                    this.velocity.y = directionY * desiredSpeed;
                }
                else {
                    // Apply acceleration toward target
                    this.velocity.x += directionX * this.acceleration * deltaTime;
                    this.velocity.y += directionY * this.acceleration * deltaTime;
                    // Clamp to max speed
                    const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
                    if (currentSpeed > currentMaxSpeed) {
                        this.velocity.x = (this.velocity.x / currentSpeed) * currentMaxSpeed;
                        this.velocity.y = (this.velocity.y / currentSpeed) * currentMaxSpeed;
                    }
                }
            }
        }
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }
    /**
     * Calculate obstacle avoidance direction for smooth pathfinding
     */
    calculateObstacleAvoidance(gameState) {
        let avoidX = 0;
        let avoidY = 0;
        let avoidCount = 0;
        const avoidanceRange = 80; // Look ahead distance
        // Check nearby obstacles
        for (const sun of gameState.suns) {
            const dx = this.position.x - sun.position.x;
            const dy = this.position.y - sun.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = sun.radius + this.radius + 10;
            if (dist < minDist + avoidanceRange) {
                const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                avoidX += (dx / dist) * avoidStrength;
                avoidY += (dy / dist) * avoidStrength;
                avoidCount++;
            }
        }
        // Check other forges and mirrors
        for (const player of gameState.players) {
            // Check other stellar forges
            if (player.stellarForge && player.stellarForge !== this) {
                const forge = player.stellarForge;
                const dx = this.position.x - forge.position.x;
                const dy = this.position.y - forge.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.radius + forge.radius + 10;
                if (dist < minDist + avoidanceRange && dist > 0) {
                    const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                    avoidX += (dx / dist) * avoidStrength;
                    avoidY += (dy / dist) * avoidStrength;
                    avoidCount++;
                }
            }
            // Check mirrors
            for (const mirror of player.solarMirrors) {
                const dx = this.position.x - mirror.position.x;
                const dy = this.position.y - mirror.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.radius + 30;
                if (dist < minDist + avoidanceRange) {
                    const avoidStrength = (minDist + avoidanceRange - dist) / avoidanceRange;
                    avoidX += (dx / dist) * avoidStrength;
                    avoidY += (dy / dist) * avoidStrength;
                    avoidCount++;
                }
            }
        }
        if (avoidCount > 0) {
            const length = Math.sqrt(avoidX * avoidX + avoidY * avoidY);
            if (length > 0) {
                return new Vector2D(avoidX / length, avoidY / length);
            }
        }
        return null;
    }
    /**
     * Check if a crunch should happen and trigger it if ready
     * Returns the amount of energy to use for spawning minions
     */
    shouldCrunch() {
        if (this.crunchTimer <= 0 && this.health > 0 && this.isReceivingLight) {
            this.crunchTimer = Constants.FORGE_CRUNCH_INTERVAL;
            this.currentCrunch = new ForgeCrunch(new Vector2D(this.position.x, this.position.y));
            this.currentCrunch.start();
            // Rotate forge by 1/6 turn (60 degrees = π/3 radians)
            this.rotation += Math.PI / 3;
            // Keep rotation within 0 to 2π
            if (this.rotation >= Math.PI * 2) {
                this.rotation -= Math.PI * 2;
            }
            // Return the pending energy for minion spawning
            const energyForMinions = this.pendingEnergy;
            this.pendingEnergy = 0;
            return energyForMinions;
        }
        return 0;
    }
    /**
     * Add energy to pending amount (called when mirrors generate energy)
     */
    addPendingEnergy(amount) {
        this.pendingEnergy += amount;
    }
    /**
     * Get the current crunch effect if active
     */
    getCurrentCrunch() {
        return this.currentCrunch;
    }
    /**
     * Set movement target
     */
    setTarget(target) {
        this.targetPosition = new Vector2D(target.x, target.y);
    }
    /**
     * Toggle selection state
     */
    toggleSelection() {
        this.isSelected = !this.isSelected;
    }
    /**
     * Check if a point is inside the forge (for click detection)
     */
    containsPoint(point) {
        const distance = this.position.distanceTo(point);
        return distance <= this.radius;
    }
}
