import express from 'express';
import { healthRouter } from './routes/health';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

// Routes
app.use('/health', healthRouter);

// Root
app.get('/', (_req, res) => {
  res.json({
    message: 'Dev Containers — Part 1 sample API',
    docs: 'https://github.com/your-org/devcontainers-part1',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
