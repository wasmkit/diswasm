import { Disassembler } from "../disassembler.mjs";

export class O1Dis extends Disassembler {
    static O_LEVEL = 1;
    // disas
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