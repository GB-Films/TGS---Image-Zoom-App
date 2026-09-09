const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Summed-area table of non-opaque pixels; constant-time containment checks.
export function opaqueIntegral(data, width, height) {
  const table = new Uint32Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += data[(y * width + x) * 4 + 3] === 255 ? 0 : 1;
      table[(y + 1) * (width + 1) + x + 1] = table[y * (width + 1) + x + 1] + row;
    }
  }
  return { table, width, height };
}

export function opaqueRectangle(integral, left, top, right, bottom) {
  const { table, width, height } = integral;
  left = Math.floor(left); top = Math.floor(top);
  right = Math.ceil(right); bottom = Math.ceil(bottom);
  if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top) return false;
  const stride = width + 1;
  return table[bottom * stride + right] - table[top * stride + right]
    - table[bottom * stride + left] + table[top * stride + left] === 0;
}

// Fit the whole 16:9 image in the fully opaque interior, not in the mask's
// bounding box. Two extra pixels keep text clear of antialiasing and feather.
export function fitImageInsideMask(integral) {
  const { width, height } = integral;
  const find = (size) => {
    const h = Math.ceil(size * height / width);
    let best = null;
    let distance = Infinity;
    for (let y = 2; y + h + 2 <= height; y += 2) {
      for (let x = 2; x + size + 2 <= width; x += 2) {
        if (!opaqueRectangle(integral, x - 2, y - 2, x + size + 2, y + h + 2)) continue;
        const d = Math.hypot((x + size / 2) / width - 0.5, (y + h / 2) / height - 0.5);
        if (d < distance) { distance = d; best = { x, y, size, h }; }
      }
    }
    return best;
  };
  let low = 2, high = width - 4, best = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const result = find(middle);
    if (result) { best = result; low = middle + 1; } else high = middle - 1;
  }
  if (!best) throw new Error("La máscara no tiene espacio opaco suficiente para la imagen completa.");
  const imageScale = best.size / width;
  return {
    imageScale,
    imageX: ((best.x + best.size / 2) / width - 0.5) * 100,
    imageY: ((best.y + best.h / 2) / height - 0.5) * 100,
  };
}

export const buildClosedPath = (points, smoothing, size = 1000) => {
  if (points.length < 3) return "";
  const scaled = points.map((point) => ({ x: point.x * size, y: point.y * size }));

  if (smoothing <= 0.01) {
    return `${scaled.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    ).join(" ")} Z`;
  }

  const commands = [`M ${scaled[0].x.toFixed(2)} ${scaled[0].y.toFixed(2)}`];
  for (let index = 0; index < scaled.length; index += 1) {
    const previous = scaled[(index - 1 + scaled.length) % scaled.length];
    const current = scaled[index];
    const next = scaled[(index + 1) % scaled.length];
    const afterNext = scaled[(index + 2) % scaled.length];
    const strength = smoothing / 6;
    const controlOne = {
      x: current.x + (next.x - previous.x) * strength,
      y: current.y + (next.y - previous.y) * strength,
    };
    const controlTwo = {
      x: next.x - (afterNext.x - current.x) * strength,
      y: next.y - (afterNext.y - current.y) * strength,
    };

    commands.push(
      `C ${controlOne.x.toFixed(2)} ${controlOne.y.toFixed(2)} ` +
        `${controlTwo.x.toFixed(2)} ${controlTwo.y.toFixed(2)} ` +
        `${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }
  return `${commands.join(" ")} Z`;
};

export const blurMaskAlpha = (
  pixels,
  width,
  height,
  radius,
) => {
  if (radius < 1) return;
  const source = new Uint8ClampedArray(width * height);
  const temporary = new Uint8ClampedArray(width * height);
  for (let index = 0; index < source.length; index += 1) {
    source[index] = pixels.data[index * 4 + 3];
  }

  const horizontalPass = (input, output) => {
    const diameter = radius * 2 + 1;
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        sum += input[row + clamp(offset, 0, width - 1)];
      }
      for (let x = 0; x < width; x += 1) {
        output[row + x] = Math.round(sum / diameter);
        sum -= input[row + clamp(x - radius, 0, width - 1)];
        sum += input[row + clamp(x + radius + 1, 0, width - 1)];
      }
    }
  };

  const verticalPass = (input, output) => {
    const diameter = radius * 2 + 1;
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        sum += input[clamp(offset, 0, height - 1) * width + x];
      }
      for (let y = 0; y < height; y += 1) {
        output[y * width + x] = Math.round(sum / diameter);
        sum -= input[clamp(y - radius, 0, height - 1) * width + x];
        sum += input[clamp(y + radius + 1, 0, height - 1) * width + x];
      }
    }
  };

  for (let pass = 0; pass < 3; pass += 1) {
    horizontalPass(source, temporary);
    verticalPass(temporary, source);
  }
  for (let index = 0; index < source.length; index += 1) {
    pixels.data[index * 4] = 255;
    pixels.data[index * 4 + 1] = 255;
    pixels.data[index * 4 + 2] = 255;
    pixels.data[index * 4 + 3] = source[index];
  }
};
