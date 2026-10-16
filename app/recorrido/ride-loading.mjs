export function rideTextureWindow(index, count) {
  return [index, index + 1, index - 1].filter(value => value >= 0 && value < count);
}
