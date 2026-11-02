import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath, findPair, matchTiles, shuffleBoard, createLink, nextTileIndex } from '../src/lib/link-game.mjs';
const board = (rows) => ({ rows: rows.length, cols: rows[0].length, tiles: rows.flat(), score: 0, status: 'playing' });

test('straight, one turn and two turn connections return legal paths', () => {
  assert.deepEqual(findPath(board([[1, null, 1]]), 0, 2), [{r:0,c:0},{r:0,c:2}]);
  assert.ok(findPath(board([[1,null],[2,1]]),0,3));
  const path = findPath(board([[2,1,2],[null,null,null],[2,1,2]]),1,7);
  assert.ok(path);
  assert.ok(path.length <= 4);
});

test('outside border connects full edge tiles while enclosed routes remain blocked', () => {
  const path = findPath(board([[1,2,1],[2,2,2]]),0,2);
  assert.ok(path.some(p => p.r === -1));
  assert.equal(findPath(board([[2,2,2,2],[2,1,2,2],[2,2,1,2],[2,2,2,2]]),5,10), null);
});

test('mismatch and selecting the same tile never clear cells or change score', () => {
  const game = board([[1,2],[1,2]]);
  assert.equal(matchTiles(game,0,1),null);
  assert.equal(matchTiles(game,0,0),null);
  assert.deepEqual(game.tiles,[1,2,1,2]);
  assert.equal(game.score,0);
  assert.ok(matchTiles(game,0,2));
  assert.equal(game.score,100);
  assert.ok(matchTiles(game,1,3));
  assert.equal(game.status,'won');
});

test('shuffle preserves holes and unmatched multiset and guarantees a playable pair', () => {
  for (let seed = 0; seed < 40; seed++) {
    const game = board([[0,1,2,0],[1,null,null,2],[3,4,3,4]]);
    let x = seed + 1;
    shuffleBoard(game, () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; });
    assert.equal(game.tiles[5],null);
    assert.equal(game.tiles[6],null);
    assert.deepEqual(game.tiles.filter(x=>x!==null).sort(),[0,0,1,1,2,2,3,3,4,4]);
    assert.ok(findPair(game));
  }
});

test('generated rounds contain pairs and start with a playable move', () => {
  const game = createLink(6,6,() => 0.5);
  assert.equal(game.tiles.length,36);
  assert.ok(findPair(game));
  for (const value of new Set(game.tiles)) assert.equal(game.tiles.filter(x=>x===value).length%2,0);
});

test('an unchanged shuffle of a true deadlock repairs a pair without losing icons', () => {
  const game = board([[0,1,2,3],[4,5,6,7],[7,6,5,4],[3,2,1,0]]);
  assert.equal(findPair(game),null);
  assert.equal(shuffleBoard(game,()=>0.999),true);
  assert.ok(findPair(game));
  assert.deepEqual(game.tiles.toSorted(),[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7]);
});

test('keyboard arrows reach a sparse diagonal pair and wrap back to its other tile', () => {
  const game = board([[0,null,null,null,null,null],[null,0,null,null,null,null]]);
  assert.equal(nextTileIndex(game,0,'ArrowRight'),7);
  assert.equal(nextTileIndex(game,7,'ArrowRight'),0);
  assert.equal(nextTileIndex(game,7,'ArrowLeft'),0);
  assert.equal(nextTileIndex(game,0,'ArrowLeft'),7);
  assert.equal(nextTileIndex(game,0,'ArrowDown'),7);
});

test('right-arrow navigation visits every remaining tile across sparse rows', () => {
  const game = board([[1,null,2,null],[null,3,null,null],[4,null,null,5]]);
  const visited = [0];
  for (let i = 0; i < 5; i++) visited.push(nextTileIndex(game,visited.at(-1),'ArrowRight'));
  assert.deepEqual(visited,[0,2,5,8,11,0]);
  assert.equal(nextTileIndex(board([[null,null],[null,null]]),0,'ArrowRight'),-1);
});
