import { Disassembler } from "../disassembler.mjs";

// imported funcs
export class iDis extends Disassembler {
    static O_LEVEL = -1;
    
    IR = [];

    disassemble() {
        let out = `// [${this.constructor.O_LEVEL}] Imported function $func${this.wfunc.name.index}, known as ${this.wfunc.name.name}\n`
        const result = Disassembler.typeToText(this.returnType);
        out += "import " + result + " " + this.wfunc.name.name + "(" + this.wfunc.params.map(Disassembler.typeToText).join(', ') + ") from /* module */ " + JSON.stringify(this.wfunc.module) + " /* export */ " + JSON.stringify(this.wfunc.base) + ";"

        return out;
    }
}