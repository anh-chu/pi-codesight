import { registerCommands } from './commands.ts';
import { registerCodesightTools, registerSessionNotice } from './tools.ts';

export default function register(pi: any) {
  registerCodesightTools(pi);
  registerCommands(pi);
  registerSessionNotice(pi);
}
