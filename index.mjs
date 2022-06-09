import { getStat } from "./lib/stat/index.mjs";
import { O0Dis } from "./src/disassembly/disassembleO0.mjs";
import { O1Dis } from "./src/disassembly/disassembleO1.mjs";
import { O2Dis } from "./src/disassembly/disassembleO2.mjs";

const ODisassemblers = {
    [0]: O0Dis,
    [1]: O1Dis,
    [2]: O2Dis
};

export class Decompiler {
    constructor(wmod) {
        this.wmod = wmod;
        this.outputText = "";
    }

    async decompile() {
        const backend = await getStat(this.wmod, "backend");
        if (backend !== "llvm32" && backend !== "llvm64") throw new Error("Unsupported backend");
        const funcBodies = [];
        for (const func in this.wmod) {
            const pressure = await getStat(this.wmod, "funcPressure");


            funcBodies.push(new ODisassemblers[pressure.t](this, func, pressure.d).disassemble());
        }
    }
}