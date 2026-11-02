const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

/** Choose an empty square directly, so a nearly full board never retries forever. */
export function placeFood(size, snake, random = Math.random) {
  const occupied = new Set(snake.map(({ x, y }) => y * size + x));
  const empty = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!occupied.has(y * size + x)) empty.push({ x, y });
    }
  }
  return empty.length ? empty[Math.min(empty.length - 1, Math.max(0, Math.floor(random() * empty.length)))] : null;
}

export function createSnake({ size = 20, random = Math.random } = {}) {
  const middle = Math.floor(size / 2);
  const snake = [{ x: middle, y: middle }, { x: middle - 1, y: middle }, { x: middle - 2, y: middle }];
  return { size, snake, direction: 'right', turns: [], food: placeFood(size, snake, random), score: 0, status: 'playing' };
}

/** At most two future turns, each checked against the last accepted heading. */
export function queueDirection(state, direction) {
  if (state.status !== 'playing' || !vectors[direction] || state.turns.length >= 2) return state;
  const previous = state.turns.at(-1) ?? state.direction;
  if (direction === previous || direction === opposite[previous]) return state;
  return { ...state, turns: [...state.turns, direction] };
}

export function stepSnake(state, random = Math.random) {
  if (state.status !== 'playing') return state;
  const direction = state.turns[0] ?? state.direction;
  const turns = state.turns.slice(1);
  const [dx, dy] = vectors[direction];
  const head = { x: state.snake[0].x + dx, y: state.snake[0].y + dy };
  const eating = state.food !== null && sameCell(head, state.food);
  // On ordinary movement the old tail leaves in this same step.
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= state.size || head.y >= state.size || body.some(cell => sameCell(cell, head))) {
    return { ...state, direction, turns: [], status: 'lost' };
  }
  const snake = [head, ...state.snake];
  if (!eating) snake.pop();
  const food = eating ? placeFood(state.size, snake, random) : state.food;
  return { ...state, snake, direction, turns, food, score: state.score + (eating ? 10 : 0), status: food === null ? 'won' : 'playing' };
}
