import { Controller, Get } from '@nestjs/common';
import { Pool } from 'pg';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      service: 'ft_transcendence backend',
      status: 'running',
    };
  }

  @Get('health')
  async health() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      return {
        status: 'error',
        database: 'DATABASE_URL is not configured',
      };
    }

    const pool = new Pool({ connectionString: databaseUrl });

    try {
      await pool.query('SELECT 1');

      return {
        status: 'ok',
        database: 'connected',
      };
    } finally {
      await pool.end();
    }
  }
}
