const labels = {
  straight: "Прямо",
  left: "Налево",
  right: "Направо",
  "turn-back": "Разворот",
};

function turnKind([x1, y1], [x2, y2]) {
  const angle = Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2) * 180 / Math.PI;
  if (Math.abs(angle) < 35) return "straight";
  if (Math.abs(angle) >= 155) return "turn-back";
  return angle > 0 ? "right" : "left";
}

export function floorDirections({ points, building }) {
  const scale = building?.metersPerUnit;
  const moves = [];
  let kind = "straight";
  let distance = 0;
  let previous;
  function addMove() {
    moves.push({
      kind,
      label: labels[kind],
      meters: scale ? Math.max(1, Math.round(distance * scale)) : null,
    });
  }
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [lastX, lastY] = points[i - 1];
    const vector = [x - lastX, y - lastY];
    const length = Math.hypot(...vector);
    if (!length) continue;
    const turn = previous ? turnKind(previous, vector) : "straight";
    if (turn !== "straight") {
      addMove();
      kind = turn;
      distance = 0;
    }
    distance += length;
    previous = vector;
  }
  if (distance) addMove();
  return moves;
}
