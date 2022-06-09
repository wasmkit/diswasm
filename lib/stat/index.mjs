export const getStat = async (moduleObject, statName, ...arg) => {
    if (!moduleObject.__statCache) moduleObject.__statCache = new Map()
    else if (moduleObject.__statCache.has(statName)) return moduleObject.__statCache.get(statName);

    const {get} = await import ("./" + statName + ".mjs");

    const r = await get(moduleObject, getStat, ...arg);
    if (arg.length ===0) moduleObject.__statCache.set(statName, r);
    return r;
}
