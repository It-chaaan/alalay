export type CalculatorResult = { value: number | null; error?: string };

const operators = new Set(['+', '-', '*', '/']);

export function evaluateAmountExpression(expression: string): CalculatorResult {
  const source = expression.replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/,/g, '').trim();
  if (!source || /[+*/.]$/.test(source) || source === '-') return { value: null, error: 'Complete the calculation before continuing.' };
  if (!/^[0-9+*/.-]+$/.test(source)) return { value: null, error: 'Complete the calculation before continuing.' };
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+*/-]/g) ?? [];
  if (tokens.join('') !== source) return { value: null, error: 'Complete the calculation before continuing.' };
  const values: number[] = []; const ops: string[] = [];
  const apply = () => { const op = ops.pop(); const right = values.pop(); const left = values.pop(); if (op === undefined || left === undefined || right === undefined) return false; if (op === '/' && right === 0) throw new Error('Cannot divide by zero.'); values.push(op === '+' ? left + right : op === '-' ? left - right : op === '*' ? left * right : left / right); return true; };
  let expectValue = true;
  try { for (const token of tokens) { if (!operators.has(token)) { if (!expectValue) return { value: null, error: 'Complete the calculation before continuing.' }; values.push(Number(token)); expectValue = false; } else { if (expectValue) return { value: null, error: 'Complete the calculation before continuing.' }; while (ops.length && (token === '+' || token === '-' || ops[ops.length - 1] === '*' || ops[ops.length - 1] === '/')) if (!apply()) return { value: null, error: 'Complete the calculation before continuing.' }; ops.push(token); expectValue = true; } } if (expectValue) return { value: null, error: 'Complete the calculation before continuing.' }; while (ops.length) if (!apply()) return { value: null, error: 'Complete the calculation before continuing.' }; const value = values[0]; if (!Number.isFinite(value)) return { value: null, error: 'Amount is too large.' }; return { value: Math.round((value + Number.EPSILON) * 100) / 100 }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : 'Unable to calculate amount.' }; }
}

export function formatCalculatorExpression(expression: string) { return expression.replace(/\*/g, '×').replace(/\//g, '÷'); }
