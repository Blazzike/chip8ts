import type {Instruction} from "./types.ts";

function hexMask(position: number, length = 1) {
  const nibbleMask = (1 << (length * 4)) - 1; // e.g., length=2 -> 0xFF
  return nibbleMask << ((4 - position - length) * 4);
}

export function compileInstruction(name: string, handler: (params: Record<'kk' | 'x' | 'y' | 'n' | 'nnn', number>) => void): Instruction {
  const dynamicChars = ['k', 'x', 'y', 'n']
  const maskArr = [];
  for (let i = 0; i < 4; i++) {
    maskArr.push(dynamicChars.includes(name[i]) ? 0x0 : 0xF)
  }

  const mask = (maskArr[0] << 12) | (maskArr[1] << 8) | (maskArr[2] << 4) | maskArr[3];

  const valueArr = [];
  for (let i = 0; i < 4; i++){
    valueArr.push(dynamicChars.includes(name[i]) ? 0x0 : parseInt(name[i], 16))
  }

  const value = (valueArr[0] << 12) | (valueArr[1] << 8) | (valueArr[2] << 4) | valueArr[3];

  const kkHexMask = hexMask(name.indexOf('kk'), 2);
  const xHexMask = hexMask(name.indexOf('x'));
  const yHexMask = hexMask(name.indexOf('y'));
  const nHexMask = hexMask(name.indexOf('n'));
  const nnnHexMask = hexMask(name.indexOf('nnn'), 3);

  return {
    name,
    mask,
    value,
    handler: (opcode) => {
      handler({
        get kk() {
          return opcode & kkHexMask;
        },
        get x() {
          return (opcode & xHexMask) >> 8;
        },
        get y() {
          return (opcode & yHexMask) >> 4;
        },
        get n() {
          return opcode & nHexMask;
        },
        get nnn() {
          return opcode & nnnHexMask;
        },
      });
    }
  }
}
