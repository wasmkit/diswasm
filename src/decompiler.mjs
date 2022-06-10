import { getStat } from "../lib/stat/index.mjs";
import { iDis } from "./disassembly/disassembleI.mjs";
import { O0Dis } from "./disassembly/disassembleO0.mjs";
import { O1Dis } from "./disassembly/disassembleO1.mjs";
import { O2Dis } from "./disassembly/disassembleO2.mjs";

const ODisassemblers = {
    [-1]: iDis,
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
        for (const func of this.wmod.functions) {
            const pressure = await getStat(this.wmod, "funcPressure", func);
            
            funcBodies.push(new ODisassemblers[pressure.t](this, func, pressure.d).disassemble());
        }

        for (const body of funcBodies) {
            this.outputText += '\n' + body;
        }

        let i = 0;
        for (let seg of this.wmod.elementSegments) {
            this.outputText += "\n"
            if (i++ > 0) this.outputText += "// "
            let offset = 0;
            if (seg.offset.id === 'const') offset = seg.offset.value
            else {
                console.log('help', seg);
                process.exit(-1)
            }
            this.outputText += `// Function table\n(*__function_table[${seg.data.length + offset}])() = {\n  ${Array(offset).fill("NULL,").concat(Array.from(seg.data).map(e => e.name + ", // $func" + e.index + " " + this.wmod.functions[e.index].result + " (" + this.wmod.functions[e.index].params.join(', ') + ")")).join('\n  ')}\n};`
        }

        if (this.wmod.dataSegments.length) {
            const min = this.wmod.dataSegments.reduce((a,b) => a < b.offset ? a : b.offset, Infinity)
            const max = this.wmod.dataSegments.reduce((a,b) => a > b.offset+b.data.length ? a : b.offset + b.data.length, 0)
            const mem = new Uint8Array(max - min)
            for (const dataSeg of this.wmod.dataSegments) {
                mem.set(dataSeg.data, dataSeg.offset - min);
            }

            this.outputText += "\n/****INITIALIZED MEMORY DUMP****/\n"
            for (let i = 0; i < mem.length; i += 16) {
                this.outputText += "// " + (i + min).toString(16).padStart(8, "0") + ": " + Array.from(mem.slice(i, i + 16)).map(e => e.toString(16).padStart(2, "0")).join(' ') + " : " + JSON.stringify(new TextDecoder().decode(mem.slice(i, i + 16))).replace(/\\u00[a-f0-9][a-f0-9]/gi, (c) => "\\x" + c.slice(4)) + "\n"
            }
        }

        return this.outputText;
    }
}