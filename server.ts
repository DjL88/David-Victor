import { createApp } from './server/app';

const PORT = Number(process.env.PORT || 3000);

createApp()
  .then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Cloud Run BFF running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
