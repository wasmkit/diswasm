import binaryen from "binaryen";
import { Disassembler } from "../disassembler.mjs";
import OPERATION_MAP from "../operations.mjs";

export class O0Dis extends Disassembler {
    static O_LEVEL = 0;

    constructor(wdis, wfunc, d) {
        super(wdis, wfunc);

        this.registers = this.wfunc.locals.map(type => ({
            type,
            valueExpr: null
        }));
        this.locals = [];
        this.temps = [];
        this.IR = [];
        this.controlFlow = new Map();
        this.stackframeSize = d.stackFrameSize;
    }

    processInstruction(instr) {
        if (!instr) return null
        switch(instr.id) {
            case 'local.set': { // register
                // it'll never set to a non param
                const register = this.registers[instr.index - this.params.length]
                register.valueExpr = this.processInstruction(instr.value);
                return null;
            }
            case 'local.get': { // register
                if (instr.index < this.params.length) return {
                    id: "param.get",
                    index: instr.index,
                    type: instr.type
                }

                const register = this.registers[instr.index - this.params.length]
                if (!register) {
                    console.log(register, instr)
                    process.exit()
                }
                return register.valueExpr;
            }
            case 'global.get': {
                if (instr.name === 'global$0') return null;
                return {
                    id: 'global.get',
                    type: 'void',
                    name: instr.name.startsWith("global$") ? "global" + instr.name.slice("global$".length) : instr.name,
                };
            }
            case 'global.set': {
                if (instr.name === 'global$0') return null;
                return {
                    id: 'global.set',
                    type: 'void',
                    name: instr.name.startsWith("global$") ? "global" + instr.name.slice("global$".length) : instr.name,
                    value: this.processInstruction(instr.value)
                }
            }
            case 'call': {
                return {
                    id: 'call',
                    type: instr.type,
                    target: instr.target,
                    operands: instr.operands.map(e => this.processInstruction(e))
                }
            }
            case 'call_indirect': {
                return {
                    id: 'call_indirect',
                    type: instr.type,
                    target: this.processInstruction(instr.target),
                    operands: instr.operands.map(e => this.processInstruction(e))
                }
            }
            case 'call_indirect': {
                return {
                    id: 'call_indirect',
                    type: instr.type,
                    target: this.processInstruction(instr.target),
                    operands: instr.operands.map(e => this.processInstruction(e))
                }
            }
            case 'const': {
                return {
                    id: "const",
                    type: instr.type,
                    value: instr.value
                }
            }
            case 'binary': {
                let k=  {
                    id: "binary",
                    type: instr.type,
                    op: instr.op,
                    left: this.processInstruction(instr.left) || { id: "global.get", name: "__stack_pointer" },
                    right: this.processInstruction(instr.right) || { id: "global.get", name: "__stack_pointer" },
                }
                if ((k.left.id === "const" || k.right.id === "const") && (k.left.name === "__stack_pointer" || k.right.name === "__stack_pointer")) {
                    return { id: "global.get", name: "__stack_base"}
                }
                return k;
            }
            case 'unary': {
                return {
                    id: "unary",
                    type: instr.type,
                    op: instr.op,
                    value: this.processInstruction(instr.value)
                }
            }
            case 'return': {
                return {
                    id: 'return',
                    type: instr.type,
                    value: this.processInstruction(instr.value)
                }
            }
            case 'nop': {
                return {
                    id: 'nop',
                    type: instr.type
                }
            }
            case 'unreachable': {
                return {
                    id: 'unreachable',
                    type: instr.type
                }
            }
            case "load": {
                const ptr = this.processInstruction(instr.ptr)
                c: if (ptr.id === "global.get" && ptr.name === "__stack_base") {
                    const offset = instr.offset;
                    const local = this.locals.find(l => l.size !== -1 && offset >= l.offset && offset < l.offset + l.size)
                    if (!local) break c;
                    const diff = offset - local.offset
                    return {
                        id: 'local.get',
                        type: instr.type,
                        local: local,
                        diff: diff
                    }
                }
                c: if (ptr.id === 'binary') { 
                    if ((ptr.left.id !== "global.get" || ptr.left.name !== "__stack_base") && (ptr.right.id !== "global.get" || ptr.right.name !== "__stack_base")) break c;
                    if (ptr.left.id !== "const" && ptr.right.id !== "const") break c;
                    let c = ptr.left.id === "const" ? ptr.left.value : ptr.right.value;
                    const offset = (instr.offset + c);
                    const local = this.locals.find(l => l.size !== -1 && offset >= l.offset && offset < l.offset + l.size)     
                    if (!local) break c;
                    const diff = offset - local.offset
                    return {
                        id: 'local.get',
                        type: instr.type,
                        local: local,
                        diff: diff
                    }
                }
                return {
                    id: "load",
                    type: instr.type,
                    isAtomic: instr.isAtomic,
                    isSigned: instr.isSigned,
                    offset: instr.offset,
                    bytes: instr.bytes,
                    align: instr.align,
                    ptr: ptr
                }
            }
            case "store": {
                const ptr = this.processInstruction(instr.ptr);
                const value = this.processInstruction(instr.value)
                c: if (ptr.id === "global.get" && ptr.name === "__stack_base") {
                    const offset = instr.offset;
                    const local = this.locals.find(l => l.size !== -1 && offset >= l.offset && offset < l.offset + l.size)
                    if (!local) {
                        this.locals.push({
                            size: instr.bytes,
                            type: Disassembler.typeToText(instr.value.type),
                            offset
                        })
                        return {
                            id: 'local.set',
                            type: instr.type,
                            local: this.locals[this.locals.length - 1],
                            value
                        }
                    } else {
                        const diff = offset - local.offset
                        return {
                            id: 'local.set',
                            type: instr.type,
                            local: local,
                            value,
                            diff
                        }
                    }
                }
                c: if (ptr.id === 'binary') { 
                    if ((ptr.left.id !== "global.get" || ptr.left.name !== "__stack_base") && (ptr.right.id !== "global.get" || ptr.right.name !== "__stack_base")) break c;
                    if (ptr.left.id !== "const" && ptr.right.id !== "const") break c;
                    let c = ptr.left.id === "const" ? ptr.left.value : ptr.right.value;
                    const offset = (instr.offset + c);
                    const local = this.locals.find(l => l.size !== -1 && offset >= l.offset && offset < l.offset + l.size)

                    if (!local) {
                        this.locals.push({
                            size: instr.bytes,
                            type: Disassembler.typeToText(instr.value.type),
                            offset
                        })
                        return {
                            id: 'local.set',
                            type: instr.type,
                            local: this.locals[this.locals.length - 1],
                            value
                        }
                    } else {
                        const diff = offset - local.offset
                        return {
                            id: 'local.set',
                            type: instr.type,
                            local: local,
                            value,
                            diff
                        }
                    }
                }
                return {
                    id: "store",
                    type: instr.type,
                    isAtomic: instr.isAtomic,
                    offset: instr.offset,
                    bytes: instr.bytes,
                    align: instr.align,
                    ptr: ptr,
                    value
                }
            }
            case 'memory.size': {
                return {
                    id: 'memory.size',
                    type: instr.type
                }
            }
            case 'memory.grow': {
                return {
                    id: 'memory.size',
                    type: instr.type,
                    delta: this.processInstruction(instr.delta)
                }
            }
            case 'drop': {
                return {
                    id: 'drop',
                    type: instr.type,
                    value: this.processInstruction(instr.value)
                }
            }
            case "block": {
                return {
                    id: "block",
                    type: instr.type,
                    name: instr.name,
                    children: instr.children.map(e => this.processInstruction(e))
                }
            }
            case "if": {
                return {
                    id: "if",
                    type: instr.type,
                    condition: this.processInstruction(instr.condition),
                    ifTrue: this.processInstruction(instr.ifTrue),
                    ifFalse: this.processInstruction(instr.ifFalse),
                }
            }
            case "loop": {
                return {
                    id: 'loop',
                    type: instr.type,
                    body: this.processInstruction(instr.body)
                }
            }
            case "br": {
                return {
                    id: 'br',
                    type: instr.type,
                    name: instr.name,
                    condition: this.processInstruction(instr.condition),
                    value: this.processInstruction(instr.value)
                }
            }
            case "switch": {
                return {
                    id: 'switch',
                    type: instr.type,
                    names: instr.names,
                    defaultName: instr.defaultName,
                    condition: this.processInstruction(instr.condition),
                    value: this.processInstruction(instr.value)
                }
            }
            default:
                console.log("Invalid id " + instr.id)
                process.exit(-1);
        }
    }
    process() {
        const body = this.wfunc.body.children;
        for (const instr of body) {
            const inst = this.processInstruction(instr);
            if (inst) this.IR.push(inst);
        }
    }

    disassembleInstruction(instr, isLoop=false) {
        if (!instr) return null
        switch(instr.id) {
            case 'global.get': {
                if (instr.name === '__stack_base') {
                    let l = this.locals.find(e => e.size >= 0 && e.offset === 0);;
                    if (l) return '&' + l.name
                }
                return instr.name;
            }
            case 'local.set': {
                // set by generateLocalDecleration
                if (instr.diff) return `*(&${instr.local.name} + ${instr.diff}) = ` + this.disassembleInstruction(instr.value);
                return instr.local.name + " = " + this.disassembleInstruction(instr.value);
            }
            case 'local.get': {
                // set by generateLocalDecleration
                if (instr.diff) return `*(&${instr.local.name} + ${instr.diff})`
                return instr.local.name
            }
            case 'param.get': {
                // set by generateLocalDecleratio
                return this.params[instr.index].name
            }
            case 'global.set': {
                return instr.name + " = " + this.disassembleInstruction(instr.value);
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
                        if (str.length >= 2 && str.every(e => (e >= 0x20 && e < 0x7f) || e === 0x0a || e === 0x09 || e === 0x0d)) {
                            addition = " /* " + JSON.stringify(String.fromCharCode(...str)) + " */ ";
                        }
                    }
                }
                return Disassembler.numToString(instr.value, instr.type) + addition
            }
            case "select": {
                return `${this.disassembleInstruction(instr.condition)} ? ${this.disassembleInstruction(instr.ifTrue)} : ${this.disassembleInstruction(instr.ifFalse)}`
            }
            case 'binary': {
                k: if (instr.op === binaryen.AddInt32 || instr.op === binaryen.AddInt64) {
                    if (instr.left.id === 'const' || instr.right.id === 'const') {
                        if ((instr.left.id === 'global.get' && instr.left.name === "__stack_base") || (instr.right.id === 'global.get' && instr.right.name === "__stack_base")) {
                            let offset = (instr.left.id === 'const' ? instr.left.value : instr.right.value);

                            const local = this.locals.find(l => l.size !== -1 && offset >= l.offset && offset < l.offset + l.size);
                            if (!local) break k;
                            const diff = offset - local.offset
                            if (diff !== 0) {
                                return "&" + local.name + "[" + diff + "]"
                            }
                            return "&" + local.name;
                        }
                    }
                }
                let left = this.disassembleInstruction(instr.left) || "__stack_pointer";
                let right = this.disassembleInstruction(instr.right) || "__stack_pointer";
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
                let ptr = typeof instr.ptr === "string" ? instr.ptr : this.disassembleInstruction(instr.ptr);
                let offset = Disassembler.numToString(instr.offset, "i");
                let load = (ptr === "0x0" ? offset : (offset === "0x0" ? ptr : (ptr + " + " + offset)))
                return "*((" + (instr.isSigned ? "" : "unsigned ") + Disassembler.typeToText(instr.type) + " *) " + load + ")";
            }
            case "store": {
                let ptr = typeof instr.ptr === "string" ? instr.ptr : this.disassembleInstruction(instr.ptr);
                let offset = Disassembler.numToString(instr.offset, "i");
                let load = (ptr === "0x0" ? offset : (offset === "0x0" ? ptr : (ptr + " + " + offset)))
                return "*((" + (instr.isSigned ? "" : "unsigned ") + Disassembler.typeToText(instr.value.type) + " *) " + load + ") = " + this.disassembleInstruction(instr.value);
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
            default:
                console.log("Invalid id " + instr.id)
                process.exit(-1);
        }
    }

    disassemble() {
        this.process()
        let out = "{\n";
        this.indent += 1
        let s = out.length;
        out += this.indentate(this.generateLocalDeclaration()) + "\n";
        out += "\n"
        for (const i of this.IR) {
            if (i.id === 'global.set' && i.name === "__stack_pointer") continue;
            const instr = this.disassembleInstruction(i);
            if (!instr) continue;
            out +=  this.indentate(instr) + ";" + "\n"
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