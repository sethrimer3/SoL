import type { AbilityBullet, Unit, Vector2D, Player, CombatTarget } from '../game-core';

type PreistHeroDeps = {
    Unit: typeof Unit;
    Vector2D: typeof Vector2D;
    Constants: typeof import('../constants');
    AbilityBullet: typeof AbilityBullet;
};

export const createPreistHero = (deps: PreistHeroDeps) => {
    const { Unit, Vector2D, Constants, AbilityBullet } = deps;

    /**
     * Healing bomb particle - wild particles that heal units they hit
     */
    class HealingBombParticle {
        lifetime: number = 0;
        maxLifetime: number = Constants.PREIST_HEALING_BOMB_PARTICLE_LIFETIME;
        hasHealed: Set<Unit> = new Set(); // Track which units this particle has healed

        constructor(
            public position: Vector2D,
            public velocity: Vector2D,
            public owner: Player
        ) {}

        update(deltaTime: number): boolean {
            this.lifetime += deltaTime;
            this.position.x += this.velocity.x * deltaTime;
            this.position.y += this.velocity.y * deltaTime;
            return this.lifetime >= this.maxLifetime;
        }
    }

    /**
     * Healing beam target info
     */
    interface HealingBeamTarget {
        target: CombatTarget | null;
        lockTimer: number;
    }

    /**
     * Preist hero unit - support hero that heals allies with dual beams and healing bomb ability
     * Prioritizes hero units over starlings, and most damaged units over less damaged ones
     * Each beam stays locked on a target for at least 0.5 seconds
     */
    class Preist extends Unit {
        private beamTargets: HealingBeamTarget[] = [];
        private healingBombParticles: HealingBombParticle[] = [];

        constructor(position: Vector2D, owner: Player) {
            super(
                position,
                owner,
                Constants.PREIST_MAX_HEALTH,
                Constants.PREIST_HEALING_RANGE, // Use healing range as "attack range"
                Constants.PREIST_ATTACK_DAMAGE,
                Constants.PREIST_ATTACK_SPEED,
                Constants.PREIST_ABILITY_COOLDOWN
            );
            this.isHero = true;

            // Initialize beam targets
            for (let i = 0; i < Constants.PREIST_NUM_BEAMS; i++) {
                this.beamTargets.push({ target: null, lockTimer: 0 });
            }
        }

        /**
         * Override update to handle healing beam targeting
         */
        update(
            deltaTime: number,
            enemies: CombatTarget[],
            allUnits: Unit[],
            asteroids: any[] = []
        ): void {
            // Call parent update but skip default attacking behavior
            // Update cooldowns
            if (this.attackCooldown > 0) {
                this.attackCooldown -= deltaTime;
            }
            if (this.abilityCooldown > 0) {
                this.abilityCooldown -= deltaTime;
            }

            this.moveTowardRallyPoint(deltaTime, Constants.UNIT_MOVE_SPEED, allUnits, asteroids);

            // Handle healing beam targeting and healing
            const friendlyUnits = this.getFriendlyUnits(allUnits);
            this.updateHealingBeams(deltaTime, friendlyUnits);

            // Update healing bomb particles
            this.updateHealingBombParticles(deltaTime, allUnits);

            // Rotate to face the primary healing target
            if (this.beamTargets[0].target && !this.isTargetDead(this.beamTargets[0].target)) {
                const target = this.beamTargets[0].target;
                const dx = target.position.x - this.position.x;
                const dy = target.position.y - this.position.y;
                const targetRotation = Math.atan2(dy, dx) + Math.PI / 2;
                const rotationDelta = this.getShortestAngleDelta(this.rotation, targetRotation);
                const maxRotationStep = Constants.UNIT_TURN_SPEED_RAD_PER_SEC * deltaTime;
                
                if (Math.abs(rotationDelta) <= maxRotationStep) {
                    this.rotation = targetRotation;
                } else {
                    this.rotation += Math.sign(rotationDelta) * maxRotationStep;
                }
                
                // Normalize rotation to [0, 2π)
                this.rotation = ((this.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            }
        }

        /**
         * Get friendly units that can be healed
         */
        private getFriendlyUnits(allUnits: Unit[]): Unit[] {
            return allUnits.filter(unit => 
                unit.owner === this.owner && 
                unit !== (this as any) && 
                !unit.isDead()
            );
        }

        /**
         * Update healing beams - find targets and apply healing
         */
        private updateHealingBeams(deltaTime: number, friendlyUnits: Unit[]): void {
            // Update lock timers and clear targets if timer expired or target dead/out of range
            for (const beamTarget of this.beamTargets) {
                if (beamTarget.lockTimer > 0) {
                    beamTarget.lockTimer -= deltaTime;
                }

                // Clear target if dead, out of range, or fully healed
                if (beamTarget.target) {
                    const targetDead = this.isTargetDead(beamTarget.target);
                    const targetOutOfRange = this.position.distanceTo(beamTarget.target.position) > this.attackRange;
                    const targetFullHealth = 'health' in beamTarget.target && 
                                             'maxHealth' in beamTarget.target &&
                                             beamTarget.target.health >= beamTarget.target.maxHealth;

                    if (targetDead || targetOutOfRange || targetFullHealth || beamTarget.lockTimer <= 0) {
                        beamTarget.target = null;
                        beamTarget.lockTimer = 0;
                    }
                }
            }

            // Find new targets for beams that don't have one
            for (const beamTarget of this.beamTargets) {
                if (!beamTarget.target) {
                    const newTarget = this.findBestHealingTarget(friendlyUnits);
                    if (newTarget) {
                        beamTarget.target = newTarget;
                        beamTarget.lockTimer = Constants.PREIST_TARGET_LOCK_DURATION;
                    }
                }
            }

            // Apply healing to targets
            for (const beamTarget of this.beamTargets) {
                if (beamTarget.target && 'health' in beamTarget.target && 'maxHealth' in beamTarget.target) {
                    const target = beamTarget.target as Unit;
                    const healAmount = target.maxHealth * Constants.PREIST_HEALING_PER_SECOND * deltaTime;
                    target.health = Math.min(target.maxHealth, target.health + healAmount);
                }
            }
        }

        /**
         * Find the best target for healing based on priority rules:
         * 1. Heroes over starlings
         * 2. Most damaged over less damaged
         * 3. Don't target units that are already being healed by another beam
         */
        private findBestHealingTarget(friendlyUnits: Unit[]): Unit | null {
            // Get units that are already targeted by other beams
            const currentlyTargeted = new Set(
                this.beamTargets
                    .filter(bt => bt.target)
                    .map(bt => bt.target)
            );

            // Filter to units that need healing, are in range, and not already targeted
            const damagedUnitsInRange = friendlyUnits.filter(unit => {
                if (currentlyTargeted.has(unit)) return false;
                if (unit.health >= unit.maxHealth) return false;
                const distance = this.position.distanceTo(unit.position);
                return distance <= this.attackRange;
            });

            if (damagedUnitsInRange.length === 0) return null;

            // Sort by priority: heroes first, then by most damaged (lowest health percentage)
            damagedUnitsInRange.sort((a, b) => {
                // Prioritize heroes over non-heroes
                if (a.isHero !== b.isHero) {
                    return a.isHero ? -1 : 1;
                }

                // Within same hero status, prioritize most damaged (lowest health percentage)
                const aHealthPercent = a.health / a.maxHealth;
                const bHealthPercent = b.health / b.maxHealth;
                return aHealthPercent - bHealthPercent;
            });

            return damagedUnitsInRange[0];
        }

        /**
         * Get current healing beam targets (for rendering)
         */
        getHealingBeamTargets(): (CombatTarget | null)[] {
            return this.beamTargets.map(bt => bt.target);
        }

        /**
         * Use Preist's healing bomb ability
         */
        useAbility(direction: Vector2D): boolean {
            if (!super.useAbility(direction)) {
                return false;
            }

            // Create a healing bomb projectile that travels in the given direction
            const bombDir = direction.normalize();
            const velocity = new Vector2D(
                bombDir.x * Constants.PREIST_HEALING_BOMB_SPEED,
                bombDir.y * Constants.PREIST_HEALING_BOMB_SPEED
            );

            const bomb = new AbilityBullet(
                new Vector2D(this.position.x, this.position.y),
                velocity,
                this.owner,
                0 // No damage, this is a healing bomb
            );

            bomb.maxRange = Constants.PREIST_HEALING_BOMB_MAX_RANGE;
            bomb.isHealingBomb = true;
            bomb.healingBombOwner = this;

            this.lastAbilityEffects.push(bomb);

            return true;
        }

        /**
         * Explode healing bomb at position, creating wild particles
         */
        explodeHealingBomb(position: Vector2D): void {
            // Create 50 wild particles in random directions within a constrained circular area
            for (let i = 0; i < Constants.PREIST_HEALING_BOMB_PARTICLE_COUNT; i++) {
                // Random angle
                const angle = Math.random() * Math.PI * 2;
                
                // Random speed (with some variation for visual effect)
                const speedVariation = 0.5 + Math.random() * 0.5; // 0.5x to 1.0x speed
                const speed = Constants.PREIST_HEALING_BOMB_PARTICLE_SPEED * speedVariation;
                
                const velocity = new Vector2D(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );

                const particle = new HealingBombParticle(
                    new Vector2D(position.x, position.y),
                    velocity,
                    this.owner
                );

                this.healingBombParticles.push(particle);
            }
        }

        /**
         * Update healing bomb particles and apply healing
         */
        private updateHealingBombParticles(deltaTime: number, allUnits: Unit[]): void {
            // Update particles and check for collisions with units
            this.healingBombParticles = this.healingBombParticles.filter(particle => {
                const expired = particle.update(deltaTime);

                if (!expired) {
                    // Check for collisions with units (both friendly and enemy)
                    for (const unit of allUnits) {
                        if (!unit.isDead() && !particle.hasHealed.has(unit)) {
                            const distance = particle.position.distanceTo(unit.position);
                            const hitRadius = unit.collisionRadiusPx || Constants.UNIT_RADIUS_PX;
                            
                            if (distance <= hitRadius) {
                                // Heal the unit
                                const healAmount = unit.maxHealth * Constants.PREIST_HEALING_BOMB_PARTICLE_HEALING;
                                unit.health = Math.min(unit.maxHealth, unit.health + healAmount);
                                
                                // Mark this unit as healed by this particle
                                particle.hasHealed.add(unit);
                            }
                        }
                    }
                }

                return !expired;
            });
        }

        /**
         * Get healing bomb particles (for rendering)
         */
        getHealingBombParticles(): HealingBombParticle[] {
            return this.healingBombParticles;
        }

        /**
         * Override attack to do nothing (Preist doesn't attack)
         */
        attack(target: CombatTarget): void {
            // Preist doesn't attack, only heals
        }
    }

    return { Preist, HealingBombParticle };
};
