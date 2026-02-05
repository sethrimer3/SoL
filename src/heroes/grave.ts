import type { Asteroid, CombatTarget, Player, Unit, Vector2D } from '../game-core';

type GraveHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createGraveHero = (deps: GraveHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Small particle that zips between large particles
     */
    class GraveSmallParticle {
        currentTargetIndex: number;
        nextTargetIndex: number;
        progress: number = 0; // 0 to 1, progress from current to next target

        constructor(
            public position: Vector2D,
            startIndex: number,
            endIndex: number
        ) {
            this.currentTargetIndex = startIndex;
            this.nextTargetIndex = endIndex;
        }

        /**
         * Update small particle movement between large particles
         */
        update(deltaTime: number, largeParticlePositions: Vector2D[]): void {
            if (largeParticlePositions.length < 2) return;

            const currentPos = largeParticlePositions[this.currentTargetIndex % largeParticlePositions.length];
            const nextPos = largeParticlePositions[this.nextTargetIndex % largeParticlePositions.length];

            // Move toward next target
            const distance = currentPos.distanceTo(nextPos);
            if (distance > 0.1) { // Avoid division by zero
                this.progress += (Constants.GRAVE_SMALL_PARTICLE_SPEED / distance) * deltaTime;
            } else {
                this.progress = 1; // Skip to next target if too close
            }

            if (this.progress >= 1) {
                // Reached target, pick new target
                this.progress = 0;
                this.currentTargetIndex = this.nextTargetIndex;
                // Pick a random different target
                do {
                    this.nextTargetIndex = Math.floor(Math.random() * largeParticlePositions.length);
                } while (this.nextTargetIndex === this.currentTargetIndex && largeParticlePositions.length > 1);
            }

            // Interpolate position
            this.position.x = currentPos.x + (nextPos.x - currentPos.x) * this.progress;
            this.position.y = currentPos.y + (nextPos.y - currentPos.y) * this.progress;
        }
    }

    /**
     * Large projectile that forms polygon corners when not attacking
     */
    class GraveProjectile {
        velocity: Vector2D;
        lifetime: number = 0;
        isAttacking: boolean = false;
        targetEnemy: CombatTarget | null = null;
        trail: Vector2D[] = []; // Trail of positions
        targetAngle: number; // Target angle for polygon formation

        constructor(
            public position: Vector2D,
            velocity: Vector2D,
            public owner: Player,
            public index: number
        ) {
            this.velocity = velocity;
            this.targetAngle = (index / Constants.GRAVE_NUM_PROJECTILES) * Math.PI * 2;
        }

        /**
         * Update projectile position - form polygon when not attacking, seek target when attacking
         */
        update(deltaTime: number, gravePosition: Vector2D): void {
            if (!this.isAttacking) {
                // Form polygon shape - move toward target position on polygon
                const targetX = gravePosition.x + Math.cos(this.targetAngle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                const targetY = gravePosition.y + Math.sin(this.targetAngle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                
                const dx = targetX - this.position.x;
                const dy = targetY - this.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    // Smoothly move toward target position
                    const speed = Constants.GRAVE_PROJECTILE_MIN_SPEED;
                    const moveDistance = Math.min(speed * deltaTime, distance);
                    this.position.x += (dx / distance) * moveDistance;
                    this.position.y += (dy / distance) * moveDistance;
                    
                    // Update velocity for consistent movement
                    this.velocity.x = (dx / distance) * speed;
                    this.velocity.y = (dy / distance) * speed;
                }
            } else {
                // Attacking - move toward target
                this.position.x += this.velocity.x * deltaTime;
                this.position.y += this.velocity.y * deltaTime;
            }

            // Update trail when attacking
            if (this.isAttacking) {
                this.trail.push(new Vector2D(this.position.x, this.position.y));
                if (this.trail.length > Constants.GRAVE_PROJECTILE_TRAIL_LENGTH) {
                    this.trail.shift(); // Remove oldest trail point
                }
                this.lifetime += deltaTime;
                
                // Return to formation after a certain lifetime (for ability shots without target)
                if (!this.targetEnemy && this.lifetime > 2.0) {
                    this.returnToOrbit();
                }
            }

            // Check if hit target
            if (this.isAttacking && this.targetEnemy) {
                const distance = this.position.distanceTo(this.targetEnemy.position);
                if (distance < Constants.GRAVE_PROJECTILE_HIT_DISTANCE) {
                    // Hit the target
                    if ('health' in this.targetEnemy) {
                        this.targetEnemy.health -= Constants.GRAVE_ATTACK_DAMAGE;
                    }
                    // Return to polygon formation
                    this.returnToOrbit();
                }
            }
        }

        /**
         * Launch projectile toward target
         */
        launchAtTarget(target: CombatTarget): void {
            this.isAttacking = true;
            this.targetEnemy = target;
            this.trail = [];
            this.lifetime = 0;

            // Set velocity toward target
            const dx = target.position.x - this.position.x;
            const dy = target.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0) {
                const dirX = dx / distance;
                const dirY = dy / distance;
                this.velocity.x = dirX * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
                this.velocity.y = dirY * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
            }
        }

        /**
         * Launch projectile in a direction (for ability use)
         */
        launchInDirection(direction: Vector2D): void {
            this.isAttacking = true;
            this.targetEnemy = null; // No specific target
            this.trail = [];
            this.lifetime = 0;

            // Set velocity in the given direction
            this.velocity.x = direction.x * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
            this.velocity.y = direction.y * Constants.GRAVE_PROJECTILE_LAUNCH_SPEED;
        }

        /**
         * Reset projectile to orbit mode
         */
        returnToOrbit(): void {
            this.isAttacking = false;
            this.targetEnemy = null;
            this.trail = [];
            this.lifetime = 0;
        }
    }

    /**
     * Grave unit - has orbiting projectiles that attack enemies (Velaris faction hero)
     */
    class Grave extends Unit {
        projectiles: GraveProjectile[] = [];
        smallParticles: GraveSmallParticle[] = [];
        smallParticleCount: number = Constants.GRAVE_MAX_SMALL_PARTICLES; // Start with full particles
        projectileLaunchCooldown: number = 0;
        smallParticleRegenTimer: number = 0;
        isUsingAbility: boolean = false; // True while ability arrow is being dragged

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.GRAVE_MAX_HEALTH,
                Constants.GRAVE_ATTACK_RANGE * Constants.GRAVE_HERO_ATTACK_RANGE_MULTIPLIER, // Hero units have reduced range
                Constants.GRAVE_ATTACK_DAMAGE,
                Constants.GRAVE_ATTACK_SPEED,
                5.0 // Default ability cooldown
            );
            this.isHero = true; // Grave is a hero unit for Velaris faction

            // Initialize large projectiles in polygon formation
            for (let i = 0; i < Constants.GRAVE_NUM_PROJECTILES; i++) {
                const angle = (i / Constants.GRAVE_NUM_PROJECTILES) * Math.PI * 2;
                const offsetX = Math.cos(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;
                const offsetY = Math.sin(angle) * Constants.GRAVE_PROJECTILE_ORBIT_RADIUS;

                this.projectiles.push(
                    new GraveProjectile(
                        new Vector2D(position.x + offsetX, position.y + offsetY),
                        new Vector2D(0, 0),
                        owner,
                        i
                    )
                );
            }

            // Initialize small particles
            this.initializeSmallParticles();
        }

        /**
         * Initialize or reinitialize small particles
         */
        initializeSmallParticles(): void {
            this.smallParticles = [];
            const numSmallParticles = Math.floor(this.smallParticleCount);
            for (let i = 0; i < numSmallParticles; i++) {
                const startIndex = i % this.projectiles.length;
                const endIndex = (i + 1) % this.projectiles.length;
                const startPos = this.projectiles[startIndex].position;
                
                this.smallParticles.push(
                    new GraveSmallParticle(
                        new Vector2D(startPos.x, startPos.y),
                        startIndex,
                        endIndex
                    )
                );
            }
        }

        /**
         * Update grave and its projectiles
         */
        update(deltaTime: number, enemies: CombatTarget[], allUnits: Unit[], asteroids: Asteroid[] = []): void {
            // Update base unit logic
            super.update(deltaTime, enemies, allUnits, asteroids);

            // Regenerate small particles over time
            this.smallParticleRegenTimer += deltaTime;
            const regenInterval = 1.0 / Constants.GRAVE_SMALL_PARTICLE_REGEN_RATE;
            
            while (this.smallParticleRegenTimer >= regenInterval && this.smallParticleCount < Constants.GRAVE_MAX_SMALL_PARTICLES) {
                this.smallParticleCount++;
                this.smallParticleRegenTimer -= regenInterval;
                
                // Add a new small particle if needed
                if (this.smallParticles.length < Math.floor(this.smallParticleCount)) {
                    const startIndex = this.smallParticles.length % this.projectiles.length;
                    const endIndex = (this.smallParticles.length + 1) % this.projectiles.length;
                    const startPos = this.projectiles[startIndex].position;
                    
                    this.smallParticles.push(
                        new GraveSmallParticle(
                            new Vector2D(startPos.x, startPos.y),
                            startIndex,
                            endIndex
                        )
                    );
                }
            }

            // Update projectile launch cooldown
            if (this.projectileLaunchCooldown > 0) {
                this.projectileLaunchCooldown -= deltaTime;
            }

            // Get positions of large particles for small particle movement
            const largeParticlePositions = this.projectiles.map(p => p.position);

            // Update all large projectiles
            for (const projectile of this.projectiles) {
                projectile.update(deltaTime, this.position);
            }

            // Update all small particles
            for (const smallParticle of this.smallParticles) {
                smallParticle.update(deltaTime, largeParticlePositions);
            }

            // Launch projectiles at enemies if conditions are met
            if (this.canLaunchProjectile()) {
                const distance = this.position.distanceTo(this.target!.position);
                if (distance <= this.attackRange) {
                    // Find an available projectile (not currently attacking)
                    const availableProjectile = this.projectiles.find((projectile) => !projectile.isAttacking);
                    if (availableProjectile) {
                        availableProjectile.launchAtTarget(this.target!);
                        this.projectileLaunchCooldown = 1.0 / this.attackSpeed;
                        
                        // Consume small particles
                        this.smallParticleCount -= Constants.GRAVE_SMALL_PARTICLES_PER_ATTACK;
                        
                        // Remove small particles from visual array
                        const particlesToRemove = Constants.GRAVE_SMALL_PARTICLES_PER_ATTACK;
                        this.smallParticles.splice(0, Math.min(particlesToRemove, this.smallParticles.length));
                    }
                }
            }
        }

        /**
         * Check if the Grave can launch a projectile
         */
        private canLaunchProjectile(): boolean {
            return !this.isUsingAbility 
                && this.target !== null
                && this.projectileLaunchCooldown <= 0 
                && this.smallParticleCount >= Constants.GRAVE_SMALL_PARTICLES_PER_ATTACK;
        }

        /**
         * Grave doesn't use the base attack (projectiles do the damage)
         */
        attack(target: CombatTarget): void {
            // Projectiles handle the actual attacking
        }

        /**
         * Use special ability - fling all large particles at once
         */
        useAbility(direction: Vector2D): boolean {
            // Check if ability is ready
            if (!super.useAbility(direction)) {
                return false;
            }

            // Find all available (non-attacking) large projectiles
            const availableProjectiles = this.projectiles.filter(p => !p.isAttacking);
            
            if (availableProjectiles.length === 0) {
                // No projectiles available
                return false;
            }

            // Launch all available projectiles in the ability direction
            for (const projectile of availableProjectiles) {
                projectile.launchInDirection(direction);
            }

            // Use all available small particles
            const particlesUsed = Math.min(this.smallParticleCount, Constants.GRAVE_MAX_SMALL_PARTICLES);
            this.smallParticleCount -= particlesUsed;
            this.smallParticles = [];

            // Ability was used
            this.isUsingAbility = false;
            return true;
        }

        /**
         * Called when ability arrow drag starts
         */
        startAbilityDrag(): void {
            this.isUsingAbility = true;
        }

        /**
         * Called when ability arrow drag ends
         */
        endAbilityDrag(): void {
            this.isUsingAbility = false;
        }

        /**
         * Get all projectiles for rendering
         */
        getProjectiles(): GraveProjectile[] {
            return this.projectiles;
        }

        /**
         * Get all small particles for rendering
         */
        getSmallParticles(): GraveSmallParticle[] {
            return this.smallParticles;
        }

        /**
         * Get current small particle count
         */
        getSmallParticleCount(): number {
            return this.smallParticleCount;
        }
    }

    return { Grave, GraveProjectile, GraveSmallParticle };
};
