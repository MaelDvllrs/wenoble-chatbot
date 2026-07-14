// tsc ne copie que les .ts : le system prompt (.md) doit être recopié à la main
// dans dist/ pour que le build de prod le trouve.
import { cp } from 'node:fs/promises';

await cp('src/prompts', 'dist/prompts', { recursive: true });
console.log('prompts → dist/prompts');
