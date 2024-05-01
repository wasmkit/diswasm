# diswasm
Disassembler for wasm binaries. At the moment this is more of a proof of code, a more established codebase and library will be published later on after completion of this project.

> # NOTICE: This package will be migrated over to a new format very soon. Prepare yourself for the next level of wasm analysis.

The way this program works is it determines the minimization level (called `funcPressure` in the code) of every single function in the wasm file. The minimization level is a category of 4 types of functions:  
  1. `O(-1)` Imported functions
    - These functions have no content/bodies
  2. `O(0)` Unminified functions (pure)
    - These functions are a 1:1 replica of their source, including the stack frame.
  3. `O(1)` Slighty minified functions
    - These functions are slightly minified versions of the unminifed functions. They still preserve the stackframe,
    but local variables are now inlined into wasm locals instead of being placed in the memory.
  4. `O(2)` Fully minified functions
    - These functions have no stack frame, all calculation is done with the wasm stack and wasm locals

Then it disassembles the function according to its `funcPressure`. All categories have implemented decompilers except for O(1), and as of now, O(1) functions resort to O(2) disassembly.

## Installing

After downloading run `npm i -g diswasm`

## Usage

After installing, `diswasm <wasm file> [-o <output file>]`.
