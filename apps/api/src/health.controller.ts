import { Controller, Get } from '@nestjs/common';

/** GET /health: used by Docker / the reverse proxy to know the server is up. */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
