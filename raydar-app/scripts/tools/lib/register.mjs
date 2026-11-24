// Lets Node import RAYDAR's JSON files the way Vite does (import X from '...json'), so the tools in scripts/
// run the app's own converter and rules. Used as: node --import ./scripts/tools/lib/register.mjs <script>
import { register } from 'node:module';
register('./json-hooks.mjs', import.meta.url);
