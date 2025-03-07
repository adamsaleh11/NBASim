import { Resolver, Query, Args } from '@nestjs/graphql';
import { NotFoundException } from '@nestjs/common';
import { TeamsService } from '../services/teams.service';
import { TeamDTO } from '../dtos/team.dto';

@Resolver(() => TeamDTO)
export class TeamsResolver {
  constructor(private readonly teamsService: TeamsService) {}

  @Query(() => [TeamDTO])
  async teams(
    @Args('conference', { nullable: true }) conference?: string,
    @Args('division', { nullable: true }) division?: string,
  ): Promise<TeamDTO[]> {
    try {
      return await this.teamsService.findAll({ conference, division });
    } catch (error) {
      throw new NotFoundException(`Failed to fetch teams: ${error.message}`);
    }
  }

  @Query(() => TeamDTO, { nullable: true })
  async teamById(
    @Args('id') id: string,
  ): Promise<TeamDTO> {
    try {
      const team = await this.teamsService.findOne(id);
      if (!team) throw new NotFoundException(`Team with ID ${id} not found`);
      return team;
    } catch (error) {
      throw new NotFoundException(`Failed to fetch team by ID: ${error.message}`);
    }
  }

  @Query(() => TeamDTO, { nullable: true })
  async teamByName(
    @Args('name') name: string,
  ): Promise<TeamDTO> {
    try {
      const team = await this.teamsService.findByName(name);
      if (!team) throw new NotFoundException(`Team with name ${name} not found`);
      return team;
    } catch (error) {
      throw new NotFoundException(`Failed to fetch team by name: ${error.message}`);
    }
  }
}