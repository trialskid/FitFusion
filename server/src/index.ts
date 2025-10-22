import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import mergeRouter from './routes/merge';

const app = express();

app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(mergeRouter);

const staticDir = path.resolve(__dirname, '../public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res
    .status(err?.status || 500)
    .json({ message: err?.message || 'Unexpected server error' });
});

const port = process.env.PORT ?? '3001';
app.listen(Number(port), () => {
  const resolved = Number(port);
  console.log(`FitFusion server listening on port ${resolved}`);
});
