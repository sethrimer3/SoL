/**
 * Starling Merge Gate - temporary gate that converts starlings into a solar mirror.
 */
import { Vector2D } from '../math';
import * as Constants from '../../constants';
export class StarlingMergeGate {
    constructor(position, owner, assignedStarlings) {
        this.absorbedCount = 0;
        this.assignedStarlings = [];
        this.position = new Vector2D(position.x, position.y);
        this.owner = owner;
        this.remainingSec = Constants.STARLING_MERGE_DURATION_SEC;
        this.assignedStarlings = assignedStarlings;
        this.maxHealth = Constants.STARLING_MERGE_GATE_MAX_HEALTH;
        this.health = this.maxHealth;
        this.radius = Constants.STARLING_MERGE_GATE_RADIUS_PX;
    }
}
