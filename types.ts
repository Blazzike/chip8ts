export type Instruction = {
  name: string,
  mask: number,
  value: number,
  handler: (opcode: number) => void,
};
