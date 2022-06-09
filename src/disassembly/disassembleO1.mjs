import { Disassembler } from "../disassembler.mjs";

export class O1Dis extends Disassembler {
    static O_LEVEL = 1;

    disassemble() {
        return this.generateHeaderText() + "{ /* UNSUPPORTED AS OF NOW */ }\n"
    }
}