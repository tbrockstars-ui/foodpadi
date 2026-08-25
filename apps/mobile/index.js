import { registerRootComponent } from 'expo';
import App from './App';

// Local entry file rather than the generic `expo/AppEntry.js` — in this
// monorepo, node_modules is hoisted to the repo root, so AppEntry.js's
// relative import of "../../App" resolves to the wrong directory. A local
// entry importing "./App" always resolves correctly regardless of hoisting.
registerRootComponent(App);
