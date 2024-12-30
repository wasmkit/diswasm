const TAB = '  '
class Disassembler {
    indentate(str) {
        return str.trim().split('\n').map(e => (TAB.repeat(this.indent) + e).trimEnd()).join('\n');
    }
    static genParamName(index) {
        return "param" + index
    }
    static genLocalName(index) {
        return "local" + index
    }
    static numToString(num, type) {
        if (typeof num === 'bigint') return (num >= 0n ? "0x" : "-0x") + ((num >= 0n ? 1n : -1n) * num).toString(16);
        return type.startsWith('f') ? num.toString().includes('.') ? num.toString() : num.toString() + ".0" : ((num >= 0 ? "0x" : "-0x") + Math.abs(num).toString(16));
    }
    static typeToText(type,size=null) {
        if ((type === "i32" || type === "i64") && size !== null) {
            switch (size) {
                case 1: return "char";
                case 2: return "short";
                case 4: return "int";
                case 8: return "long";
            }
        }
        switch (type) {
            case "i32": return "int";
            case "i64": return "long";
            case "f32": return "float";
            case "f64": return "double";
            case "void": return "void";
        }

        throw new Error('Unknown')
    }

    static O_LEVEL = "invalid";

    constructor(wdis, wfunc) {
        this.indent = 0;
        this.wdis = wdis;
        this.wmod = wdis.wmod;
        this.wfunc = wfunc;
        this.params = wfunc.params.map((t,i) => ({
            type: Disassembler.typeToText(t),
            name: Disassembler.genParamName(i)
        }));
        this.locals = wfunc.imported ? [] : wfunc.locals.map((t, index) => ({
            type: Disassembler.typeToText(t),
            offset: index + wfunc.params.length,
            size: -1
        }));
        this.returnType = this.wfunc.result;
    }

    disassemble() {
        let out = this.generateHeaderText() + "{\n";
        this.indent += 1
        let s = out.length;
        out += this.indentate(this.generateLocalDeclaration());
        this.indent -= 1;
        if (s === out.length) out = out.slice(0, s - 1) + "}\n"
        else out += "\n}\n"

        return out;
    }

    generateLocalDeclaration() {
        let out = '';
        for (let l of this.locals) {
            const onStack = l.size !== -1;
            l.onStack = onStack;
            l.name = onStack ? `local_${l.offset.toString(16)}` : `local${l.offset}`
            out += onStack ? `// offset=0x${l.offset.toString(16)}` : `// local index=${l.offset}`
            out += "\n" + l.type + " " + l.name + ";\n"
        }
        return out
    }
        
    // Returns the function header text
    generateHeaderText() {
        let out = `// O[${this.constructor.O_LEVEL}] ${this.constructor.O_LEVEL === 2 ? "Disassembly" : "Decompilation"} of $func${this.wfunc.name.index}, known as ${this.wfunc.name.name}\n`
        const result = Disassembler.typeToText(this.returnType);
        if (typeof this.wfunc.exportKey === "string") out += "export " + JSON.stringify(this.wfunc.exportKey) + `; // $func${this.wfunc.name.index} is exported to ${JSON.stringify(this.wfunc.exportKey)}\n`
        out += result + " " + this.wfunc.name.name + "(" + this.params.map((t,i) => t.type + " " + t.name).join(', ') + ") "

        return out;
    }
}

export { Disassembler };
