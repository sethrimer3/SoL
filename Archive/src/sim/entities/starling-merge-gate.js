"use strict";
/**
 * Starling Merge Gate - temporary gate that converts starlings into a solar mirror.
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
exports.StarlingMergeGate = void 0;
const math_1 = require("../math");
const Constants = __importStar(require("../../constants"));
class StarlingMergeGate {
    constructor(position, owner, assignedStarlings) {
        this.absorbedCount = 0;
        this.assignedStarlings = [];
        this.position = new math_1.Vector2D(position.x, position.y);
        this.owner = owner;
        this.remainingSec = Constants.STARLING_MERGE_DURATION_SEC;
        this.assignedStarlings = assignedStarlings;
        this.maxHealth = Constants.STARLING_MERGE_GATE_MAX_HEALTH;
        this.health = this.maxHealth;
        this.radius = Constants.STARLING_MERGE_GATE_RADIUS_PX;
    }
}
exports.StarlingMergeGate = StarlingMergeGate;
