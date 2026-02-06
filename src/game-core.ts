/**
 * SoL (Speed of Light) - Core Game Module
 * A 2D real-time strategy game with light-based mechanics
 * 
 * This module serves as the main entry point and maintains backward compatibility
 * by re-exporting all entities from the refactored sim module structure.
 */

// Re-export everything from sim module
export * from './sim';

// Import constants and network for hero factories
import * as Constants from './constants';

// Import hero factory functions
import { createBeamHero } from './heroes/beam';
import { createDaggerHero } from './heroes/dagger';
import { createDrillerHero } from './heroes/driller';
import { createGraveHero } from './heroes/grave';
import { createInfluenceBallHero } from './heroes/influence-ball';
import { createMarineHero } from './heroes/marine';
import { createMortarHero } from './heroes/mortar';
import { createNovaHero } from './heroes/nova';
import { createPreistHero } from './heroes/preist';
import { createRayHero } from './heroes/ray';
import { createSpotlightHero } from './heroes/spotlight';
import { createTankHero } from './heroes/tank';
import { createTurretDeployerHero } from './heroes/turret-deployer';
import { createSlyHero } from './heroes/sly';

// Import dependencies needed for hero factories
import { Unit } from './sim/entities/unit';
import { Vector2D } from './sim/math';
import { 
    MuzzleFlash, 
    BulletCasing, 
    BouncingBullet, 
    AbilityBullet 
} from './sim/entities/particles';

// Instantiate hero classes using factories
const { Marine } = createMarineHero({
    Unit,
    Vector2D,
    Constants,
    MuzzleFlash,
    BulletCasing,
    BouncingBullet,
    AbilityBullet
});

const { Grave, GraveProjectile, GraveSmallParticle } = createGraveHero({
    Unit,
    Vector2D,
    Constants
});

const { Ray, RayBeamSegment } = createRayHero({
    Unit,
    Vector2D,
    Constants
});

const { InfluenceBall, InfluenceZone, InfluenceBallProjectile } = createInfluenceBallHero({
    Unit,
    Vector2D,
    Constants
});

const { TurretDeployer, DeployedTurret } = createTurretDeployerHero({
    Unit,
    Vector2D,
    Constants
});

const { Driller } = createDrillerHero({
    Unit,
    Vector2D,
    Constants
});

const { Dagger } = createDaggerHero({
    Unit,
    Vector2D,
    Constants,
    AbilityBullet
});

const { Beam } = createBeamHero({
    Unit,
    Vector2D,
    Constants,
    AbilityBullet
});

const { Mortar, MortarProjectile } = createMortarHero({
    Unit,
    Vector2D,
    Constants
});

const { Preist, HealingBombParticle } = createPreistHero({
    Unit,
    Vector2D,
    Constants,
    AbilityBullet
});

const { Spotlight } = createSpotlightHero({
    Unit,
    Vector2D,
    Constants,
    AbilityBullet
});

const { Tank, CrescentWave } = createTankHero({
    Unit,
    Vector2D,
    Constants
});

const { Nova, NovaBomb, NovaScatterBullet } = createNovaHero({
    Unit,
    Vector2D,
    Constants,
    AbilityBullet
});

const { Sly, StickyBomb, StickyLaser, DisintegrationParticle } = createSlyHero({
    Unit,
    Vector2D,
    Constants
});

// Export hero classes and their related types
export {
    Marine,
    Grave,
    GraveProjectile,
    GraveSmallParticle,
    Ray,
    RayBeamSegment,
    InfluenceBall,
    InfluenceZone,
    InfluenceBallProjectile,
    TurretDeployer,
    DeployedTurret,
    Driller,
    Dagger,
    Beam,
    Mortar,
    MortarProjectile,
    Preist,
    HealingBombParticle,
    Spotlight,
    Tank,
    CrescentWave,
    Nova,
    NovaBomb,
    NovaScatterBullet,
    Sly,
    StickyBomb,
    StickyLaser,
    DisintegrationParticle
};
