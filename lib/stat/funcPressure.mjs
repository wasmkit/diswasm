import binaryen from "binaryen";

/*
    The following tool estimates a given function's compression "pressure" rating

    Possible ouputs: {t: number, d?: Expression}
      For any given `t`
        - -1 (Imported) [ no data ]
            Imported function
        - 0 (Decompressed) [ no data ]
            Means it is completely decompressed, and has all code preserved
        - 1 (Minor compression) [data = stack_ptr setter ]
            Means it was slightly compressed, showing no register-level locals
            but heavy use of stack and slight inlining
        - 2 (Maximum compression) [ no data ]
            Means the function was completely compressed, using with heavy inlining
            and little to no use of stack
*/
export const get = (moduleObject, getStat, func) => {
    if (!func) {
        throw new Error("invalid function");
    } else if (func.imported) return {t:-1};
    const __stack_pointer = moduleObject.globals.find(g => g.mutable && (g.type === binaryen.i32 || g.type === binaryen.i64)
        && g.init && g.init.id === 'const');
    const stack_ptr_name = __stack_pointer.name;

    /* -O0
    (local.set 0
        (global.get $g0))
    (local.set 1
        (i32.const n))
    (local.set 2
        (i32.add
            (local.get 0)
            (local.get 1)))
    (global.set $g0
        (local.get 2))
    */
        // console.log(3, func.func.body)
    if (!func.body.children) {
        return {t: 2};
    }
    const body = func.body.children;
    O0: if (body.length >= 4) {


        let instr = body[0]

        if (instr.id !== 'local.set' || instr.value.id !== 'global.get' || instr.value.name !== stack_ptr_name) break O0;
        instr = body[1]
        
        if (instr.id !== 'local.set' || instr.value.id !== 'const') break O0;
        instr = body[2]

        if (instr.id !== 'local.set' || instr.value.id !== 'binary'
            || instr.value.left.id !== 'local.get' || (instr.value.left.index !== func.params.length && instr.value.left.index !== func.params.length + 1)
            || instr.value.right.id !== 'local.get' || (instr.value.right.index !== func.params.length && instr.value.right.index !== func.params.length + 1)) break O0;

        // instr = body[3]
        // if (instr.id !== 'global.set' || instr.name !== stack_ptr_name || instr.value.id !== 'local.get' || instr.value.index !== func.params.length + 2) break O0;

        return {t: 0, d: {stackFrameSize: body[1].value.value}};
    }

    O1: if (body.length > 1) {
        for (const instr of body) {
            if (instr.id === 'global.set' && instr.name === stack_ptr_name
                && instr.value.id === 'local.set' && instr.value.value.id === 'binary') {
                    let l = instr.value.value.left;
                    let r = instr.value.value.right;
                    if (l.id === 'global.get' && l.name === stack_ptr_name 
                        && r.id === 'const') return {t: 1, d: instr};
                    r = instr.value.value.left;
                    l = instr.value.value.right;
                    if (l.id === 'global.get' && l.name === stack_ptr_name 
                        && r.id === 'const') return {t: 1, d: instr};
                }
        }
    }

    return {t: 2};
}