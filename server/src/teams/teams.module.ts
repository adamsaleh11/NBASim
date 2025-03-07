import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamsService } from './services/teams.service';
import { TeamsResolver } from './resolvers/teams.resolver';
import { Team, TeamSchema } from './schemas/team.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Team.name, schema: TeamSchema }])],
  providers: [TeamsService, TeamsResolver],
  exports: [TeamsService, TeamsResolver],
})
export class TeamsModule {}