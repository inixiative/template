import { worker } from 'src/worker/worker';

const port = process.env.WORKER_PORT || 0;

worker.listen(port, () => {
  console.log(`Worker is running on port ${port}`);
});