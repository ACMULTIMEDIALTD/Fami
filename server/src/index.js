import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './migrate.js';

// Migrations are idempotent; running them on boot keeps Render deploys one-step.
await migrate();
createApp().listen(config.port, () => console.log(`api listening on :${config.port}`));
