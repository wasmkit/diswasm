import binaryen from "binaryen";

export const core = binaryen;
// "Invalid Block If Loop Break Switch Call CallIndirect LocalGet LocalSet GlobalGet GlobalSet Load Store Const Unary Binary Select Drop Return MemorySize MemoryGrow Nop Unreachable AtomicCmpxchg AtomicRMW AtomicWait AtomicNotify AtomicFence SIMDExtract SIMDReplace SIMDShuffle SIMDTernary SIMDShift SIMDLoad SIMDLoadStoreLane MemoryInit DataDrop MemoryCopy MemoryFill RefNull RefIs RefFunc RefEq TableGet TableSet TableSize TableGrow Try Throw Rethrow TupleMake TupleExtract Pop I31New I31Get CallRef RefTest RefCast BrOn RttCanon RttSub StructNew StructGet StructSet ArrayNew ArrayInit ArrayGet ArraySet ArrayLen".split(" ")
export const expandType = (m) => {
    return (typeof m === "number" ? binaryen.expandType(m) : m).map(t => {
        if (t === binaryen.i32) return "i32";
        if (t === binaryen.none || t === 1) return "void";
        if (t === binaryen.f32) return "f32";
        if (t === binaryen.i64) return "i64";
        if (t === binaryen.f64) return "f64";
        console.log("unknown type " + t);
        process.exit(1);
    })
}

export const expandExpression = (exprRef) => {
    if (!exprRef) return null;
    let info;
    try {
        info = binaryen.getExpressionInfo(exprRef);
    } catch (e) {
        console.log(e);
        console.log(exprRef);
        process.exit(1);
    }
    switch (info.id) {
        case binaryen.LocalGetId:
            return {
                id: "local.get",
                type: expandType(info.type)[0] || "void",
                index: info.index
            }
        case binaryen.LocalSetId:
            return {
                id: "local.set",
                type: expandType(info.type)[0] || "void",
                index: info.index,
                value: expandExpression(info.value)
            }
        case binaryen.BlockId:
            return {
                id: "block",
                type: expandType(info.type)[0] || "void",
                name: info.name,
                children: info.children.map(expandExpression)
            }
        case binaryen.IfId:
            return {
                id: "if",
                type: expandType(info.type)[0] || "void",
                condition: expandExpression(info.condition),
                ifTrue: expandExpression(info.ifTrue),
                ifFalse: expandExpression(info.ifFalse),
            }
        case binaryen.LoopId:
            return {
                id: "loop",
                type: expandType(info.type)[0] || "void",
                body: expandExpression(info.body)
            }
        case binaryen.BreakId:
            return {
                id: "br",
                type: expandType(info.type)[0] || "void",
                name: info.name,
                condition: expandExpression(info.condition),
                value: expandExpression(info.value)
            }
        case binaryen.SwitchId:
            return {
                id: "switch",
                type: expandType(info.type)[0] || "void",
                names: info.names,
                defaultName: info.defaultName,
                condition: expandExpression(info.condition),
                value: expandExpression(info.value)
            }
        case binaryen.CallId:
            return {
                id: "call",
                type: expandType(info.type)[0] || "void",
                target: convertIdentifier(info.target),
                operands: info.operands.map(expandExpression)
            }
        case binaryen.CallIndirectId:
            return {
                id: "call_indirect",
                type: expandType(info.type)[0] || "void",
                target: expandExpression(info.target),
                operands: info.operands.map(expandExpression)
            }
        case binaryen.GlobalSetId:
            return {
                id: "global.set",
                type: expandType(info.type)[0] || "void",
                name: info.name,
                value: expandExpression(info.value)
            }
        case binaryen.GlobalGetId:
            return {
                id: "global.get",
                type: expandType(info.type)[0] || "void",
                name: info.name
            }
        case binaryen.LoadId:
            return {
                id: "load",
                type: expandType(info.type)[0] || "void",
                isAtomic: info.isAtomic,
                isSigned: info.isSigned,
                offset: info.offset,
                bytes: info.bytes,
                align: info.align,
                ptr: expandExpression(info.ptr)
            }
        case binaryen.StoreId:
            return {
                id: "store",
                type: expandType(info.type)[0] || "void",
                isAtomic: info.isAtomic,
                offset: info.offset,
                bytes: info.bytes,
                align: info.align,
                ptr: expandExpression(info.ptr),
                value: expandExpression(info.value)
            }
        case binaryen.ConstId:
            return {
                id: "const",
                type: expandType(info.type)[0] || "void",
                value: typeof info.value === "object" ? new BigInt64Array(new Uint32Array([info.value.low, info.value.high]).buffer)[0] : info.value
            }
        case binaryen.UnaryId:
            return {
                id: "unary",
                type: expandType(info.type)[0] || "void",
                op: info.op,
                value: expandExpression(info.value)
            }
        case binaryen.BinaryId:
            return {
                id: "binary",
                type: expandType(info.type)[0] || "void",
                op: info.op,
                left: expandExpression(info.left),
                right: expandExpression(info.right),
            }
        case binaryen.SelectId:
            return {
                id: "select",
                type: expandType(info.type)[0] || "void",
                condition: expandExpression(info.condition),
                ifTrue: expandExpression(info.ifTrue),
                ifFalse: expandExpression(info.ifFalse),
            }
        case binaryen.DropId:
            return {
                id: "drop",
                type: expandType(info.type)[0] || "void",
                value: expandExpression(info.value)
            }
        case binaryen.ReturnId:
            return {
                id: "return",
                type: expandType(info.type)[0] || "void",
                value: expandExpression(info.value)
            }
        case binaryen.NopId:
            return {
                id: "nop",
                type: expandType(info.type)[0] || "void"
            }
        case binaryen.UnreachableId:
            return {
                id: "unreachable",
                type: expandType(info.type)[0] || "void"
            }
        case binaryen.MemorySizeId:
            return {
                id: "memory.size",
                type: expandType(info.type)[0] || "void"
            }
        case binaryen.MemoryGrowId:
            return {
                id: "memory.grow",
                type: expandType(info.type)[0] || "void",
                delta: expandExpression(info.delta)
            }
        default:
            console.log("Invalid id " + info.id)
            process.exit(-1);
    }
}

const session = new Set()

class FuncIdentifier {
    constructor(name, index=-1) {
        this.name = translateFuncName(name);
        this.index = index;
        session.add(this);
    }
}
const translateFuncName = n => isNaN(n) ? n : ("$func"+ n)
export const convertIdentifier = v => new FuncIdentifier(v.replace(/\\([a-f0-9]{2})/g, (c, g) => String.fromCharCode(parseInt(g, 16))))

export const expandFunction = (ref) => {
    const funcInfo = binaryen.getFunctionInfo(ref);
    const func = {
        name: convertIdentifier(translateFuncName(funcInfo.name)),
        params: expandType(funcInfo.params),
        result: expandType(funcInfo.results)[0] || "void",
        imported: false
    }
    if (funcInfo.base) { // Imported
        func.imported = true;
        func.base = funcInfo.base;
        func.module = funcInfo.module;
    } else {
        func.locals = expandType(funcInfo.vars)
        func.body = expandExpression(funcInfo.body);
    }
    return func;
}

export const expandModule = (wmod) => {
    const moduleObject = {wmod}
    let importedCount = 0;
    moduleObject.functions = [];
    for (let len = wmod.getNumFunctions(), i = 0; i < len; ++i) {
        const funcInfo = expandFunction(wmod.getFunctionByIndex(i));
        funcInfo.name.index = i;
        if (funcInfo.imported) importedCount += 1
        moduleObject.functions[i] = funcInfo;
    }
    moduleObject.elementSegments = [];
    // TODO: Safe to assume only functions in LLVM, but unsafe for a utility package
    for (let len = wmod.getNumElementSegments(), i = 0; i < len; ++i) {
        const t = moduleObject.elementSegments[i] = binaryen.getElementSegmentInfo(wmod.getElementSegmentByIndex(i));
       t.data = t.data.map(e => convertIdentifier(e));
       t.offset = expandExpression(t.offset);
    }
    moduleObject.dataSegments = []
    for (let len = wmod.getNumMemorySegments(), i = 0; i < len; ++i) {
        const t = moduleObject.dataSegments[i] = wmod.getMemorySegmentInfoByIndex(i);
        t.data = new Uint8Array(t.data);
    }
    moduleObject.globals = []
    for (let len = wmod.getNumGlobals(), i = 0; i < len; ++i) {
        const t = moduleObject.globals[i] = binaryen.getGlobalInfo(wmod.getGlobalByIndex(i));
        t.init = expandExpression(t.init)
        binaryen.getGlobalInfo(wmod.getGlobalByIndex(0)).init
    }
    moduleObject.nameMap = moduleObject.functions.reduce((o, {name}, i) => (o[name.name] = i, o), {});
    for (const t of moduleObject.elementSegments) {
        t.data = t.data.map(e => (e.index = moduleObject.nameMap[e.name], e));
    }
    for (const id of session) {
        id.index = moduleObject.nameMap[translateFuncName(id.name)];
        if (id.index < importedCount && id.name.startsWith("fimport$") && moduleObject.functions[id.index].base.match(/^[a-z$_][a-z$_0-9]*$/gi)) {
            id.name = "fimport_" + moduleObject.functions[id.index].base
        }
        if (id.index === undefined) {
            console.log(id, moduleObject.nameMap);
            process.exit()
        }
    }
    moduleObject.nameMap = moduleObject.functions.reduce((o, {name}, i) => (o[name.name] = i, o), {});
    session.clear();

    return moduleObject;
}