import type {Instruction} from "./types.ts";
import {compileInstruction} from "./helpers.ts";

let rom = await Bun.file('./octojam6title.ch8').bytes();
let memory = new Uint8Array(4096);
let regV = new Uint8Array(16);

const kProgramStart = 0x200;
memory.set(rom, kProgramStart);

let regPc = kProgramStart;
let regI = 0;

const regStack = new Uint16Array(16);
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
    let somePixelsErased = false;
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < 8; x++) {
        const bit = (sprite[y] >> (7 - x)) & 1; // Notice the change here
        // if (bit === 0) {
        //   continue;
        // }

        let bufferIndex = ((y + offsetY) * this.kWidth) + offsetX + x;
        if (this.buffer[bufferIndex] === 1 && bit === 1) {
          somePixelsErased = true;
        }

        this.buffer[bufferIndex] ^= bit;
      }
    }

    display.print();

    return somePixelsErased;
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
  compileInstruction('00EE', () => {
    regSp--;
    if (regSp < 0) {
      throw new Error('Stack underflow');
    }

    regPc = regStack[regSp];
  }),
  compileInstruction('0nnn', () => {
    // ignored:
    // Jump to a machine code routine at nnn.
    //
    // This instruction is only used on the old computers on which Chip-8 was originally implemented. It is ignored by modern interpreters.
  }),
  compileInstruction('1nnn', ({nnn}) => {
    regPc = nnn - 2;
  }),
  compileInstruction('2nnn', ({nnn}) => {
    regStack[regSp] = regPc;
    regSp++;
    if (regSp > 15) {
      throw new Error('Stack overflow');
    }

    regPc = nnn - 2;
  }),
  compileInstruction('3xkk', ({x, kk}) => {
    if (regV[x] === kk) {
      regPc += 2;
    }
  }),
  compileInstruction('4xkk', ({x, kk}) => {
    if (regV[x] !== kk) {
      regPc += 2;
    }
  }),
  compileInstruction('5xy0', ({x, y}) => {
    if (regV[x] === regV[y]) {
      regPc += 2;
    }
  }),
  compileInstruction('6xkk', ({x, kk}) => {
    regV[x] = kk;
  }),
  compileInstruction('7xkk', ({x, kk}) => {
    regV[x] = (regV[x] + kk) & 0xFF;
  }),
  compileInstruction('8xy0', ({x, y}) => {
    regV[x] = regV[y];
  }),
  compileInstruction('8xy1', ({x, y}) => {
    regV[x] = regV[x] | regV[y];
  }),
  compileInstruction('8xy2', ({x, y}) => {
    regV[x] = regV[x] & regV[y];
  }),
  compileInstruction('8xy3', ({x, y}) => {
    regV[x] = regV[x] ^ regV[y];
  }),
  compileInstruction('8xy4', ({x, y}) => {
    const sum = regV[x] + regV[y];
    regV[0xF] = sum > 255 ? 1 : 0;
    regV[x] = sum & 0xFF;
  }),
  compileInstruction('8xy5', ({x, y}) => {
    const diff = regV[x] - regV[y];
    regV[0xF] = diff < 0 ? 0 : 1;
    regV[x] = diff & 0xFF;
  }),
  compileInstruction('8xy6', ({x}) => {
    regV[0xF] = regV[x] & 0x1;
    regV[x] >>= 1;
  }),
  compileInstruction('8xy7', ({x, y}) => {
    regV[0xF] = regV[y] >= regV[x] ? 1 : 0;
    regV[x] = (regV[y] - regV[x]) & 0xFF;
  }),
  compileInstruction('8xyE', ({x}) => {
    regV[0xF] = regV[x] >> 7;
    regV[x] <<= 1;
  }),
  compileInstruction('9xy0', ({x, y}) => {
    if (regV[x] !== regV[y]) {
      regPc += 2;
    }
  }),
  compileInstruction('Annn', ({nnn}) => {
    regI = nnn;
  }),
  compileInstruction('Bnnn', ({nnn}) => {
    regPc = (nnn + regV[0]) - 2;
  }),
  compileInstruction('Cxkk', ({x, kk}) => {
    regV[x] = (Math.random() * 256) & kk;
  }),
  compileInstruction('Dxyn', ({x, y, n}) => {
    const bytes = memory.slice(regI, regI + n);
    const posX = regV[x] % 64; // Ensure wrapping using modulo, CHIP-8 screen width is 64
    const posY = regV[y] % 32; // CHIP-8 screen height is 32

    const somePixelsErased = display.draw(bytes, posX, posY);
    regV[0xF] = somePixelsErased ? 1 : 0;
  }),
  compileInstruction('Ex9E', () => {
    // TOOD:
    // Skip next instruction if key with the value of Vx is pressed.
    // Checks the keyboard, and if the key corresponding to the value of Vx is currently in the down position, PC is increased by 2.

    // for now, let's just do nothing
  }),
  compileInstruction('ExA1', () => {
    // TODO:
    // Skip next instruction if key with the value of Vx is not pressed.
    // Checks the keyboard, and if the key corresponding to the value of Vx is currently in the up position, PC is increased by 2.

    // for now, let's just always skip
    regPc += 2;
  }),
  compileInstruction('Fx07', ({x}) => {
    regV[x] = regDt;
  }),
  compileInstruction('Fx0A', ({x}) => {
    while (true) {} // TODO
  }),
  compileInstruction('Fx15', ({x}) => {
    regDt = regV[x];
  }),
  compileInstruction('Fx18', ({x}) => {
    regSt = regV[x];
  }),
  compileInstruction('Fx1E', ({x}) => {
    regI = regI + regV[x];
  }),
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
  compileInstruction('Fx55', ({x}) => {
    for (let i = 0; i <= x; i++) {
      memory[regI + i] = regV[i];
    }
  }),
  compileInstruction('Fx65', ({x}) => {
    for (let i = 0; i <= x; i++) {
      regV[i] = memory[regI + i];
    }
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

function executeInstruction() {
  const opcode = (memory[regPc] << 8) | memory[regPc + 1];
  let hasMatched = false;
  // console.debug(opcode.toString(16).padStart(4, '0'));
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

const instructionRate = 540; // default: 540 Hz
const timerRate = 60;

let cycleCount = 0;
let startTime = Date.now();
let lastTimerDecrement = 0;
while (true) {
  if ((Date.now() - lastTimerDecrement) / 1000 > 1 / timerRate) {
    if (regDt > 0) regDt--;

    lastTimerDecrement = Date.now();
  }

  executeInstruction();
  cycleCount++;
  let targetCycleCount = 0;
  while (cycleCount > targetCycleCount) {
    targetCycleCount = Math.floor(((Date.now() - startTime) / 1000) * instructionRate);
  }
}
