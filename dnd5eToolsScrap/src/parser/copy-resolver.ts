/**
 * Resolves 5e.tools `_copy` inheritance and `_mod` modifications.
 */
export function resolveCopy<T extends { name: string; source: string; _copy?: any; [key: string]: any }>(
  entry: T,
  allEntries: T[],
  depth = 0
): T {
  if (!entry._copy || depth > 10) return entry;

  const copyRef = entry._copy;
  const parent = allEntries.find(
    (e) => e.name === copyRef.name && e.source === copyRef.source
  );

  if (!parent) {
    // Parent not in current list, return entry as is (remove _copy reference)
    const clone = { ...entry };
    delete clone._copy;
    return clone;
  }

  // Resolve parent first if parent also inherits
  const resolvedParent = parent._copy
    ? resolveCopy(JSON.parse(JSON.stringify(parent)), allEntries, depth + 1)
    : JSON.parse(JSON.stringify(parent));

  // Merge parent with child
  const result = { ...resolvedParent, ...entry };
  delete result._copy;

  // Apply _mod transformations if defined
  const mod = copyRef._mod;
  if (mod && typeof mod === "object") {
    // Mod can modify entries, traits, or arbitrary array properties
    for (const [propKey, modVal] of Object.entries(mod)) {
      if (propKey === "_") continue;
      const modItems = Array.isArray(modVal) ? modVal : [modVal];

      for (const m of modItems) {
        if (!m || typeof m !== "object") continue;

        // Modifying an array property (like entries, trait, action, etc.)
        const targetArr = Array.isArray(result[propKey])
          ? [...result[propKey]]
          : result[propKey]
          ? [result[propKey]]
          : [];

        switch (m.mode) {
          case "replaceArr": {
            if (m.replace != null && m.items != null) {
              const itemsToInsert = Array.isArray(m.items) ? m.items : [m.items];
              const idx = targetArr.findIndex((it: any) => {
                if (typeof it === "string") return it === m.replace;
                if (typeof it === "object" && it?.name) return it.name === m.replace;
                return false;
              });
              if (idx !== -1) {
                targetArr.splice(idx, 1, ...itemsToInsert);
              } else {
                targetArr.push(...itemsToInsert);
              }
            }
            result[propKey] = targetArr;
            break;
          }

          case "appendArr": {
            if (m.items != null) {
              const toAppend = Array.isArray(m.items) ? m.items : [m.items];
              targetArr.push(...toAppend);
            }
            result[propKey] = targetArr;
            break;
          }

          case "prependArr": {
            if (m.items != null) {
              const toPrepend = Array.isArray(m.items) ? m.items : [m.items];
              targetArr.unshift(...toPrepend);
            }
            result[propKey] = targetArr;
            break;
          }

          case "removeArr": {
            if (m.names != null) {
              const names = Array.isArray(m.names) ? m.names : [m.names];
              result[propKey] = targetArr.filter((it: any) => {
                const n = typeof it === "string" ? it : it?.name;
                return !names.includes(n);
              });
            }
            break;
          }

          case "replaceTxt": {
            if (m.replace && m.with != null) {
              const re = new RegExp(m.replace, m.flags || "g");
              result[propKey] = walkAndReplaceText(targetArr, re, m.with);
            }
            break;
          }
        }
      }
    }
  }

  return result;
}

function walkAndReplaceText(val: any, regex: RegExp, replacement: string): any {
  if (typeof val === "string") {
    return val.replace(regex, replacement);
  }
  if (Array.isArray(val)) {
    return val.map((v) => walkAndReplaceText(v, regex, replacement));
  }
  if (val && typeof val === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = walkAndReplaceText(v, regex, replacement);
    }
    return out;
  }
  return val;
}

/**
 * Resolves all copies across an entire list of entries.
 */
export function resolveAllCopies<T extends { name: string; source: string; _copy?: any; [key: string]: any }>(
  entries: T[]
): T[] {
  return entries.map((entry) => (entry._copy ? resolveCopy(entry, entries) : entry));
}
