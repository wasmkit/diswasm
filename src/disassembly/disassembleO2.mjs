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
                return "__function_table[" + this.disassembleInstruction(instr.target) + "](" + instr.operands.map(e => this.disassembleInstruction(e)).join(', ') + ")"
            }
            case 'const': {
                let addition = "";
                if (!Number(instr.value).toString().includes('.')) {
                    let addr = Number(instr.value);
                    if (addr >= this.wdis.mem.min && addr < this.wdis.mem.max) {
                        addr -= this.wdis.mem.min
                        const str = this.wdis.mem.mem.slice(addr, this.wdis.mem.mem.indexOf(0, addr));
                        if (str.length >= 2 && str.every(e => e >= 0x20 && e < 0x7f)) {
                            addition = " /* " + JSON.stringify(String.fromCharCode(...str)) + " */ ";
                        }
                    }
                }
                return Disassembler.numToString(instr.value, instr.type) + addition;
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
                let offset = Disassembler.numToString(instr.offset, "i");
                let load = (ptr === "0x0" ? offset : (offset === "0x0" ? ptr : (ptr + " + " + offset)))
                return "*((" + (instr.isSigned ? "" : "unsigned ") + Disassembler.typeToText(instr.type, instr.bytes) + " *) " + load + ")";
            }
            case "store": {
                let ptr = this.disassembleInstruction(instr.ptr);
                let offset = Disassembler.numToString(instr.offset, "i");
                let load = (ptr === "0x0" ? offset : (offset === "0x0" ? ptr : (ptr + " + " + offset)))
                return "*((" + (instr.isSigned ? "" : "unsigned ") + Disassembler.typeToText(instr.value.type, instr.bytes) + " *) " + load + ") = " + this.disassembleInstruction(instr.value);
            }
            case 'memory.size': {
                return "__get_memory_size()"
            }
            case 'memory.grow': {
                return "__grow_memory_size(" + this.disassembleInstruction(instr.delta) + ")"
            }
            case 'drop': {
                return this.disassembleInstruction(instr.value);
            }
            case "block": {
                this.controlFlow.set(instr.name, isLoop);
                let out = (instr.name ? (instr.name + ": ") : "") + "{"
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
                let out = "if (" + this.disassembleInstruction(instr.condition) + ") {\n" + this.indentate(this.disassembleInstruction(instr.ifTrue)) + ";\n}" 
                if (instr.ifFalse) out += " else {\n" + this.indentate(this.disassembleInstruction(instr.ifFalse)) + ";\n}"

                return out;
            }
            case "loop": {
                return "while (1) " + this.disassembleInstruction(instr.body, true)
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
                return `${this.disassembleInstruction(instr.condition)} ? ${this.disassembleInstruction(instr.ifTrue)} : ${this.disassembleInstruction(instr.ifFalse)}`
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
        if (s === out.length - 1) out = out.slice(0, s - 1)
        out += "\n"
        if (this.wfunc.body.id !== 'block') out += this.indentate(this.wfunc.body.type !== 'void' ? "return " + this.disassembleInstruction(this.wfunc.body) : this.disassembleInstruction(this.wfunc.body)) + ";\n"
        else {
            let len = this.wfunc.body.children.length;
            let end = -1;
            if (this.wfunc.body.type !== 'void') for (let i = len; i > 0; --i) {
                if (this.wfunc.body.children[i - 1].type !== 'void'){
                    end = i;
                    break;
                }
            }
            let k = 0;
            for (const i of this.wfunc.body.children) {
                k++
                if (!i) continue;
                let instr = this.disassembleInstruction(i);
                if (!instr) continue;
                if (k === end && this.wfunc.body.type !== 'void') instr = 'return ' + instr;
                out += this.indentate(instr) + ";\n"
            }
        }
        this.indent -= 1;
        if (s >= out.length-2) out = out.slice(0, s - 1)
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