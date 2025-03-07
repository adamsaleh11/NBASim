// teams.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamsService } from './services/teams.service';
import { Team, TeamSchema } from './schemas/team.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Team.name, schema: TeamSchema }])],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}