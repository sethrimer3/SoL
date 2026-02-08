import type { Asteroid, CombatTarget, Player, Unit, Vector2D } from '../game-core';
import { getGameRNG } from '../seeded-random';

type GraveHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
};

export const createGraveHero = (deps: GraveHeroDeps) => {
    const { Unit, Vector2D, Constants } = deps;

    /**
     * Small particle that follows a target (Grave or BlackHole) by gravity
     */
    class GraveSmallParticle {
        velocity: Vector2D;
        hasExploded: boolean = false;

        constructor(
            public position: Vector2D,
            public owner: Player
        ) {
            // Random initial velocity for natural spawning
            const rng = getGameRNG();
            const angle = rng.nextAngle();
            const speed = rng.nextFloat(20, 50);
            this.velocity = new Vector2D(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            );
        }

        /**
         * Update small particle movement - attracted to target by gravity
         */
        update(deltaTime: number, attractorPosition: Vector2D): void {
            // Calculate direction to attractor
            const dx = attractorPosition.x - this.position.x;
            const dy = attractorPosition.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0.1) {
                // Apply gravity-like attraction force
                const force = Constants.GRAVE_SMALL_PARTICLE_ATTRACTION_FORCE / Math.max(distance, 10);
                this.velocity.x += (dx / distance) * force * deltaTime;
                this.velocity.y += (dy / distance) * force * deltaTime;
            }

            // Apply drag to prevent infinite acceleration
            this.velocity.x *= Constants.GRAVE_SMALL_PARTICLE_DRAG;
            this.velocity.y *= Constants.GRAVE_SMALL_PARTICLE_DRAG;

            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
        }

        /**
         * Check if particle collides with a target
         */
        checkCollision(target: CombatTarget): boolean {
            const distance = this.position.distanceTo(target.position);
            const hitRadius = 10; // Collision detection radius
            return distance < hitRadius;
        }

        /**
         * Apply splash damage to all targets within splash radius
         * Returns array of targets that took damage
         */
        applySplashDamage(targets: CombatTarget[]): CombatTarget[] {
            const damagedTargets: CombatTarget[] = [];
            
            for (const target of targets) {
                const distance = this.position.distanceTo(target.position);
                
                if (distance <= Constants.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS) {
                    // Calculate damage falloff based on distance
                    const damageMultiplier = 1.0 - (distance / Constants.GRAVE_SMALL_PARTICLE_SPLASH_RADIUS) * (1.0 - Constants.GRAVE_SMALL_PARTICLE_SPLASH_FALLOFF);
                    const finalDamage = Constants.GRAVE_SMALL_PARTICLE_DAMAGE * damageMultiplier;
                    
                    // Apply damage
                    if ('health' in target) {
                        target.health -= finalDamage;
                        damagedTargets.push(target);
                    }
                }
            }
            
            return damagedTargets;
        }
    }

    /**
     * Black Hole vortex particle - attracts all small particles
     */
    class GraveBlackHole {
        lifetime: number = 0;
        velocity: Vector2D;

        constructor(
            public position: Vector2D,
            direction: Vector2D,
            public owner: Player
        ) {
            // Launch in the ability direction
            this.velocity = new Vector2D(
                direction.x * Constants.GRAVE_BLACK_HOLE_SPEED,
                direction.y * Constants.GRAVE_BLACK_HOLE_SPEED
            );
        }

        /**
         * Update black hole position
         */
        update(deltaTime: number): void {
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            this.lifetime += deltaTime;
        }

        /**
         * Check if black hole should despawn
         */
        shouldDespawn(): boolean {
            return this.lifetime >= Constants.GRAVE_BLACK_HOLE_DURATION;
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
     * Grave unit - has orbiting projectiles and small particles (Velaris faction hero)
     */
    class Grave extends Unit {
        projectiles: GraveProjectile[] = [];
        smallParticles: GraveSmallParticle[] = [];
        smallParticleCount: number = 0; // Start with no particles
        projectileLaunchCooldown: number = 0;
        smallParticleRegenTimer: number = 0;
        isUsingAbility: boolean = false; // True while ability arrow is being dragged
        blackHole: GraveBlackHole | null = null; // Active black hole
        explosionPositions: Vector2D[] = []; // Track explosions for rendering/screen shake

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
        }

        /**
         * Spawn a new small particle
         */
        spawnSmallParticle(): void {
            // Spawn near the Grave unit
            const rng = getGameRNG();
            const angle = rng.nextAngle();
            const distance = rng.nextFloat(20, 50);
            const position = new Vector2D(
                this.position.x + Math.cos(angle) * distance,
                this.position.y + Math.sin(angle) * distance
            );
            
            this.smallParticles.push(new GraveSmallParticle(position, this.owner));
            this.smallParticleCount++;
        }

        /**
         * Update grave and its projectiles
         */
        update(deltaTime: number, enemies: CombatTarget[], allUnits: Unit[], asteroids: Asteroid[] = []): void {
            // Update base unit logic
            super.update(deltaTime, enemies, allUnits, asteroids);

            // Clear explosion positions from previous frame
            this.explosionPositions = [];

            // Regenerate small particles over time (1 per second)
            if (this.smallParticleCount < Constants.GRAVE_MAX_SMALL_PARTICLES) {
                this.smallParticleRegenTimer += deltaTime;
                const regenInterval = 1.0 / Constants.GRAVE_SMALL_PARTICLE_REGEN_RATE;
                
                while (this.smallParticleRegenTimer >= regenInterval && this.smallParticleCount < Constants.GRAVE_MAX_SMALL_PARTICLES) {
                    this.spawnSmallParticle();
                    this.smallParticleRegenTimer -= regenInterval;
                }
            }

            // Update projectile launch cooldown
            if (this.projectileLaunchCooldown > 0) {
                this.projectileLaunchCooldown -= deltaTime;
            }

            // Update black hole if active
            if (this.blackHole) {
                this.blackHole.update(deltaTime);
                
                // Check if black hole should despawn
                if (this.blackHole.shouldDespawn()) {
                    this.blackHole = null;
                }
            }

            // Determine attractor position (black hole or Grave)
            const attractorPosition = this.blackHole ? this.blackHole.position : this.position;

            // Update all large projectiles
            for (const projectile of this.projectiles) {
                projectile.update(deltaTime, this.position);
            }

            // Update all small particles
            for (const smallParticle of this.smallParticles) {
                smallParticle.update(deltaTime, attractorPosition);
            }

            // Check for small particle collisions with enemies
            const particlesToRemove: number[] = [];
            for (let i = 0; i < this.smallParticles.length; i++) {
                const particle = this.smallParticles[i];
                
                // Check collision with each enemy
                for (const enemy of enemies) {
                    if ('health' in enemy && enemy.health > 0) {
                        if (particle.checkCollision(enemy)) {
                            // Apply splash damage
                            particle.applySplashDamage(enemies);
                            
                            // Mark particle for removal
                            particlesToRemove.push(i);
                            
                            // Record explosion position for screen shake
                            this.explosionPositions.push(new Vector2D(particle.position.x, particle.position.y));
                            
                            break; // Particle exploded, stop checking
                        }
                    }
                }
            }

            // Remove exploded particles (reverse order to maintain indices)
            for (let i = particlesToRemove.length - 1; i >= 0; i--) {
                const index = particlesToRemove[i];
                this.smallParticles.splice(index, 1);
                this.smallParticleCount--;
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
                && this.projectileLaunchCooldown <= 0;
        }

        /**
         * Grave doesn't use the base attack (projectiles do the damage)
         */
        attack(target: CombatTarget): void {
            // Projectiles handle the actual attacking
        }

        /**
         * Use special ability - launch black hole vortex
         */
        useAbility(direction: Vector2D): boolean {
            // Check if ability is ready
            if (!super.useAbility(direction)) {
                return false;
            }

            // Create black hole
            this.blackHole = new GraveBlackHole(
                new Vector2D(this.position.x, this.position.y),
                direction,
                this.owner
            );

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

        /**
         * Get active black hole
         */
        getBlackHole(): GraveBlackHole | null {
            return this.blackHole;
        }

        /**
         * Get explosion positions for this frame (for screen shake)
         */
        getExplosionPositions(): Vector2D[] {
            return this.explosionPositions;
        }
    }

    return { Grave, GraveProjectile, GraveSmallParticle, GraveBlackHole };
};
