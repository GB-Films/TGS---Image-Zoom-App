export const stopPosition = (index, count) => .015 + index * .935 / Math.max(1, count - 1);
export const stopSide = index => index % 2 === 0 ? 1 : -1;
