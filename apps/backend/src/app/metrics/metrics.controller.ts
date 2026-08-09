import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { FastifyReply } from 'fastify';

import { Public } from '../common/decorators/public.decorator';

/** Re-exposes the Prometheus endpoint so it can bypass the global JWT guard. */
@ApiExcludeController()
@Public()
@Controller('metrics')
export class MetricsController extends PrometheusController {
  @Get()
  override async index(@Res({ passthrough: true }) response: FastifyReply): Promise<string> {
    return super.index(response);
  }
}
