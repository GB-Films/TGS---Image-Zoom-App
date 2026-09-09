/** @typedef {{portalX:number,portalY:number,portalScale:number,imageX:number,imageY:number,imageScale:number,matte:string,smoothing:number,feather:number,points:{x:number,y:number}[]}} MaskSettings */

/** Validate untrusted saved data and copy only renderable fields. @returns {MaskSettings[]} */
export function validateMasks(value) {
  if (!Array.isArray(value) || value.length !== 7) throw new Error("Se necesitan las siete máscaras.");
  const limits = { portalX:[1,99], portalY:[1,99], portalScale:[2,35], imageX:[-50,50],
    imageY:[-50,50], imageScale:[0.05,2], smoothing:[0,1], feather:[0,80] };
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Máscara inválida.");
    const result = {};
    for (const [field,[min,max]] of Object.entries(limits)) {
      if (typeof item[field] !== "number" || !Number.isFinite(item[field]) || item[field] < min || item[field] > max) {
        throw new Error(`Valor inválido: ${field}.`);
      }
      result[field] = item[field];
    }
    const matte = item.matte ?? "#ffffff";
    if (typeof matte !== "string" || !/^#[a-f0-9]{6}$/i.test(matte)) throw new Error("Color de reborde inválido.");
    if (!Array.isArray(item.points) || item.points.length < 3 || item.points.length > 64) throw new Error("Usá entre 3 y 64 puntos por máscara.");
    const points = item.points.map(p => {
      if (!p || typeof p.x !== "number" || typeof p.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) throw new Error("Punto fuera de la máscara.");
      return {x:p.x, y:p.y};
    });
    return /** @type {MaskSettings} */ ({...result, matte, points});
  });
}

/** @returns {{version:number, updatedAt:string|null, transitions:MaskSettings[]}} */
export function validateSnapshot(value) {
  if (!value || !Number.isSafeInteger(value.version) || value.version < 0 ||
    !(value.updatedAt === null || typeof value.updatedAt === "string")) throw new Error("Versión de máscaras inválida.");
  return {version:value.version, updatedAt:value.updatedAt, transitions:validateMasks(value.transitions)};
}
