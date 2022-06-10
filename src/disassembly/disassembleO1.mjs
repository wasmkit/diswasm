import { Disassembler } from "../disassembler.mjs";
import { O2Dis } from "./disassembleO2.mjs";

// export class O1Dis extends Disassembler {
//     static O_LEVEL = 1;

//     disassemble() {
//         return this.generateHeaderText() + "{ /* UNSUPPORTED AS OF NOW */ }\n"
//     }
// }

export class O1Dis extends O2Dis {
    static O_LEVEL = 1;
}