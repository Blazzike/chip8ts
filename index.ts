import type {Instruction} from "./types.ts";
import {compileInstruction} from "./helpers.ts";

let rom = await Bun.file('./chip8.rom').bytes();
let memory = new Uint8Array(4096);
let regV = new Uint8Array(16);

const kProgramStart = 0x200;
memory.set(rom, kProgramStart);

let regPc = kProgramStart;
let regI = 0;
let regSp = 0;
let regDt = 0;
let regSt = 0;

class Display {
  private kWidth = 64;
  private kHeight = 32;

  private buffer = new Uint8Array(this.kWidth * this.kHeight);

  public clear() {
    this.buffer.set(new Uint8Array(this.buffer.length));
  }

  public draw(sprite: Uint8Array, offsetX: number, offsetY: number) {
    for (let y = 0; y < sprite.length; y++) {
      this.buffer.set(sprite[y].toString(2).padStart(8, '0').split('').map((v) => v === '1' ? 1 : 0), ((y + offsetY) * this.kWidth) + offsetX);
    }

    display.print();
  }

  public print() {
    let printBuffer = '\x1b[?25l';
    for (let y = 0; y < this.kHeight; y++) {
      for (let x = 0; x < this.kWidth; x++) {
        printBuffer += `\x1b[${y + 1};${x + 1}H${this.buffer[y * this.kWidth + x] === 1 ? '█' : ' '}`;
      }
    }

    console.log(printBuffer);
  }
}

const display = new Display();
const instructionSet: Instruction[] = [
  compileInstruction('00E0', () => {
    display.clear();
  }),
  // 00EE
  // 0nnn
  compileInstruction('1nnn', ({nnn}) => {
    regPc = nnn - 2;
  }),
  // 2nnn
  // 3xkk
  // 4xkk
  // 5xy0
  compileInstruction('6xkk', ({x, kk}) => {
    regV[x] = kk;
  }),
  compileInstruction('7xkk', ({x, kk}) => {
    regV[x] = regV[x] + kk;
  }),
  // 8xy0
  // 8xy1
  // 8xy2
  // 8xy3
  // 8xy4
  // 8xy5
  // 8xy6
  // 8xy7
  // 8xyE
  // 9xy0
  compileInstruction('Annn', ({nnn}) => {
    regI = nnn;
  }),
  // Bnnn
  compileInstruction('Cxkk', ({x, kk}) => {
    regV[x] = (Math.random() * 256) & kk;
  }),
  compileInstruction('Dxyn', ({x, y, n}) => {
    const bytes = memory.slice(regI, regI + n);
    display.draw(bytes, regV[x], regV[y]);
  }),
  // Ex9E
  // ExA1
  // Fx07
  compileInstruction('Fx0A', ({x}) => {
    while (true) {} // TODO
  }),
  // Fx15
  // Fx18
  // Fx1E
  compileInstruction('Fx29', ({x}) => {
    const digit = regV[x];
    regI = digit * 5;
  }),
  compileInstruction('Fx33', ({x}) => {
    const value = regV[x];
    const hundreds = Math.floor(value / 100); // Extract the hundreds place
    const tens = Math.floor((value % 100) / 10); // Extract the tens place
    const ones = value % 10; // Extract the ones place

    memory[regI] = hundreds; // Store hundreds place at memory[regI]
    memory[regI + 1] = tens; // Store tens place at memory[regI + 1]
    memory[regI + 2] = ones; // Store ones place at memory[regI + 2]
  }),
  // Fx55
  compileInstruction('Fx65', ({x}) => {
    regV.set(memory.subarray(regI + regV[0], regI + x), 0);
  }),
];

const spriteChars = [
  new Uint8Array([0xf0, 0x90, 0x90, 0x90, 0xf0]), // 0
  new Uint8Array([0x20, 0x60, 0x20, 0x20, 0x70]), // 1
  new Uint8Array([0xf0, 0x10, 0xf0, 0x80, 0xf0]), // 2
  new Uint8Array([0xf0, 0x10, 0xf0, 0x10, 0xf0]), // 3
  new Uint8Array([0x90, 0x90, 0xf0, 0x10, 0x10]), // 4
  new Uint8Array([0xf0, 0x80, 0xf0, 0x10, 0xf0]), // 5
  new Uint8Array([0xf0, 0x80, 0xf0, 0x90, 0xf0]), // 6
  new Uint8Array([0xf0, 0x10, 0x20, 0x40, 0x40]), // 7
  new Uint8Array([0xf0, 0x90, 0xf0, 0x90, 0xf0]), // 8
  new Uint8Array([0xf0, 0x90, 0xf0, 0x10, 0xf0]), // 9
  new Uint8Array([0xf0, 0x90, 0xf0, 0x90, 0x90]), // A
  new Uint8Array([0xe0, 0x90, 0xe0, 0x90, 0xe0]), // B
  new Uint8Array([0xf0, 0x80, 0x80, 0x80, 0xf0]), // C
  new Uint8Array([0xe0, 0x90, 0x90, 0x90, 0xe0]), // D
  new Uint8Array([0xf0, 0x80, 0xf0, 0x80, 0xf0]), // E
  new Uint8Array([0xf0, 0x80, 0xf0, 0x80, 0x80]), // F
];

for (let i = 0; i < spriteChars.length; i++) {
  memory.set(spriteChars[i], i * 5);
}

while (true) {
  let opcode = (memory[regPc] << 8) | memory[regPc + 1];
  let hasMatched = false;
  for (const instr of instructionSet) {
    if ((opcode & instr.mask) === instr.value) {
      instr.handler(opcode);
      hasMatched = true;

      break;
    }
  }

  if (!hasMatched) {
    throw new Error(`Unknown opcode: 0x${opcode.toString(16).padStart(4, '0')}`);
  }

  regPc += 2;
}
