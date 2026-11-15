import assert from 'node:assert/strict';
import {unlockedPieces,puzzleCompletedIds} from '../lib/familyPuzzle.js';
const flow=Array.from({length:4},(_,i)=>({id:`m${i}`}));
const withPolls=[{id:'poll',isCoordination:true},...flow];
assert.equal(unlockedPieces(withPolls,['poll'],8).size,0);
assert.equal(unlockedPieces(withPolls,['m0','m1'],8).size,4);
assert.equal(unlockedPieces(withPolls,['m0','m0'],8).size,2);
assert.equal(unlockedPieces(withPolls,flow.map(m=>m.id),8).size,8);
assert.deepEqual([...unlockedPieces([{id:'m',puzzlePiece:3},{id:'n'}],['m'],8)],[3]);
assert.equal(unlockedPieces([],[],8).size,0);
console.log('Puzzle reveal: union of completed missions, no duplicate rewards or poll pieces, full finale');

assert.equal(unlockedPieces(flow,puzzleCompletedIds(flow,[{progressVersion:2,journeyEnded:true,completedMissionIds:['m0'],skippedMissionIds:['m1','m2','m3']}]),8).size,8);
assert.deepEqual(puzzleCompletedIds(flow,[{completedMissionIds:['m0']},{completedMissionIds:['m1']}]),['m0','m1']);
