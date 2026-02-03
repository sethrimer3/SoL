/**
 * Starling Merge Gate - temporary gate that converts starlings into a solar mirror.
 */

import { Vector2D } from '../math';
import * as Constants from '../../constants';
import type { Player } from './player';
import type { Starling } from './starling';

export class StarlingMergeGate {
    position: Vector2D;
    owner: Player;
    remainingSec: number;
    absorbedCount: number = 0;
    assignedStarlings: Starling[] = [];

    constructor(position: Vector2D, owner: Player, assignedStarlings: Starling[]) {
        this.position = new Vector2D(position.x, position.y);
        this.owner = owner;
        this.remainingSec = Constants.STARLING_MERGE_DURATION_SEC;
        this.assignedStarlings = assignedStarlings;
    }
}
