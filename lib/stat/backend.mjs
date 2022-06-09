import binaryen from "binaryen";

/*
    The following tool estimates the compiler toolchain / backend used for compilation

    Possible ouputs:
        - "llvm32"
            Means it was compiled with a compiler that uses LLVM to target a 32 bit wasm
        - "llvm64"
            Means it was compiled with a compiler that uses LLVM to target a 64 bit wasm
        - "unknown"
            Means the wasm file likely doesn't use a backend, and was either handwritten or
            uses a compilation process that doesn't use LLVM
*/
export const get = (moduleObject, getStat) => {
    const __stack_pointer = moduleObject.globals.find(g => g.mutable && (g.type === binaryen.i32 || g.type === binaryen.i64)
        && g.init && g.init.id === 'const');

    if (!__stack_pointer) return "unknown"

    if (__stack_pointer.type === binaryen.i32) return "llvm32";
    else if (__stack_pointer.type === binaryen.i64) return "llvm64";

    throw new Error("unexpected exception - lost type"); 
}