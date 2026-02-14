"use strict";
/**
 * SoL (Speed of Light) - Core Game Module
 * A 2D real-time strategy game with light-based mechanics
 *
 * This module serves as the main entry point and maintains backward compatibility
 * by re-exporting all entities from the refactored sim module structure.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisintegrationParticle = exports.StickyLaser = exports.StickyBomb = exports.Sly = exports.NovaScatterBullet = exports.NovaBomb = exports.Nova = exports.CrescentWave = exports.Tank = exports.Spotlight = exports.HealingBombParticle = exports.Preist = exports.MortarProjectile = exports.Mortar = exports.Beam = exports.Dagger = exports.Driller = exports.DeployedTurret = exports.TurretDeployer = exports.InfluenceBallProjectile = exports.InfluenceZone = exports.InfluenceBall = exports.RayBeamSegment = exports.Ray = exports.GraveBlackHole = exports.GraveSmallParticle = exports.GraveProjectile = exports.Grave = exports.Marine = void 0;
// Re-export everything from sim module
__exportStar(require("./sim"), exports);
// Import constants and network for hero factories
const Constants = __importStar(require("./constants"));
// Import hero factory functions
const beam_1 = require("./heroes/beam");
const dagger_1 = require("./heroes/dagger");
const driller_1 = require("./heroes/driller");
const grave_1 = require("./heroes/grave");
const influence_ball_1 = require("./heroes/influence-ball");
const marine_1 = require("./heroes/marine");
const mortar_1 = require("./heroes/mortar");
const nova_1 = require("./heroes/nova");
const preist_1 = require("./heroes/preist");
const ray_1 = require("./heroes/ray");
const spotlight_1 = require("./heroes/spotlight");
const tank_1 = require("./heroes/tank");
const turret_deployer_1 = require("./heroes/turret-deployer");
const sly_1 = require("./heroes/sly");
// Import dependencies needed for hero factories
const unit_1 = require("./sim/entities/unit");
const math_1 = require("./sim/math");
const particles_1 = require("./sim/entities/particles");
// Instantiate hero classes using factories
const { Marine } = (0, marine_1.createMarineHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants,
    MuzzleFlash: particles_1.MuzzleFlash,
    BulletCasing: particles_1.BulletCasing,
    BouncingBullet: particles_1.BouncingBullet,
    AbilityBullet: particles_1.AbilityBullet
});
exports.Marine = Marine;
const { Grave, GraveProjectile, GraveSmallParticle, GraveBlackHole } = (0, grave_1.createGraveHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.Grave = Grave;
exports.GraveProjectile = GraveProjectile;
exports.GraveSmallParticle = GraveSmallParticle;
exports.GraveBlackHole = GraveBlackHole;
const { Ray, RayBeamSegment } = (0, ray_1.createRayHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.Ray = Ray;
exports.RayBeamSegment = RayBeamSegment;
const { InfluenceBall, InfluenceZone, InfluenceBallProjectile } = (0, influence_ball_1.createInfluenceBallHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.InfluenceBall = InfluenceBall;
exports.InfluenceZone = InfluenceZone;
exports.InfluenceBallProjectile = InfluenceBallProjectile;
const { TurretDeployer, DeployedTurret } = (0, turret_deployer_1.createTurretDeployerHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.TurretDeployer = TurretDeployer;
exports.DeployedTurret = DeployedTurret;
const { Driller } = (0, driller_1.createDrillerHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.Driller = Driller;
const { Dagger } = (0, dagger_1.createDaggerHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants,
    AbilityBullet: particles_1.AbilityBullet
});
exports.Dagger = Dagger;
const { Beam } = (0, beam_1.createBeamHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants,
    AbilityBullet: particles_1.AbilityBullet
});
exports.Beam = Beam;
const { Mortar, MortarProjectile } = (0, mortar_1.createMortarHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.Mortar = Mortar;
exports.MortarProjectile = MortarProjectile;
const { Preist, HealingBombParticle } = (0, preist_1.createPreistHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants,
    AbilityBullet: particles_1.AbilityBullet
});
exports.Preist = Preist;
exports.HealingBombParticle = HealingBombParticle;
const { Spotlight } = (0, spotlight_1.createSpotlightHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants,
    AbilityBullet: particles_1.AbilityBullet
});
exports.Spotlight = Spotlight;
const { Tank, CrescentWave } = (0, tank_1.createTankHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.Tank = Tank;
exports.CrescentWave = CrescentWave;
const { Nova, NovaBomb, NovaScatterBullet } = (0, nova_1.createNovaHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants,
    AbilityBullet: particles_1.AbilityBullet
});
exports.Nova = Nova;
exports.NovaBomb = NovaBomb;
exports.NovaScatterBullet = NovaScatterBullet;
const { Sly, StickyBomb, StickyLaser, DisintegrationParticle } = (0, sly_1.createSlyHero)({
    Unit: unit_1.Unit,
    Vector2D: math_1.Vector2D,
    Constants
});
exports.Sly = Sly;
exports.StickyBomb = StickyBomb;
exports.StickyLaser = StickyLaser;
exports.DisintegrationParticle = DisintegrationParticle;
