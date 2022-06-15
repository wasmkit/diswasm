#!/usr/bin/env node
import binaryen from "binaryen";
import { existsSync, fstat, readFileSync, writeFileSync } from "fs";
import { expandModule } from "./lib/binaryen/index.mjs"
import { Decompiler } from "./src/decompiler.mjs";


let inputFile = null;
let outputFile = null;
let gadgets = false;
for (let i = 2; i < process.argv.length; ++i) {
    if (process.argv.at(i) === "-o") {
        outputFile = process.argv.at(++i)
    } else if (process.argv.at(i) === "--gadgets") {
        gadgets = true;
    } else if (!inputFile) inputFile = process.argv.at(i)
    else {
        console.log("Only one input allowed");
        process.exit(1);
    }
}

if (inputFile === null) {
    console.log("Invalid input. args: <inputfile> [-o <outputfile>]");
    process.exit(1);
}

if (!existsSync(inputFile)) {
    console.log("Invalid file");
    process.exit(1);
}

const wmod = expandModule(binaryen.readBinary(readFileSync(inputFile)));

const diswasm = new Decompiler(wmod)

const output = await diswasm.decompile(gadgets);

if (outputFile) writeFileSync(outputFile, output);
else console.log(output)
