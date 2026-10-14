import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '@app/shared';

@ApiTags('Health')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api and GET /api/health both answer, so a bare /api no longer 404s
  @Get(['', 'health'])
  @ApiOperation({ summary: 'Health check (API and database)' })
  @ApiResponse({ status: 200, description: 'API and database are up' })
  @ApiResponse({ status: 503, description: 'Database unreachable' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    return { status: 'ok', database: 'up', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() };
  }
}
