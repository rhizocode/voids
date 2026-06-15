import { Body, Controller, Get, Put } from '@nestjs/common';
import { movieStatusById, type MovieStatusResponse } from '@voids/shared';
import { SettingsService } from '../config/settings.service';
import { UpdateMovieStatusDto } from './dto';

/**
 * Movie-status endpoints (brief §6/§10). Controls whether unreleased movies are
 * recommended (ALL=0 vs RELEASED=1). The search engine already reads this from
 * `settings.movieStatus`.
 */
@Controller('api/movie-status')
export class MovieStatusController {
  constructor(private readonly settings: SettingsService) {}

  /** The current movie-status as `{ id, label }`. */
  @Get()
  get(): MovieStatusResponse {
    return this.toResponse(this.settings.get().movieStatus);
  }

  /** Persist the movie-status and return the updated `{ id, label }`. */
  @Put()
  update(@Body() body: UpdateMovieStatusDto): MovieStatusResponse {
    const updated = this.settings.update({ movieStatus: body.movieStatus });
    return this.toResponse(updated.movieStatus);
  }

  private toResponse(id: 0 | 1): MovieStatusResponse {
    const entry = movieStatusById(id);
    return { id, label: entry?.label ?? '' };
  }
}
