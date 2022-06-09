import binaryen from "binaryen";
import { Disassembler } from "../disassembler.mjs";
import OPERATION_MAP from "../operations.mjs";

export class O2Dis extends Disassembler {
    static O_LEVEL = 2;

    constructor(wdis, wfunc, d) {
        super(wdis, wfunc);

        this.controlFlow = new Map();
    }

    disassembleInstruction(instr, isLoop=false) {
        if (!instr) return null
        switch(instr.id) {
            case 'global.get': {
                return instr.name.startsWith("global$") ? "global" + instr.name.slice("global$".length) : instr.name;
            }
            case 'local.set': {
                return (instr.index >= this.params.length ? this.locals[instr.index - this.params.length].name : this.params[instr.index].name) + " = " + this.disassembleInstruction(instr.value);
            }
            case 'local.get': {
                return (instr.index >= this.params.length ? this.locals[instr.index - this.params.length].name : this.params[instr.index].name)
            }
            case 'global.set': {
                return (instr.name.startsWith("global$") ? "global" + instr.name.slice("global$".length) : instr.name) + " = " + this.disassembleInstruction(instr.value);
            }
            case 'call': {
                return instr.target.name + "(" + instr.operands.map(e => this.disassembleInstruction(e)).join(', ') + ")";
            }
            case 'call_indirect': {
                return "__function_table[" + this.disassembleInstruction(instr.target.name) + "](" + instr.operands.map(e => this.disassembleInstruction(e)).join(', ') + ")"
            }
            case 'const': {
                return instr.type.startsWith('f') ? instr.value.toString().includes('.') ? instr.value.toString() : instr.value.toString() + ".0" : ((instr.value >= 0 ? "0x" : "-0x") + Math.abs(instr.value).toString(16));
            }
            case 'binary': {
                const left = this.disassembleInstruction(instr.left);
                const right = this.disassembleInstruction(instr.right);
                return OPERATION_MAP["binary" + instr.op].replace(/\$|\#/g, c => c === "$" ? left : right)
            }
            case 'unary': {
                return OPERATION_MAP["unary" + instr.op].replace(/\$/g, this.disassembleInstruction(instr.value))
            }
            case 'return': {
                return "return" + (instr.value ? " " + this.disassembleInstruction(instr.value) : "")
            }
            case 'nop': {
                return ""
            }
            case 'unreachable': {
                return "abort(\"unreachable\")"
            }
            case "load": {
                let ptr = this.disassembleInstruction(instr.ptr);
                return "*((" + (instr.isSigned ? "" : "unsigned ") + Disassembler.typeToText(instr.type) + " *) " + ptr + " + " + instr.offset + ")";
            }
            case "store": {
                let ptr = this.disassembleInstruction(instr.ptr);
                return "*((" + (instr.isSigned ? "" : "unsigned ") + Disassembler.typeToText(instr.type) + " *) " + ptr + " + " + instr.offset + ") = " + this.disassembleInstruction(instr.value);
            }
            case 'memory.size': {
                return "__get_memory_size()"
            }
            case 'drop': {
                return this.disassembleInstruction(instr.value);
            }
            case "block": {
                this.controlFlow.set(instr.name, isLoop);
                let out = instr.name + ": {"
                for (const i of instr.children) {
                    const instr = this.disassembleInstruction(i);
                    if (!instr) continue;
                    out += "\n" + this.indentate(instr) + ";"
                }
                if (isLoop) out += "\nbreak " + instr.name + ";"
                out += "\n}"
                return out;
            }
            case "if": {
                let out = "if (" + this.disassembleInstruction(instr.condition) + ") {\n" + this.indentate(this.disassembleInstruction(this.isTrue)) + ";\n}" 
                if (instr.isFalse) out += " else {\n" + this.indentate(this.disassembleInstruction(this.isFalse)) + ";\n}"

                return out;
            }
            case "loop": {
                return "while (1) " + this.indentate(this.disassembleInstruction(instr.body), true);
            }
            case "br": {
                const isLoop = this.controlFlow.get(instr.name);
                let val = instr.value ? "(" + this.disassembleInstruction(instr.value) + ")" : "";
                let iff = instr.condition ? "if (" + this.disassembleInstruction(instr.condition) + ") " : "";
                let n = isLoop ? "continue" : "break"
                return `${iff}${n}${val} ${instr.name}`;
            }
            case "switch": {
                let out = "switch (" + this.disassembleInstruction(instr.condition) + ") {\n"
                let val = instr.value ? "(" + this.disassembleInstruction(instr.value) + ")" : "";
                for (let i = 0; i < instr.names.length; ++i) {
                    out += this.indentate("case " + i + ": break" + val + " " + instr.names[i] + ";") + "\n"
                }
                if (instr.defaultName) out += this.indentate("default: break" + val + " " + instr.defaultName + ";") + "\n"
                out += "}"
                return out;
            }
            case "select": {
                return `${this.disassembleInstruction(instr.condition)} ? ${this.disassembleInstruction(instr.isTrue)} : ${this.disassembleInstruction(instr.isFalse)}`
            }
            default:
                console.log("Invalid id " + instr.id)
                process.exit(-1);
        }
    }

    disassemble() {
        let out = "{\n";
        this.indent += 1
        let s = out.length;
        out += this.indentate(this.generateLocalDeclaration()) + "\n";
        out += "\n"
        if (this.wfunc.body.id !== 'block') out += this.wfunc.body.type !== 'void' ? "return " + this.disassembleInstruction(this.wfunc.body) : this.disassembleInstruction(this.wfunc.body);
        else {
            for (const i of this.wfunc.body.children) {
                if (!i) continue;
                const instr = this.disassembleInstruction(i);
                if (!instr) continue;
                out += this.indentate(instr) + ";" + "\n"
            }
        }
        this.indent -= 1;
        if (s === out.length) out = out.slice(0, s - 1)
        out += "}\n"

        return this.generateHeaderText() + out;
    }
}
// import binaryen from "binaryen"
// import operations from "../operations.mjs"

// export const disassembleInstruction = (wmod, instr) => {
//     switch (instr.id) {
//         case binaryen.BinaryId:
//             return operations[instr.op].replace(/\$/, disassembleInstruction)
//         case binaryen.UnaryId:
//             // return operations[]
//     }
// }